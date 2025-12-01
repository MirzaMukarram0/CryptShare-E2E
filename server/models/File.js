const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Server-side filename (encrypted content)
  filename: {
    type: String,
    required: true
  },
  // IV used for encryption
  iv: {
    type: String,
    required: true
  },
  // Encrypted metadata (original name, type, size)
  metadata: {
    name: String,     // Original filename
    type: String,     // MIME type
    size: Number      // File size in bytes
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
fileSchema.index({ sender: 1, recipient: 1 });
fileSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model('File', fileSchema);
