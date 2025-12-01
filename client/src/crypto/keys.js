/**
 * Key Generation Module
 * Uses Web Crypto API (SubtleCrypto) - Required for this project
 */

// Generate ECDSA key pair for digital signatures
export async function generateSigningKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,  // extractable - needed to store in IndexedDB
    ["sign", "verify"]
  );
  return keyPair;
}

// Generate ECDH key pair for key exchange
export async function generateKeyExchangeKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,  // extractable
    ["deriveKey", "deriveBits"]
  );
  return keyPair;
}

// Export public key to JWK format (for sending to server)
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  return exported;
}

// Export private key to JWK format (for storing in IndexedDB)
export async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  return exported;
}

// Import public key from JWK (ECDSA for verification)
export async function importSigningPublicKey(jwk) {
  const key = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
  return key;
}

// Import private key from JWK (ECDSA for signing)
export async function importSigningPrivateKey(jwk) {
  const key = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  return key;
}

// Import public key from JWK (ECDH for key exchange)
export async function importKeyExchangePublicKey(jwk) {
  const key = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
  return key;
}

// Import private key from JWK (ECDH for key exchange)
export async function importKeyExchangePrivateKey(jwk) {
  const key = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  return key;
}
