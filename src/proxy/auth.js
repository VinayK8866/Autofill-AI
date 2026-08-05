/**
 * JWT Verification Helper (Supports ES256 asymmetric JWKS certs & legacy HS256 symmetric secrets)
 */

let cachedJwks = null;
let jwksExpiry = 0;

export async function getJwks(supabaseUrl, supabaseAnonKey) {
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

export async function verifyJWT(token, env) {
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

export function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
