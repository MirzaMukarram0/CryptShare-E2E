/**
 * Conversation Key Derivation
 * ===========================
 * 
 * Derives a persistent conversation key from both users' long-term ECDH keys.
 * This key remains consistent across sessions, allowing message history decryption.
 * 
 * Unlike ephemeral session keys:
 * - Uses long-term key exchange keys (stored in IndexedDB)
 * - Same key derived every time for same user pair
 * - Allows decryption of past messages
 */

import { getPrivateKey } from './keyStore';

// Console logging styles
const LOG_STYLES = {
  header: 'background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;',
  crypto: 'background: #8b5cf6; color: white; padding: 1px 6px; border-radius: 3px;'
};

/**
 * Derive a persistent conversation key for two users
 * @param {string} myUserId - Current user's ID
 * @param {Object} peerPublicKeyJwk - Peer's public key exchange key (JWK)
 * @returns {CryptoKey} AES-256-GCM key for this conversation
 */
export async function deriveConversationKey(myUserId, peerPublicKeyJwk) {
  console.log('%c🔑 DERIVING CONVERSATION KEY', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  
  const startTime = performance.now();
  
  try {
    // Get my long-term private key from IndexedDB
    console.log('%c[1] Loading my long-term ECDH private key...', LOG_STYLES.info);
    const myPrivateKeyJwk = await getPrivateKey(`${myUserId}_keyExchange`);
    
    if (!myPrivateKeyJwk) {
      throw new Error('My key exchange private key not found');
    }
    
    // Import my private key
    const myPrivateKey = await window.crypto.subtle.importKey(
      "jwk",
      myPrivateKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    );
    console.log('%c✓ My private key loaded', LOG_STYLES.success);
    
    // Import peer's public key
    console.log('%c[2] Importing peer\'s public ECDH key...', LOG_STYLES.info);
    const peerPublicKey = await window.crypto.subtle.importKey(
      "jwk",
      peerPublicKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    console.log('%c✓ Peer public key imported', LOG_STYLES.success);
    
    // Derive shared secret using ECDH
    console.log('%c[3] Computing ECDH shared secret...', LOG_STYLES.crypto);
    const sharedBits = await window.crypto.subtle.deriveBits(
      { name: "ECDH", public: peerPublicKey },
      myPrivateKey,
      256
    );
    console.log('%c✓ Shared secret computed (256 bits)', LOG_STYLES.success);
    
    // Use HKDF to derive conversation key
    console.log('%c[4] Deriving AES-256-GCM key via HKDF...', LOG_STYLES.crypto);
    
    // Create deterministic salt from protocol identifier
    const saltString = "CryptShare-ConversationKey-v1";
    const salt = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(saltString)
    );
    
    // Import shared secret as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      sharedBits,
      "HKDF",
      false,
      ["deriveKey"]
    );
    
    // Derive AES-256-GCM conversation key
    const conversationKey = await window.crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(salt),
        info: new TextEncoder().encode("CryptShare-Conversation")
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    
    const endTime = performance.now();
    
    console.log('%c✓ Conversation key derived!', LOG_STYLES.success);
    console.log('%c    Algorithm: ECDH + HKDF-SHA256 → AES-256-GCM', LOG_STYLES.detail);
    console.log('%c    Derivation time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c    Key is PERSISTENT: Same key for same user pair always', LOG_STYLES.detail);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return conversationKey;
    
  } catch (error) {
    console.error('%c✗ Conversation key derivation failed:', LOG_STYLES.error, error);
    throw error;
  }
}

// Cache for conversation keys (in-memory)
const conversationKeyCache = new Map();

/**
 * Get or create a conversation key for a peer
 * Caches keys in memory for performance
 * @param {string} myUserId - Current user's ID
 * @param {string} peerId - Peer's user ID
 * @param {Object} peerPublicKeyJwk - Peer's public key exchange key (JWK)
 * @returns {CryptoKey} AES-256-GCM key for this conversation
 */
export async function getOrCreateConversationKey(myUserId, peerId, peerPublicKeyJwk) {
  // Create deterministic cache key
  const cacheKey = [myUserId, peerId].sort().join('-');
  
  // Check cache first
  if (conversationKeyCache.has(cacheKey)) {
    console.log('%c🔑 Using cached conversation key for:', 'color: #8b5cf6;', peerId);
    return conversationKeyCache.get(cacheKey);
  }
  
  // Derive new key
  const key = await deriveConversationKey(myUserId, peerPublicKeyJwk);
  
  // Cache it
  conversationKeyCache.set(cacheKey, key);
  
  return key;
}

/**
 * Clear the conversation key cache (e.g., on logout)
 */
export function clearConversationKeyCache() {
  conversationKeyCache.clear();
  console.log('%c🔑 Conversation key cache cleared', 'color: #f59e0b;');
}

export default { deriveConversationKey, getOrCreateConversationKey, clearConversationKeyCache };
