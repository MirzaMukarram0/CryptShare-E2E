const mongoose = require('mongoose');

// Define metadata subdocument schema explicitly
const metadataSchema = new mongoose.Schema({
  name: { type: String, default: 'unknown' },
  type: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 }
}, { _id: false });

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
  // File metadata (original name, type, size)
  metadata: metadataSchema,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
fileSchema.index({ sender: 1, recipient: 1 });
fileSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model('File', fileSchema);
