/**
 * Security Logging Service
 * =========================
 * 
 * Centralized logging for all security-relevant events.
 * 
 * IMPORTANT: Never log sensitive data like:
 * - Plaintext messages
 * - Passwords (even hashed)
 * - Private keys
 * - Session keys
 * - Full file contents
 */

const Log = require('../models/Log');

// Console colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Severity to color mapping
const severityColors = {
  DEBUG: colors.cyan,
  INFO: colors.green,
  WARNING: colors.yellow,
  ERROR: colors.red,
  CRITICAL: colors.red + colors.bright
};

// Event type to severity mapping
const eventSeverity = {
  // Authentication - INFO
  AUTH_REGISTER: 'INFO',
  AUTH_LOGIN: 'INFO',
  AUTH_LOGOUT: 'INFO',
  AUTH_LOGIN_FAILED: 'WARNING',
  AUTH_TOKEN_INVALID: 'WARNING',
  
  // Key Management - INFO
  KEY_UPDATE: 'INFO',
  KEY_GENERATION: 'INFO',
  KEY_EXCHANGE_INIT: 'INFO',
  KEY_EXCHANGE_RESPONSE: 'INFO',
  KEY_EXCHANGE_COMPLETE: 'INFO',
  KEY_EXCHANGE_FAILED: 'WARNING',
  
  // Messaging - DEBUG/INFO
  MESSAGE_SENT: 'DEBUG',
  MESSAGE_RECEIVED: 'DEBUG',
  MESSAGE_DECRYPTION_FAILED: 'ERROR',
  
  // Files - INFO
  FILE_UPLOADED: 'INFO',
  FILE_DOWNLOADED: 'INFO',
  FILE_ENCRYPTION_FAILED: 'ERROR',
  FILE_DECRYPTION_FAILED: 'ERROR',
  
  // Security Attacks - CRITICAL
  REPLAY_ATTACK_NONCE: 'CRITICAL',
  REPLAY_ATTACK_TIMESTAMP: 'CRITICAL',
  REPLAY_ATTACK_SEQUENCE: 'CRITICAL',
  MITM_ATTACK_DETECTED: 'CRITICAL',
  SIGNATURE_VERIFICATION_FAILED: 'CRITICAL',
  INVALID_TIMESTAMP: 'WARNING',
  INVALID_NONCE: 'WARNING',
  
  // Access Control - WARNING
  UNAUTHORIZED_ACCESS: 'WARNING',
  RATE_LIMIT_EXCEEDED: 'WARNING',
  
  // System - INFO
  SERVER_START: 'INFO',
  SERVER_SHUTDOWN: 'INFO',
  DATABASE_CONNECTED: 'INFO',
  DATABASE_ERROR: 'ERROR'
};

// Event type icons for console output
const eventIcons = {
  AUTH_REGISTER: '👤',
  AUTH_LOGIN: '🔓',
  AUTH_LOGIN_FAILED: '🔒',
  AUTH_LOGOUT: '🚪',
  AUTH_TOKEN_INVALID: '🚫',
  KEY_UPDATE: '🔑',
  KEY_GENERATION: '🔐',
  KEY_EXCHANGE_INIT: '🤝',
  KEY_EXCHANGE_RESPONSE: '🤝',
  KEY_EXCHANGE_COMPLETE: '✅',
  KEY_EXCHANGE_FAILED: '❌',
  MESSAGE_SENT: '📤',
  MESSAGE_RECEIVED: '📥',
  MESSAGE_DECRYPTION_FAILED: '⚠️',
  FILE_UPLOADED: '📁',
  FILE_DOWNLOADED: '📂',
  FILE_ENCRYPTION_FAILED: '⚠️',
  FILE_DECRYPTION_FAILED: '⚠️',
  REPLAY_ATTACK_NONCE: '🚨',
  REPLAY_ATTACK_TIMESTAMP: '🚨',
  REPLAY_ATTACK_SEQUENCE: '🚨',
  MITM_ATTACK_DETECTED: '🚨',
  SIGNATURE_VERIFICATION_FAILED: '🚨',
  INVALID_TIMESTAMP: '⏰',
  INVALID_NONCE: '🔢',
  UNAUTHORIZED_ACCESS: '🛑',
  RATE_LIMIT_EXCEEDED: '🚦',
  SERVER_START: '🚀',
  SERVER_SHUTDOWN: '🛑',
  DATABASE_CONNECTED: '💾',
  DATABASE_ERROR: '💥'
};

