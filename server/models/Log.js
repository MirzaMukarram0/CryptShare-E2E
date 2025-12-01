const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'AUTH_REGISTER',
      'AUTH_LOGIN',
      'AUTH_LOGIN_FAILED',
      'AUTH_LOGOUT',
      'KEY_EXCHANGE_INIT',
      'KEY_EXCHANGE_COMPLETE',
      'KEY_EXCHANGE_FAILED',
      'MESSAGE_SENT',
      'FILE_UPLOADED',
      'FILE_DOWNLOADED',
      'REPLAY_ATTACK_DETECTED',
      'SIGNATURE_VERIFICATION_FAILED',
      'INVALID_TIMESTAMP'
    ]
  },
  userId: {
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
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
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
