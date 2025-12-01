/**
 * Replay Protection Utilities
 * Triple-layer protection: Nonces + Timestamps + Sequence Numbers
 */

// Store for used nonces (in-memory, per session)
const usedNonces = new Set();

// Sequence tracking per conversation
const sequences = {};

// Timestamp window (5 minutes)
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

// Generate unique nonce
export function generateNonce() {
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Add replay protection to outgoing message
export function addReplayProtection(message, conversationId) {
  // Initialize sequence for this conversation
  if (!sequences[conversationId]) {
    sequences[conversationId] = { sent: 0, received: 0 };
  }
  
  return {
    ...message,
    nonce: generateNonce(),
    timestamp: Date.now(),
    sequence: ++sequences[conversationId].sent
  };
}

// Validate incoming message for replay attacks
export function validateReplayProtection(message, conversationId) {
  const { nonce, timestamp, sequence } = message;
  const errors = [];
  
  // Layer 1: Check nonce uniqueness
  if (usedNonces.has(nonce)) {
    errors.push('REPLAY_DETECTED: Duplicate nonce');
  } else {
    usedNonces.add(nonce);
    // Clean up old nonces after timestamp window
    setTimeout(() => usedNonces.delete(nonce), TIMESTAMP_WINDOW_MS);
  }
  
  // Layer 2: Check timestamp freshness
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
    errors.push('REPLAY_DETECTED: Stale timestamp');
  }
  
  // Layer 3: Check sequence number
  if (!sequences[conversationId]) {
    sequences[conversationId] = { sent: 0, received: 0 };
  }
  
  if (sequence <= sequences[conversationId].received) {
    errors.push('REPLAY_DETECTED: Invalid sequence number');
  } else {
    sequences[conversationId].received = sequence;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Get current sequence for a conversation
export function getSequence(conversationId) {
  return sequences[conversationId] || { sent: 0, received: 0 };
}

// Reset sequence (for testing or new session)
export function resetSequence(conversationId) {
  if (conversationId) {
    delete sequences[conversationId];
  } else {
    Object.keys(sequences).forEach(key => delete sequences[key]);
  }
}

// Clear all nonces (for testing)
export function clearNonces() {
  usedNonces.clear();
}
