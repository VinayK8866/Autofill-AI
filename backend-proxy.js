/**
 * AutoFill AI Cloud Proxy with Supabase JWT Auth & KV Usage Tracking
 * 
 * Instructions:
 * 1. Go to dash.cloudflare.com
 * 2. Create a "Worker"
 * 3. Paste this code into the worker editor
 * 4. Go to "Settings -> Variables"
 * 5. Add 'GEMINI_API_KEY' as a secret (your Google AI Studio key)
 * 6. Add 'SUPABASE_JWT_SECRET' as a secret (from Supabase Settings -> API)
 * 7. Bind a KV Namespace named 'USERS_KV' to store rate limits (optional in dev)
 */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = origin.startsWith("chrome-extension://") || origin.endsWith("vinaykondabattula.workers.dev");
    const allowedOrigin = isAllowed ? origin : "null";

    const url = new URL(request.url);
    const isPostHogRequest = url.pathname.startsWith("/posthog/");

    // Handle PostHog Proxying
    if (isPostHogRequest) {
      const targetPath = url.pathname.replace(/^\/posthog/, "");
      const posthogUrl = new URL(targetPath + url.search, "https://us.i.posthog.com");

      // Handle OPTIONS preflight specifically for PostHog
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          },
        });
      }

      const headers = new Headers(request.headers);
      headers.set("Host", "us.i.posthog.com");
      
      const clientIP = request.headers.get("CF-Connecting-IP");
      if (clientIP) {
        headers.set("X-Forwarded-For", clientIP);
        headers.set("X-Real-IP", clientIP);
      }

      try {
        const response = await fetch(posthogUrl.toString(), {
          method: request.method,
          headers: headers,
          body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
          redirect: "follow"
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `PostHog Proxy Error: ${err.message}` }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin
          }
        });
      }
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. Handle CORS & Preflight Options
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const isUsageRequest = url.pathname === "/usage";
    const isWebhookRequest = url.pathname === "/webhook/razorpay";

    try {
      // Handle Razorpay Webhooks first
      if (isWebhookRequest) {
        const signatureHeader = request.headers.get("X-Razorpay-Signature");
        const bodyText = await request.text();
        const secret = env.RAZORPAY_WEBHOOK_SECRET;

        // Verify signature (fail-closed)
        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET is not configured in the environment.");
          return new Response("Webhook verification failed: Secret configuration missing", { status: 500 });
        }

        const isVerified = await verifyRazorpaySignature(bodyText, signatureHeader, secret);
        if (!isVerified) {
          return new Response("Invalid Razorpay Webhook Signature", { status: 400 });
        }

        const razorpayEvent = JSON.parse(bodyText);
        const eventType = razorpayEvent.event;

        if (eventType === "payment.captured" || eventType === "order.paid") {
          const payment = razorpayEvent.payload.payment.entity;
          const userId = payment.notes ? (payment.notes.userId || payment.notes.userid) : null;

          if (userId && env.USERS_KV) {
            await env.USERS_KV.put(`user:plan:${userId}`, "Pro Plan");
            console.log(`Successfully upgraded user ${userId} to Pro Plan via Razorpay payment`);
          }
        } else if (eventType === "subscription.activated" || eventType === "subscription.charged") {
          const subscription = razorpayEvent.payload.subscription.entity;
          const userId = subscription.notes ? (subscription.notes.userId || subscription.notes.userid) : null;

          if (userId && env.USERS_KV) {
            await env.USERS_KV.put(`user:plan:${userId}`, "Pro Plan");
            console.log(`Successfully activated Pro plan for user ${userId} via Razorpay subscription`);
          }
        } else if (eventType === "subscription.cancelled" || eventType === "subscription.halted") {
          const subscription = razorpayEvent.payload.subscription.entity;
          const userId = subscription.notes ? (subscription.notes.userId || subscription.notes.userid) : null;

          if (userId && env.USERS_KV) {
            await env.USERS_KV.put(`user:plan:${userId}`, "Free Tier");
            console.log(`Successfully downgraded user ${userId} to Free Tier due to Razorpay subscription cancellation`);
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          }
        });
      }

      // 2. SaaS Authentication (Supabase JWT Verification)
      const authHeader = request.headers.get("Authorization");
      let userTier = "anonymous";
      let userId = request.headers.get("CF-Connecting-IP") || "anonymous_ip";
      let jwtPayload = null;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          jwtPayload = await verifyJWT(token, env);
          userTier = "authenticated";
          userId = jwtPayload.sub;
        } catch (jwtErr) {
          return new Response(JSON.stringify({ error: `Authentication Failed: ${jwtErr.message}` }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
      } else if (isUsageRequest) {
        return new Response(JSON.stringify({ error: "Authentication Required" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }

      // 3. Retrieve plan & usage count
      let userPlan = "Free Tier";
      let usageCount = 0;

      if (userTier === "authenticated") {
        if (env.USERS_KV) {
          userPlan = await env.USERS_KV.get(`user:plan:${userId}`) || "Free Tier";
          usageCount = parseInt(await env.USERS_KV.get(`user:fills:${userId}`) || "0", 10);
        } else {
          userPlan = "Free Tier";
          usageCount = 0;
        }
      }

      // 4. Handle Usage Info Request
      if (isUsageRequest) {
        return new Response(JSON.stringify({ usageCount, userPlan }), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }

      // Extract Prompt, incrementUsage, and fields schema from extension request
      const requestBody = await request.json();
      const prompt = requestBody.prompt;
      const incrementUsage = requestBody.incrementUsage;
      const schemaFields = requestBody.schemaFields;

      if (prompt === "PING_TEST") {
        return new Response(JSON.stringify({ success: true, message: "pong" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Block unauthenticated calls to expensive LLM endpoints
      if (userTier !== "authenticated") {
        return new Response(JSON.stringify({ error: "Authentication Required. Please log in or sign up inside extension settings to use Autofill AI." }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }

      // 5. Check Limits before Generation
      if (incrementUsage !== false) {
        if (userPlan === "Free Tier" && usageCount >= 50) {
          return new Response(
            JSON.stringify({ error: "Monthly fill limit reached (50/50). Upgrade to Pro inside Options!" }),
            { 
              status: 402, 
              headers: { 
                "Content-Type": "application/json", 
                ...corsHeaders
              } 
            }
          );
        }
      }

      const API_KEY = env.GEMINI_API_KEY;
      if (!API_KEY) {
        return new Response("Server configuration error: GEMINI_API_KEY secret is missing in environment variables.", { status: 500 });
      }

      // Dynamically construct response schema to enforce structured output constraints
      let responseSchema = null;
      if (schemaFields && Array.isArray(schemaFields) && schemaFields.length > 0) {
        const properties = {};
        const required = [];
        schemaFields.forEach(field => {
          if (field && typeof field.id === 'string') {
            const isBool = field.type === 'checkbox' || field.type === 'radio';
            properties[field.id] = {
              type: isBool ? "BOOLEAN" : "STRING",
              description: `Realistic mock fill data for field '${field.id}' (label: ${field.label || ''}, placeholder: ${field.placeholder || ''})`
            };
            required.push(field.id);
          }
        });
        if (required.length > 0) {
          responseSchema = {
            type: "OBJECT",
            properties: properties,
            required: required
          };
        }
      }

      const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
      let response = null;
      let lastError = null;

      for (const modelName of models) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for large forms

        try {
          console.log(`[AutoFill AI Proxy] Attempting completion with model: ${modelName}`);
          const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ],
              generationConfig: {
                temperature: 0.1, 
                response_mime_type: "application/json",
                ...(responseSchema ? { response_schema: responseSchema } : {})
              }
            }),
            signal: controller.signal
          });

          if (res.ok) {
            response = res;
            break; // Success!
          } else {
            const errText = await res.text();
            console.warn(`[AutoFill AI Proxy] Model ${modelName} failed with status ${res.status}: ${errText}`);
            
            let cleanErr = errText;
            try {
              const parsed = JSON.parse(errText);
              if (parsed && parsed.error && parsed.error.message) {
                cleanErr = parsed.error.message;
              }
            } catch (e) {
              // Not JSON, use raw errText
            }
            lastError = new Error(`[${res.status}] ${cleanErr}`);
          }
        } catch (err) {
          if (err.name === "AbortError") {
            lastError = new Error("Request timed out after 25 seconds.");
          } else {
            lastError = err;
          }
          console.warn(`[AutoFill AI Proxy] Model ${modelName} threw error:`, err.message || err);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (!response) {
        const errMessage = lastError ? lastError.message : "All Gemini model endpoints failed.";
        return new Response(JSON.stringify({ error: `Gemini API Error: ${errMessage}` }), { 
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }

      const data = await response.json();
      
      let resultText = "{}";
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        resultText = data.candidates[0].content.parts[0].text;
      }

      // 6. Increment usage after successful API call
      let newUsageCount = usageCount;
      if (incrementUsage !== false) {
        newUsageCount = usageCount + 1;
        if (env.USERS_KV && userTier === "authenticated") {
          await env.USERS_KV.put(`user:fills:${userId}`, newUsageCount.toString());
        }
      }

      return new Response(JSON.stringify({ 
        text: resultText,
        usageCount: newUsageCount,
        userPlan: userPlan
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: `Server Error: ${err.message}` }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  },
};

/**
 * JWT Verification Helper
 */
// Cache JWKS in memory to avoid fetching on every request
let cachedJwks = null;
let jwksExpiry = 0;

async function getJwks(supabaseUrl, supabaseAnonKey) {
  const now = Date.now();
  if (cachedJwks && now < jwksExpiry) {
    return cachedJwks;
  }

  const certsUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const res = await fetch(certsUrl, {
    headers: {
      'apikey': supabaseAnonKey
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from Supabase: ${res.statusText}`);
  }

  const jwks = await res.json();
  cachedJwks = jwks;
  jwksExpiry = now + 10 * 60 * 1000; // cache for 10 minutes
  return jwks;
}

/**
 * JWT Verification Helper (Supports both legacy HS256 symmetric secret & P-256 ES256 asymmetric JWKS certs)
 */
async function verifyJWT(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token structure');
  }
  
  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to inspect algorithm and Key ID
  const headerPadding = '='.repeat((4 - (headerB64.length % 4)) % 4);
  const headerBase64 = (headerB64 + headerPadding).replace(/-/g, '+').replace(/_/g, '/');
  const headerJson = atob(headerBase64);
  const header = JSON.parse(headerJson);
  const alg = header.alg;
  const kid = header.kid;

  let verified = false;

  if (alg === 'ES256') {
    // Asymmetric ECC verification via Supabase JWKS certs
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Asymmetric token detected (ES256), but SUPABASE_URL and SUPABASE_ANON_KEY are not configured in environment variables.");
    }

    const jwks = await getJwks(supabaseUrl, supabaseAnonKey);
    const jwk = jwks.keys?.find(k => k.kid === kid);
    if (!jwk) {
      throw new Error(`No public key found in JWKS matching key ID: ${kid}`);
    }

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['verify']
    );

    const signature = base64UrlToUint8Array(signatureB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    verified = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      key,
      signature,
      data
    );
  } else if (alg === 'HS256') {
    // Legacy Symmetric HS256 secret verification
    const secret = env.SUPABASE_JWT_SECRET || env.JWT_SECRET;
    if (!secret) {
      throw new Error("SUPABASE_JWT_SECRET secret is missing in environment variables.");
    }

    const encoder = new TextEncoder();
    const secretKeyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = base64UrlToUint8Array(signatureB64);
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    verified = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      data
    );
  } else {
    throw new Error(`Unsupported JWT signing algorithm: ${alg}`);
  }

  if (!verified) {
    throw new Error('JWT signature verification failed');
  }

  // Decode payload with padding correction
  const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
  const base64 = (payloadB64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const payloadJson = atob(base64);
  const payload = JSON.parse(payloadJson);

  // Expiration validation
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('JWT token expired');
  }

  return payload;
}

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Razorpay Signature Verification Helper (Native Web Crypto HMAC SHA-256)
 */
async function verifyRazorpaySignature(bodyText, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const signatureBytes = hexToUint8Array(signatureHeader);
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    encoder.encode(bodyText)
  );
  
  return verified;
}

function hexToUint8Array(hexString) {
  const badCharacters = /[^0-9a-fA-F]/g;
  if (badCharacters.test(hexString) || hexString.length % 2 !== 0) {
    return new Uint8Array(0);
  }
  const result = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}
