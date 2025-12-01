/**
 * Key Exchange Module - Custom KEX Protocol
 * ECDH for shared secret + ECDSA for signatures + HKDF for key derivation
 * 
 * This will be fully implemented in Phase 3
 */

const PROTOCOL_VERSION = "SecureKEX-1.0";
const TIMESTAMP_WINDOW_MS = 30000; // 30 seconds

// Generate ephemeral ECDH key pair for this exchange
export async function generateEphemeralKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Generate random nonce (12 bytes)
export function generateNonce() {
  const arr = window.crypto.getRandomValues(new Uint8Array(12));
  return arrayToBase64(arr);
}

// Compute shared secret using ECDH
export async function computeSharedSecret(myPrivateKey, theirPublicKey) {
  const sharedBits = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    256
  );
  return new Uint8Array(sharedBits);
}

// Derive session key using HKDF
export async function deriveSessionKey(sharedSecret, salt, info) {
  // Import shared secret as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  
  // Derive AES-256-GCM key
  const sessionKey = await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: typeof salt === 'string' ? new TextEncoder().encode(salt) : salt,
      info: new TextEncoder().encode(info)
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  return sessionKey;
}

// Sign data with ECDSA
export async function signData(privateKey, data) {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  
  const signature = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    dataBuffer
  );
  
  return arrayToBase64(new Uint8Array(signature));
}

// Verify ECDSA signature
export async function verifySignature(publicKey, data, signatureB64) {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  const signature = base64ToArray(signatureB64);
  
  const isValid = await window.crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    dataBuffer
  );
  
  return isValid;
}

// Hash data with SHA-256
export async function hashData(data) {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  
  const hash = await window.crypto.subtle.digest("SHA-256", dataBuffer);
  return new Uint8Array(hash);
}

// Validate timestamp (for replay protection)
export function isTimestampValid(timestamp) {
  const now = Date.now();
  return Math.abs(now - timestamp) <= TIMESTAMP_WINDOW_MS;
}

// Helper functions
function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr));
}

function base64ToArray(base64) {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

export { PROTOCOL_VERSION, TIMESTAMP_WINDOW_MS };
