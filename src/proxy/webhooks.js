/**
 * Lemon Squeezy Signature Verification Helper (Native Web Crypto HMAC SHA-256)
 */

export async function verifyLemonSqueezySignature(bodyText, signatureHeader, secret) {
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

export function hexToUint8Array(hexString) {
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

/**
 * Paddle Billing v2 Signature Verification Helper
 * Paddle sends 'Paddle-Signature: ts=...;h1=...'
 * The signed payload is: `${ts}:${rawBody}`
 * Uses Web Crypto HMAC SHA-256 with timing-safe comparison
 */
export async function verifyPaddleSignature(bodyText, signatureHeader, secret) {
  if (!signatureHeader || !secret || !bodyText) return false;

  const parts = signatureHeader.split(';').map(p => p.trim());
  const tsPart = parts.find(p => p.startsWith('ts='));
  const h1Part = parts.find(p => p.startsWith('h1='));

  if (!tsPart || !h1Part) return false;

  const ts = tsPart.slice(3);
  const h1 = h1Part.slice(3);

  // Replay attack prevention: verify timestamp freshness (within 10 minutes)
  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 600) {
    console.warn(`[Paddle Webhook] Timestamp drifted beyond tolerance: diff=${Math.abs(now - timestamp)}s`);
    return false;
  }

  const encoder = new TextEncoder();
  const message = `${ts}:${bodyText}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return timingSafeStringEqual(computedHex.toLowerCase(), h1.toLowerCase());
  } catch (err) {
    console.error("[Paddle Webhook] Signature computation error:", err);
    return false;
  }
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

let cachedPaddleIps = null;
let paddleIpsExpiry = 0;

/**
 * Dynamic Paddle Live IP Allowlist Verification
 * Fetches current CIDRs from https://api.paddle.com/ips, caches for 24 hours.
 */
export async function isPaddleIpAllowed(clientIP) {
  if (!clientIP || clientIP === "anon_ip" || clientIP === "anonymous_ip") {
    return true;
  }

  const now = Date.now();
  if (!cachedPaddleIps || now > paddleIpsExpiry) {
    try {
      const res = await fetch("https://api.paddle.com/ips");
      if (res.ok) {
        const json = await res.json();
        const cidrs = json?.data?.ipv4_cidrs || [];
        cachedPaddleIps = cidrs.map(cidr => cidr.split('/')[0].trim());
        paddleIpsExpiry = now + 24 * 60 * 60 * 1000; // Cache 24 hours
      }
    } catch (err) {
      console.warn("[Paddle Webhook] Could not fetch live Paddle IPs from endpoint:", err);
    }
  }

  if (cachedPaddleIps && cachedPaddleIps.length > 0) {
    return cachedPaddleIps.includes(clientIP.trim());
  }

  return true;
}

