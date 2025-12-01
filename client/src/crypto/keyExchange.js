/**
 * CryptShare-KEX: Custom Key Exchange Protocol
 * =============================================
 * 
 * A 3-message authenticated key exchange protocol combining:
 * - ECDH P-256 for shared secret derivation
 * - ECDSA P-256 for digital signatures (MITM protection)
 * - HKDF-SHA256 for session key derivation
 * - Timestamp + Nonce for replay protection
 * 
 * Protocol Flow:
 * 1. KEX_INIT:     Alice → Bob (ephemeral key + signature)
 * 2. KEX_RESPONSE: Bob → Alice (ephemeral key + signature)
 * 3. KEX_CONFIRM:  Alice → Bob (key confirmation hash)
 */

import { importKeyExchangePublicKey, importKeyExchangePrivateKey, importSigningPrivateKey, importSigningPublicKey } from './keys';

// Protocol Constants
const PROTOCOL_VERSION = "CryptShare-KEX-v1";
const TIMESTAMP_WINDOW_MS = 30000; // ±30 seconds for replay protection
const NONCE_LENGTH = 16; // 16 bytes = 128 bits

// Console logging styles
const LOG_STYLES = {
  header: 'background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  warning: 'color: #f59e0b;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;',
  crypto: 'background: #059669; color: white; padding: 1px 6px; border-radius: 3px;'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...new Uint8Array(arr)));
}

function base64ToArray(base64) {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

function concatenateArrays(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================
// CORE CRYPTOGRAPHIC FUNCTIONS
// ============================================

/**
 * Generate ephemeral ECDH key pair for this session
 * New keys for every key exchange (forward secrecy)
 */
export async function generateEphemeralKeyPair() {
  console.log('%c🔑 CryptShare-KEX: Generating Ephemeral Keys', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c[ECDH] Generating ephemeral P-256 key pair...', LOG_STYLES.info);
  
  const startTime = performance.now();
  
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable for export
    ["deriveKey", "deriveBits"]
  );
  
  const endTime = performance.now();
  
  console.log('%c✓ Ephemeral ECDH key pair generated', LOG_STYLES.success);
  console.log('%c    Purpose: Single session only (forward secrecy)', LOG_STYLES.detail);
  console.log('%c    Generation time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
  
  return keyPair;
}

/**
 * Generate cryptographically secure random nonce
 */
export function generateNonce() {
  const nonce = window.crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  console.log('%c[NONCE] Generated ' + NONCE_LENGTH + '-byte random nonce', LOG_STYLES.info);
  return arrayToBase64(nonce);
}

/**
 * Export public key to JWK format for transmission
 */
export async function exportEphemeralPublicKey(keyPair) {
  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  console.log('%c[EXPORT] Ephemeral public key exported (JWK)', LOG_STYLES.info);
  return publicKeyJwk;
}

/**
 * Compute shared secret using ECDH
 * myPrivateKey × theirPublicKey = sharedSecret
 */
export async function computeSharedSecret(myPrivateKey, theirPublicKeyJwk) {
  console.log('%c[ECDH] Computing shared secret...', LOG_STYLES.crypto);
  
  // Import their public key
  const theirPublicKey = await window.crypto.subtle.importKey(
    "jwk",
    theirPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Derive shared bits
  const sharedBits = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    256 // 256 bits = 32 bytes
  );
  
  console.log('%c✓ ECDH shared secret computed (256 bits)', LOG_STYLES.success);
  console.log('%c    Both parties now have identical secret', LOG_STYLES.detail);
  
  return new Uint8Array(sharedBits);
}

/**
 * Derive session key using HKDF-SHA256
 * Creates AES-256-GCM key from shared secret
 */
export async function deriveSessionKey(sharedSecret, nonce1, nonce2, senderId, receiverId) {
  console.log('%c[HKDF] Deriving session key...', LOG_STYLES.crypto);
  
  // Create salt from both nonces (ensures unique key per session)
  const saltInput = concatenateArrays(
    base64ToArray(nonce1),
    base64ToArray(nonce2),
    new TextEncoder().encode(PROTOCOL_VERSION)
  );
  const salt = await window.crypto.subtle.digest("SHA-256", saltInput);
  
  // Create info string (context binding)
  const info = `CryptShare-Session:${senderId}:${receiverId}`;
  
  // Import shared secret as HKDF key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  
  // Derive AES-256-GCM session key
  const sessionKey = await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(salt),
      info: new TextEncoder().encode(info)
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable for storage
    ["encrypt", "decrypt"]
  );
  
  console.log('%c✓ Session key derived (AES-256-GCM)', LOG_STYLES.success);
  console.log('%c    Salt: SHA256(nonce1 || nonce2 || version)', LOG_STYLES.detail);
  console.log('%c    Info: ' + info, LOG_STYLES.detail);
  
  return sessionKey;
}

/**
 * Sign message data with ECDSA P-256
 */
export async function signMessage(signingPrivateKeyJwk, messageData) {
  console.log('%c[ECDSA] Signing message...', LOG_STYLES.crypto);
  
  // Import signing key
  const signingKey = await importSigningPrivateKey(signingPrivateKeyJwk);
  
  // Create message buffer
  const messageString = typeof messageData === 'string' 
    ? messageData 
    : JSON.stringify(messageData);
  const messageBuffer = new TextEncoder().encode(messageString);
  
  // Sign with ECDSA-SHA256
  const signature = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    messageBuffer
  );
  
  console.log('%c✓ Message signed with ECDSA-SHA256', LOG_STYLES.success);
  
  return arrayToBase64(signature);
}

/**
 * Verify ECDSA signature
 */
export async function verifySignature(signingPublicKeyJwk, messageData, signatureB64) {
  console.log('%c[ECDSA] Verifying signature...', LOG_STYLES.crypto);
  
  try {
    // Import signing public key
    const signingKey = await importSigningPublicKey(signingPublicKeyJwk);
    
    // Create message buffer
    const messageString = typeof messageData === 'string' 
      ? messageData 
      : JSON.stringify(messageData);
    const messageBuffer = new TextEncoder().encode(messageString);
    
    // Verify signature
    const isValid = await window.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      base64ToArray(signatureB64),
      messageBuffer
    );
    
    if (isValid) {
      console.log('%c✓ Signature verified - sender authenticated', LOG_STYLES.success);
    } else {
      console.log('%c✗ Signature verification FAILED', LOG_STYLES.error);
    }
    
    return isValid;
  } catch (error) {
    console.error('%c✗ Signature verification error:', LOG_STYLES.error, error);
    return false;
  }
}

