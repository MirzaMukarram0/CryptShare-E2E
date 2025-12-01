/**
 * Session Key Store
 * Manages session keys derived from CryptShare-KEX protocol
 * Keys are stored in memory for the session + optionally in sessionStorage
 */

// In-memory session key storage
const sessionKeys = new Map();

// Console logging styles
const LOG_STYLES = {
  header: 'background: #f59e0b; color: black; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  warning: 'color: #f59e0b;',
  detail: 'color: #94a3b8;'
};

/**
 * Store a session key for a specific user
 */
export function storeSessionKey(peerId, sessionKey, metadata = {}) {
  console.log('%c🔐 SESSION KEY STORE', LOG_STYLES.header);
  console.log('%c[STORE] Saving session key for peer: ' + peerId, LOG_STYLES.info);
  
  const keyData = {
    key: sessionKey,
    createdAt: Date.now(),
    ...metadata
  };
  
  sessionKeys.set(peerId, keyData);
  
  console.log('%c✓ Session key stored in memory', LOG_STYLES.success);
  console.log('%c    Peer ID: ' + peerId, LOG_STYLES.detail);
  console.log('%c    Created: ' + new Date(keyData.createdAt).toISOString(), LOG_STYLES.detail);
  
  return true;
}

/**
 * Retrieve session key for a peer
 */
export function getSessionKey(peerId) {
  const keyData = sessionKeys.get(peerId);
  
  if (keyData) {
    console.log('%c[RETRIEVE] Session key found for: ' + peerId, LOG_STYLES.info);
    return keyData.key;
  }
  
  console.log('%c[RETRIEVE] No session key for: ' + peerId, LOG_STYLES.warning);
  return null;
}

/**
 * Check if session key exists for a peer
 */
export function hasSessionKey(peerId) {
  return sessionKeys.has(peerId);
}

/**
 * Remove session key for a peer
 */
export function removeSessionKey(peerId) {
  console.log('%c[REMOVE] Deleting session key for: ' + peerId, LOG_STYLES.info);
  return sessionKeys.delete(peerId);
}

/**
 * Clear all session keys (on logout)
 */
export function clearAllSessionKeys() {
  console.log('%c[CLEAR] Removing all session keys', LOG_STYLES.warning);
  sessionKeys.clear();
  return true;
}

/**
 * Get all peer IDs with active session keys
 */
export function getActivePeers() {
  return Array.from(sessionKeys.keys());
}

/**
 * Get session key metadata
 */
export function getSessionKeyMetadata(peerId) {
  const keyData = sessionKeys.get(peerId);
  if (keyData) {
    return {
      peerId,
      createdAt: keyData.createdAt,
      initiatorNonce: keyData.initiatorNonce,
      responderNonce: keyData.responderNonce
    };
  }
  return null;
}

// Key exchange state management
const pendingKeyExchanges = new Map();

/**
 * Store pending key exchange state (for initiator)
 */
export function storePendingKex(peerId, kexState) {
  console.log('%c[KEX] Storing pending key exchange for: ' + peerId, LOG_STYLES.info);
  pendingKeyExchanges.set(peerId, {
    ...kexState,
    createdAt: Date.now()
  });
}

/**
 * Get pending key exchange state
 */
export function getPendingKex(peerId) {
  return pendingKeyExchanges.get(peerId);
}

/**
 * Remove pending key exchange
 */
export function removePendingKex(peerId) {
  return pendingKeyExchanges.delete(peerId);
}

/**
 * Clear expired pending exchanges (older than 60 seconds)
 */
export function clearExpiredPendingKex() {
  const now = Date.now();
  const expireTime = 60000; // 60 seconds
  
  for (const [peerId, state] of pendingKeyExchanges) {
    if (now - state.createdAt > expireTime) {
      pendingKeyExchanges.delete(peerId);
      console.log('%c[KEX] Expired pending exchange removed: ' + peerId, LOG_STYLES.warning);
    }
  }
}

export default {
  storeSessionKey,
  getSessionKey,
  hasSessionKey,
  removeSessionKey,
  clearAllSessionKeys,
  getActivePeers,
  getSessionKeyMetadata,
  storePendingKex,
  getPendingKex,
  removePendingKex,
  clearExpiredPendingKex
};