/**
 * Main logging function
 * @param {string} eventType - Type of event (from enum)
 * @param {Object} data - Event data
 * @param {string} data.userId - User ID (optional)
 * @param {string} data.targetUserId - Target user ID (optional)
 * @param {string} data.ipAddress - IP address (optional)
 * @param {string} data.userAgent - User agent string (optional)
 * @param {Object} data.details - Additional details (optional)
 * @param {boolean} data.success - Whether operation succeeded (optional)
 */
async function log(eventType, data = {}) {
  const severity = eventSeverity[eventType] || 'INFO';
  const icon = eventIcons[eventType] || '📝';
  const color = severityColors[severity] || colors.reset;
  
  // Console output
  const timestamp = new Date().toISOString();
  const logLine = `${color}[${severity}]${colors.reset} ${icon} ${eventType}`;
  
  console.log(`[${timestamp}] ${logLine}`);
  
  if (data.userId) {
    console.log(`    User: ${data.userId}`);
  }
  if (data.targetUserId) {
    console.log(`    Target: ${data.targetUserId}`);
  }
  if (data.details && Object.keys(data.details).length > 0) {
    // Sanitize details before logging
    const sanitized = sanitizeDetails(data.details);
    console.log(`    Details:`, sanitized);
  }
  
  // Database logging
  try {
    await Log.create({
      eventType,
      userId: data.userId || null,
      targetUserId: data.targetUserId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      details: sanitizeDetails(data.details || {}),
      severity,
      success: data.success !== undefined ? data.success : true,
      timestamp: new Date()
    });
  } catch (error) {
    console.error(`${colors.red}[LOG ERROR] Failed to save log to database:${colors.reset}`, error.message);
  }
}

/**
 * Sanitize details to remove sensitive information
 */
function sanitizeDetails(details) {
  const sanitized = { ...details };
  
  // List of sensitive fields to redact
  const sensitiveFields = [
    'password', 'passwordHash', 'privateKey', 'sessionKey',
    'ciphertext', 'plaintext', 'fileContent', 'encryptedData',
    'secret', 'token', 'key'
  ];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Truncate long strings (like nonces)
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string' && value.length > 32) {
      sanitized[key] = value.substring(0, 32) + '...';
    }
  }
  
  return sanitized;
}

/**
 * Convenience logging methods
 */

// Authentication events
async function logAuthRegister(userId, ipAddress, userAgent, username) {
  return log('AUTH_REGISTER', {
    userId,
    ipAddress,
    userAgent,
    details: { username },
    success: true
  });
}

async function logAuthLogin(userId, ipAddress, userAgent, username) {
  return log('AUTH_LOGIN', {
    userId,
    ipAddress,
    userAgent,
    details: { username },
    success: true
  });
}

async function logAuthLoginFailed(ipAddress, userAgent, username, reason) {
  return log('AUTH_LOGIN_FAILED', {
    ipAddress,
    userAgent,
    details: { username, reason },
    success: false
  });
}

// Key exchange events
async function logKeyExchangeInit(userId, targetUserId) {
  return log('KEY_EXCHANGE_INIT', {
    userId,
    targetUserId,
    details: { stage: 'KEX_INIT sent' },
    success: true
  });
}