/**
 * Create key confirmation hash
 * Proves both parties derived the same session key
 */
export async function createConfirmationHash(sessionKey, nonce1, nonce2, senderId, receiverId) {
  console.log('%c[CONFIRM] Creating key confirmation hash...', LOG_STYLES.info);
  
  // Export session key for hashing
  const keyBytes = await window.crypto.subtle.exportKey("raw", sessionKey);
  
  // Create confirmation data
  const confirmData = concatenateArrays(
    new Uint8Array(keyBytes),
    new TextEncoder().encode("CONFIRM"),
    base64ToArray(nonce1),
    base64ToArray(nonce2),
    new TextEncoder().encode(senderId),
    new TextEncoder().encode(receiverId)
  );
  
  // Hash it
  const hash = await window.crypto.subtle.digest("SHA-256", confirmData);
  
  console.log('%c✓ Confirmation hash created', LOG_STYLES.success);
  
  return arrayToBase64(hash);
}

/**
 * Verify key confirmation hash
 */
export async function verifyConfirmationHash(sessionKey, nonce1, nonce2, senderId, receiverId, receivedHash) {
  const expectedHash = await createConfirmationHash(sessionKey, nonce1, nonce2, senderId, receiverId);
  const isValid = expectedHash === receivedHash;
  
  if (isValid) {
    console.log('%c✓ Key confirmation verified - both parties have same key', LOG_STYLES.success);
  } else {
    console.log('%c✗ Key confirmation FAILED - keys may differ', LOG_STYLES.error);
  }
  
  return isValid;
}

// ============================================
// KEX MESSAGE BUILDERS
// ============================================

/**
 * Create KEX_INIT message (Step 1)
 * Sent by initiator to start key exchange
 */
