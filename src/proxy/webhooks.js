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
