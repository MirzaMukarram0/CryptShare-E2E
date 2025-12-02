const mongoose = require('mongoose');

// Define metadata subdocument schema explicitly
const metadataSchema = new mongoose.Schema({
  name: { type: String, default: 'unknown' },
  type: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  // Chunking metadata
  chunked: { type: Boolean, default: false },
  totalChunks: { type: Number, default: 0 },
  chunkSize: { type: Number, default: 0 }
}, { _id: false });

// Chunk info schema for storing IVs and sizes of each chunk
const chunkInfoSchema = new mongoose.Schema({
  ivs: [{ type: String }],   // Array of base64-encoded IVs
  sizes: [{ type: Number }]  // Array of chunk sizes (encrypted)
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
  // IV used for encryption (main IV for non-chunked, first chunk IV for chunked)
  iv: {
    type: String,
    required: true
  },
  // File metadata (original name, type, size)
  metadata: metadataSchema,
  // Chunk information (only for chunked files)
  chunkInfo: chunkInfoSchema,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
fileSchema.index({ sender: 1, recipient: 1 });
fileSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model('File', fileSchema);
