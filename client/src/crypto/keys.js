/**
 * Key Generation Module
 * Uses Web Crypto API (SubtleCrypto) - Required for this project
 * 
 * Security: All key operations use browser's native Web Crypto API
 * which provides hardware-accelerated, FIPS-compliant cryptography.
 */

// Console styling for clear visibility
const LOG_STYLES = {
  header: 'background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  detail: 'color: #94a3b8;',
  warning: 'color: #f59e0b;'
};

// Generate ECDSA key pair for digital signatures
export async function generateSigningKeyPair() {
  console.log('%c🔐 WEB CRYPTO API - KEY GENERATION', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c[1] Generating ECDSA P-256 Signing Key Pair...', LOG_STYLES.info);
  console.log('%c    Algorithm: ECDSA (Elliptic Curve Digital Signature Algorithm)', LOG_STYLES.detail);
  console.log('%c    Curve: P-256 (secp256r1)', LOG_STYLES.detail);
  console.log('%c    Key Usage: [sign, verify]', LOG_STYLES.detail);
  console.log('%c    Extractable: true (for IndexedDB storage)', LOG_STYLES.detail);
  
  const startTime = performance.now();
  
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,  // extractable - needed to store in IndexedDB
    ["sign", "verify"]
  );
  
  const endTime = performance.now();
  
  console.log('%c✓ ECDSA Signing Key Pair Generated Successfully!', LOG_STYLES.success);
  console.log('%c    Generation Time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
  console.log('%c    Public Key Type: ' + keyPair.publicKey.type, LOG_STYLES.detail);
  console.log('%c    Private Key Type: ' + keyPair.privateKey.type, LOG_STYLES.detail);
  console.log('%c    API Used: window.crypto.subtle.generateKey()', LOG_STYLES.detail);
  
  return keyPair;
}

// Generate ECDH key pair for key exchange
export async function generateKeyExchangeKeyPair() {
  console.log('%c[2] Generating ECDH P-256 Key Exchange Key Pair...', LOG_STYLES.info);
  console.log('%c    Algorithm: ECDH (Elliptic Curve Diffie-Hellman)', LOG_STYLES.detail);
  console.log('%c    Curve: P-256 (secp256r1)', LOG_STYLES.detail);
  console.log('%c    Key Usage: [deriveKey, deriveBits]', LOG_STYLES.detail);
  console.log('%c    Purpose: Derive shared secrets for E2E encryption', LOG_STYLES.detail);
  
  const startTime = performance.now();
  
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,  // extractable
    ["deriveKey", "deriveBits"]
  );
  
  const endTime = performance.now();
  
  console.log('%c✓ ECDH Key Exchange Key Pair Generated Successfully!', LOG_STYLES.success);
  console.log('%c    Generation Time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
  console.log('%c    Public Key Type: ' + keyPair.publicKey.type, LOG_STYLES.detail);
  console.log('%c    Private Key Type: ' + keyPair.privateKey.type, LOG_STYLES.detail);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  return keyPair;
}

// Export public key to JWK format (for sending to server)
export async function exportPublicKey(key) {
  console.log('%c[EXPORT] Exporting Public Key to JWK format...', LOG_STYLES.info);
  
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  
  console.log('%c✓ Public Key Exported (JWK Format)', LOG_STYLES.success);
  console.log('%c    Key Type (kty): ' + exported.kty, LOG_STYLES.detail);
  console.log('%c    Curve (crv): ' + exported.crv, LOG_STYLES.detail);
  console.log('%c    X Coordinate: ' + exported.x?.substring(0, 20) + '...', LOG_STYLES.detail);
  console.log('%c    Y Coordinate: ' + exported.y?.substring(0, 20) + '...', LOG_STYLES.detail);
  console.log('%c    ⚠️  This PUBLIC key will be sent to server', LOG_STYLES.warning);
  
  return exported;
}

// Export private key to JWK format (for storing in IndexedDB)
export async function exportPrivateKey(key) {
  console.log('%c[EXPORT] Exporting Private Key to JWK format...', LOG_STYLES.info);
  
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  
  console.log('%c✓ Private Key Exported (JWK Format)', LOG_STYLES.success);
  console.log('%c    Key Type (kty): ' + exported.kty, LOG_STYLES.detail);
  console.log('%c    Curve (crv): ' + exported.crv, LOG_STYLES.detail);
  console.log('%c    Has Private Component (d): ' + (exported.d ? 'YES' : 'NO'), LOG_STYLES.detail);
  console.log('%c    🔒 This PRIVATE key will be stored in IndexedDB only!', LOG_STYLES.warning);
  console.log('%c    🔒 Private key NEVER leaves the client!', LOG_STYLES.warning);
  
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
