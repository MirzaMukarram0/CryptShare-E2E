/**
 * Server-Side Replay Protection Middleware
 * =========================================
 * 
 * Triple-layer protection against replay attacks:
 * 1. Nonce - Reject duplicate nonces
 * 2. Timestamp - Reject stale messages (>5 minutes)
 * 3. Sequence - Reject out-of-order messages
 * 
 * In production, use Redis for nonce storage with TTL
 */

const Log = require('../models/Log');

// In-memory nonce store (use Redis in production)
const usedNonces = new Set();

// Sequence numbers per conversation
const sequenceNumbers = new Map();

// Configuration
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_CLEANUP_INTERVAL = 60 * 1000; // Clean up every minute

// Console logging styles
const LOG_PREFIX = '[REPLAY-PROTECTION]';

/**
 * Validate replay protection for messages
 */
function validateReplayProtection(req, res, next) {
  const { nonce, timestamp, sequence } = req.body;
  const conversationId = req.body.conversationId || `${req.userId}-${req.body.recipientId}`;
  
  console.log(`${LOG_PREFIX} Validating message...`);
  console.log(`${LOG_PREFIX}   Nonce: ${nonce?.substring(0, 16)}...`);
  console.log(`${LOG_PREFIX}   Timestamp: ${timestamp}`);
  console.log(`${LOG_PREFIX}   Sequence: ${sequence}`);
  
  const errors = [];
  
  // Layer 1: Nonce Uniqueness Check
  if (!nonce) {
    errors.push('Missing nonce');
  } else if (usedNonces.has(nonce)) {
    console.log(`${LOG_PREFIX} ⚠️ REPLAY ATTACK DETECTED: Duplicate nonce!`);
    errors.push('REPLAY_ATTACK: Duplicate nonce detected');
    
    // Log security event
    logSecurityEvent(req.userId, 'REPLAY_ATTACK_NONCE', { nonce: nonce.substring(0, 16) });
  }
  
  // Layer 2: Timestamp Freshness Check
  if (!timestamp) {
    errors.push('Missing timestamp');
  } else {
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    
    if (age > TIMESTAMP_WINDOW_MS) {
      console.log(`${LOG_PREFIX} ⚠️ REPLAY ATTACK DETECTED: Stale timestamp (${Math.round(age / 1000)}s old)!`);
      errors.push(`REPLAY_ATTACK: Stale timestamp (${Math.round(age / 1000)}s old, max ${TIMESTAMP_WINDOW_MS / 1000}s)`);
      
      // Log security event
      logSecurityEvent(req.userId, 'REPLAY_ATTACK_TIMESTAMP', { age, timestamp });
    }
  }
  
  // Layer 3: Sequence Number Check
  if (sequence !== undefined) {
    const lastSeq = sequenceNumbers.get(conversationId) || 0;
    
    if (sequence <= lastSeq) {
      console.log(`${LOG_PREFIX} ⚠️ REPLAY ATTACK DETECTED: Invalid sequence (${sequence} <= ${lastSeq})!`);
      errors.push(`REPLAY_ATTACK: Invalid sequence number (received ${sequence}, expected > ${lastSeq})`);
      
      // Log security event
      logSecurityEvent(req.userId, 'REPLAY_ATTACK_SEQUENCE', { sequence, lastSeq, conversationId });
    }
  }
  
  // If any errors, reject the request
  if (errors.length > 0) {
    console.log(`${LOG_PREFIX} ❌ Message rejected:`, errors);
    return res.status(400).json({
      error: 'Replay attack detected',
      details: errors
    });
  }
  
  // All checks passed - update tracking
  if (nonce) {
    usedNonces.add(nonce);
    // Schedule nonce cleanup
    setTimeout(() => usedNonces.delete(nonce), TIMESTAMP_WINDOW_MS);
  }
  
  if (sequence !== undefined) {
    sequenceNumbers.set(conversationId, sequence);
  }
  
  console.log(`${LOG_PREFIX} ✓ Message validated successfully`);
  next();
}

/**
 * Validate replay protection for Socket.IO messages
 * Returns validation result instead of sending response
 */
function validateSocketMessage(message, senderId, recipientId) {
  const { nonce, timestamp, sequence } = message;
  const conversationId = [senderId, recipientId].sort().join('-');
  
  console.log(`${LOG_PREFIX} [Socket] Validating message...`);
  
  const errors = [];
  
  // Layer 1: Nonce check
  if (nonce && usedNonces.has(nonce)) {
    console.log(`${LOG_PREFIX} ⚠️ [Socket] REPLAY ATTACK: Duplicate nonce!`);
    errors.push('Duplicate nonce');
    logSecurityEvent(senderId, 'REPLAY_ATTACK_NONCE', { nonce: nonce.substring(0, 16) });
  }
  
  // Layer 2: Timestamp check
  if (timestamp) {
    const age = Math.abs(Date.now() - timestamp);
    if (age > TIMESTAMP_WINDOW_MS) {
      console.log(`${LOG_PREFIX} ⚠️ [Socket] REPLAY ATTACK: Stale timestamp!`);
      errors.push('Stale timestamp');
      logSecurityEvent(senderId, 'REPLAY_ATTACK_TIMESTAMP', { age, timestamp });
    }
  }
  
  // Layer 3: Sequence check
  if (sequence !== undefined) {
    const lastSeq = sequenceNumbers.get(conversationId) || 0;
    if (sequence <= lastSeq) {
      console.log(`${LOG_PREFIX} ⚠️ [Socket] REPLAY ATTACK: Invalid sequence!`);
      errors.push('Invalid sequence');
      logSecurityEvent(senderId, 'REPLAY_ATTACK_SEQUENCE', { sequence, lastSeq });
    }
  }
  
  // Update tracking if valid
  if (errors.length === 0) {
    if (nonce) {
      usedNonces.add(nonce);
      setTimeout(() => usedNonces.delete(nonce), TIMESTAMP_WINDOW_MS);
    }
    if (sequence !== undefined) {
      sequenceNumbers.set(conversationId, sequence);
    }
    console.log(`${LOG_PREFIX} ✓ [Socket] Message validated`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Log security event to database
 */
async function logSecurityEvent(userId, eventType, details) {
  try {
    await Log.create({
      eventType,
      userId,
      details,
      severity: 'WARNING',
      success: false
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to log security event:`, err);
  }
}

/**
 * Get replay protection stats (for monitoring)
 */
function getStats() {
  return {
    activeNonces: usedNonces.size,
    trackedConversations: sequenceNumbers.size,
    timestampWindow: TIMESTAMP_WINDOW_MS
  };
}

/**
 * Clear all tracking (for testing)
 */
function clearAll() {
  usedNonces.clear();
  sequenceNumbers.clear();
  console.log(`${LOG_PREFIX} All tracking cleared`);
}

module.exports = {
  validateReplayProtection,
  validateSocketMessage,
  getStats,
  clearAll
};