export async function createKexInit(ephemeralKeyPair, signingPrivateKeyJwk, senderId, receiverId) {
  console.log('%c🚀 CryptShare-KEX: Creating KEX_INIT', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  const ephemeralPublicKey = await exportEphemeralPublicKey(ephemeralKeyPair);
  const nonce = generateNonce();
  const timestamp = Date.now();
  
  // Message payload (to be signed)
  const payload = {
    type: "KEX_INIT",
    version: PROTOCOL_VERSION,
    ephemeralPublicKey,
    nonce,
    timestamp,
    senderId,
    receiverId
  };
  
  // Sign the payload
  const signature = await signMessage(signingPrivateKeyJwk, payload);
  
  console.log('%c✓ KEX_INIT created and signed', LOG_STYLES.success);
  console.log('%c    From: ' + senderId, LOG_STYLES.detail);
  console.log('%c    To: ' + receiverId, LOG_STYLES.detail);
  console.log('%c    Timestamp: ' + new Date(timestamp).toISOString(), LOG_STYLES.detail);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  return { ...payload, signature };
}

/**
 * Process received KEX_INIT and create KEX_RESPONSE (Step 2)
 * Called by responder
 */
export async function processKexInitAndCreateResponse(
  kexInit,
  senderPublicSigningKey,
  myEphemeralKeyPair,
  mySigningPrivateKeyJwk,
  myId
) {
  console.log('%c📥 CryptShare-KEX: Processing KEX_INIT', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  // 1. Validate timestamp
  if (!isTimestampValid(kexInit.timestamp)) {
    console.log('%c✗ Timestamp validation FAILED (replay attack?)', LOG_STYLES.error);
    throw new Error('KEX_INIT timestamp expired or invalid');
  }
  console.log('%c✓ Timestamp valid (within ±30s window)', LOG_STYLES.success);
  
  // 2. Verify signature
  const { signature, ...payloadToVerify } = kexInit;
  const isSignatureValid = await verifySignature(senderPublicSigningKey, payloadToVerify, signature);
  
  if (!isSignatureValid) {
    console.log('%c✗ Signature verification FAILED (MITM attack?)', LOG_STYLES.error);
    throw new Error('KEX_INIT signature verification failed');
  }
  
  // 3. Compute shared secret
  const sharedSecret = await computeSharedSecret(
    myEphemeralKeyPair.privateKey,
    kexInit.ephemeralPublicKey
  );
  
  // 4. Create response
  const myEphemeralPublicKey = await exportEphemeralPublicKey(myEphemeralKeyPair);
  const myNonce = generateNonce();
  const timestamp = Date.now();
  
  const responsePayload = {
    type: "KEX_RESPONSE",
    version: PROTOCOL_VERSION,
    ephemeralPublicKey: myEphemeralPublicKey,
    nonce: myNonce,
    timestamp,
    senderId: myId,
    receiverId: kexInit.senderId,
    initiatorNonce: kexInit.nonce // Include initiator's nonce for key derivation
  };
  
  // 5. Sign response
  const responseSignature = await signMessage(mySigningPrivateKeyJwk, responsePayload);
  
  // 6. Derive session key
  const sessionKey = await deriveSessionKey(
    sharedSecret,
    kexInit.nonce, // initiator's nonce first
    myNonce,
    kexInit.senderId,
    myId
  );
  
  console.log('%c✓ KEX_RESPONSE created', LOG_STYLES.success);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  return {
    response: { ...responsePayload, signature: responseSignature },
    sessionKey,
    sharedSecret,
    initiatorNonce: kexInit.nonce,
    responderNonce: myNonce
  };
}

/**
 * Process KEX_RESPONSE and create KEX_CONFIRM (Step 3)
 * Called by initiator
 */
export async function processKexResponseAndCreateConfirm(
  kexResponse,
  responderPublicSigningKey,
  myEphemeralPrivateKey,
  mySigningPrivateKeyJwk,
  myNonce,
  myId
) {
  console.log('%c📥 CryptShare-KEX: Processing KEX_RESPONSE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  // 1. Validate timestamp
  if (!isTimestampValid(kexResponse.timestamp)) {
    console.log('%c✗ Timestamp validation FAILED', LOG_STYLES.error);
    throw new Error('KEX_RESPONSE timestamp expired or invalid');
  }
  console.log('%c✓ Timestamp valid', LOG_STYLES.success);
  
  // 2. Verify signature
  const { signature, ...payloadToVerify } = kexResponse;
  const isSignatureValid = await verifySignature(responderPublicSigningKey, payloadToVerify, signature);
  
  if (!isSignatureValid) {
    console.log('%c✗ Signature verification FAILED', LOG_STYLES.error);
    throw new Error('KEX_RESPONSE signature verification failed');
  }
  
  // 3. Compute shared secret
  const sharedSecret = await computeSharedSecret(
    myEphemeralPrivateKey,
    kexResponse.ephemeralPublicKey
  );
  
  // 4. Derive session key
  const sessionKey = await deriveSessionKey(
    sharedSecret,
    myNonce, // initiator's nonce first
    kexResponse.nonce,
    myId,
    kexResponse.senderId
  );
  
  // 5. Create confirmation hash
  const confirmationHash = await createConfirmationHash(
    sessionKey,
    myNonce,
    kexResponse.nonce,
    myId,
    kexResponse.senderId
  );
  
  // 6. Create confirmation message
  const confirmPayload = {
    type: "KEX_CONFIRM",
    version: PROTOCOL_VERSION,
    confirmationHash,
    timestamp: Date.now(),
    senderId: myId,
    receiverId: kexResponse.senderId
  };
  
  const confirmSignature = await signMessage(mySigningPrivateKeyJwk, confirmPayload);
  
  console.log('%c✓ KEX_CONFIRM created', LOG_STYLES.success);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  return {
    confirm: { ...confirmPayload, signature: confirmSignature },
    sessionKey,
    initiatorNonce: myNonce,
    responderNonce: kexResponse.nonce
  };
}

/**
 * Process KEX_CONFIRM (Final Step)
 * Called by responder to verify key exchange
 */
export async function processKexConfirm(
  kexConfirm,
  senderPublicSigningKey,
  sessionKey,
  initiatorNonce,
  responderNonce,
  initiatorId,
  responderId
) {
  console.log('%c📥 CryptShare-KEX: Processing KEX_CONFIRM', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  // 1. Validate timestamp
  if (!isTimestampValid(kexConfirm.timestamp)) {
    console.log('%c✗ Timestamp validation FAILED', LOG_STYLES.error);
    throw new Error('KEX_CONFIRM timestamp expired');
  }
  
  // 2. Verify signature
  const { signature, ...payloadToVerify } = kexConfirm;
  const isSignatureValid = await verifySignature(senderPublicSigningKey, payloadToVerify, signature);
  
  if (!isSignatureValid) {
    console.log('%c✗ Signature verification FAILED', LOG_STYLES.error);
    throw new Error('KEX_CONFIRM signature verification failed');
  }
  
  // 3. Verify confirmation hash
  const isHashValid = await verifyConfirmationHash(
    sessionKey,
    initiatorNonce,
    responderNonce,
    initiatorId,
    responderId,
    kexConfirm.confirmationHash
  );
  
  if (!isHashValid) {
    console.log('%c✗ Key confirmation FAILED - keys do not match', LOG_STYLES.error);
    throw new Error('Key confirmation failed - derived keys do not match');
  }
  
  console.log('%c🎉 KEY EXCHANGE COMPLETE!', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c✓ Both parties have the same AES-256-GCM session key', LOG_STYLES.success);
  console.log('%c✓ Ready for encrypted communication', LOG_STYLES.success);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  return true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate timestamp is within acceptable window
 */
export function isTimestampValid(timestamp) {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= TIMESTAMP_WINDOW_MS;
}

/**
 * Export session key for storage
 */
export async function exportSessionKey(sessionKey) {
  const keyBytes = await window.crypto.subtle.exportKey("raw", sessionKey);
  return arrayToBase64(keyBytes);
}

/**
 * Import session key from storage
 */
export async function importSessionKey(keyBase64) {
  const keyBytes = base64ToArray(keyBase64);
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export constants
export { PROTOCOL_VERSION, TIMESTAMP_WINDOW_MS };
