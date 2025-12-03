const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      // Authentication Events
      'AUTH_REGISTER',
      'AUTH_LOGIN',
      'AUTH_LOGIN_FAILED',
      'AUTH_LOGOUT',
      'AUTH_TOKEN_INVALID',
      
      // Key Management Events
      'KEY_UPDATE',
      'KEY_GENERATION',
      'KEY_EXCHANGE_INIT',
      'KEY_EXCHANGE_RESPONSE',
      'KEY_EXCHANGE_COMPLETE',
      'KEY_EXCHANGE_FAILED',
      
      // Messaging Events
      'MESSAGE_SENT',
      'MESSAGE_RECEIVED',
      'MESSAGE_DECRYPTION_FAILED',
      
      // File Events
      'FILE_UPLOADED',
      'FILE_DOWNLOADED',
      'FILE_ENCRYPTION_FAILED',
      'FILE_DECRYPTION_FAILED',
      
      // Security Attack Events
      'REPLAY_ATTACK_NONCE',
      'REPLAY_ATTACK_TIMESTAMP',
      'REPLAY_ATTACK_SEQUENCE',
      'MITM_ATTACK_DETECTED',
      'SIGNATURE_VERIFICATION_FAILED',
      'INVALID_TIMESTAMP',
      'INVALID_NONCE',
      
      // Access Control Events
      'UNAUTHORIZED_ACCESS',
      'RATE_LIMIT_EXCEEDED',
      
      // System Events
      'SERVER_START',
      'SERVER_SHUTDOWN',
      'DATABASE_CONNECTED',
      'DATABASE_ERROR'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  details: {
    type: Object,
    default: {}
  },
  severity: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    default: 'INFO'
  },
  success: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
logSchema.index({ eventType: 1 });
logSchema.index({ userId: 1 });
logSchema.index({ timestamp: -1 });
logSchema.index({ severity: 1 });

module.exports = mongoose.model('Log', logSchema);