async function logKeyExchangeComplete(userId, targetUserId) {
  return log('KEY_EXCHANGE_COMPLETE', {
    userId,
    targetUserId,
    details: { stage: 'Session established' },
    success: true
  });
}

async function logKeyExchangeFailed(userId, targetUserId, reason) {
  return log('KEY_EXCHANGE_FAILED', {
    userId,
    targetUserId,
    details: { reason },
    success: false
  });
}

// Security attack events
async function logReplayAttack(userId, attackType, details) {
  const eventType = `REPLAY_ATTACK_${attackType.toUpperCase()}`;
  return log(eventType, {
    userId,
    details: { attackType, ...details },
    success: false
  });
}

async function logMitmAttack(userId, targetUserId, details) {
  return log('MITM_ATTACK_DETECTED', {
    userId,
    targetUserId,
    details,
    success: false
  });
}

async function logSignatureVerificationFailed(userId, targetUserId, reason) {
  return log('SIGNATURE_VERIFICATION_FAILED', {
    userId,
    targetUserId,
    details: { reason },
    success: false
  });
}

// Message events
async function logMessageSent(userId, targetUserId) {
  return log('MESSAGE_SENT', {
    userId,
    targetUserId,
    details: { type: 'text' },
    success: true
  });
}

async function logMessageDecryptionFailed(userId, senderId, reason) {
  return log('MESSAGE_DECRYPTION_FAILED', {
    userId,
    targetUserId: senderId,
    details: { reason },
    success: false
  });
}

// File events
async function logFileUploaded(userId, targetUserId, fileId, filename, size) {
  return log('FILE_UPLOADED', {
    userId,
    targetUserId,
    details: { fileId, filename, size },
    success: true
  });
}

async function logFileDownloaded(userId, fileId, filename) {
  return log('FILE_DOWNLOADED', {
    userId,
    details: { fileId, filename },
    success: true
  });
}

// Access control events
async function logUnauthorizedAccess(userId, resource, ipAddress) {
  return log('UNAUTHORIZED_ACCESS', {
    userId,
    ipAddress,
    details: { resource },
    success: false
  });
}

/**
 * Get logs with filtering
 */
async function getLogs(filters = {}) {
  const query = {};
  
  if (filters.eventType) query.eventType = filters.eventType;
  if (filters.userId) query.userId = filters.userId;
  if (filters.severity) query.severity = filters.severity;
  if (filters.success !== undefined) query.success = filters.success;
  
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
    if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
  }
  
  return Log.find(query)
    .sort({ timestamp: -1 })
    .limit(filters.limit || 100)
    .populate('userId', 'username email')
    .populate('targetUserId', 'username email');
}

/**
 * Get security events (attacks, failures)
 */
async function getSecurityEvents(limit = 50) {
  return Log.find({
    $or: [
      { severity: 'CRITICAL' },
      { severity: 'ERROR' },
      { eventType: { $regex: /^REPLAY_ATTACK/ } },
      { eventType: 'MITM_ATTACK_DETECTED' },
      { eventType: 'SIGNATURE_VERIFICATION_FAILED' },
      { eventType: 'UNAUTHORIZED_ACCESS' }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'username email')
    .populate('targetUserId', 'username email');
}

/**
 * Get statistics
 */
async function getLogStats() {
  const stats = await Log.aggregate([
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const severityStats = await Log.aggregate([
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return { eventStats: stats, severityStats };
}

module.exports = {
  log,
  // Convenience methods
  logAuthRegister,
  logAuthLogin,
  logAuthLoginFailed,
  logKeyExchangeInit,
  logKeyExchangeComplete,
  logKeyExchangeFailed,
  logReplayAttack,
  logMitmAttack,
  logSignatureVerificationFailed,
  logMessageSent,
  logMessageDecryptionFailed,
  logFileUploaded,
  logFileDownloaded,
  logUnauthorizedAccess,
  // Query methods
  getLogs,
  getSecurityEvents,
  getLogStats
};
