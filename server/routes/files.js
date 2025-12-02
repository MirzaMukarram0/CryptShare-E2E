const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const Log = require('../models/Log');
const { authenticate } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes require authentication
router.use(authenticate);

// POST /api/files/upload - Upload encrypted file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { iv, metadata, recipientId } = req.body;

    if (!req.file || !iv || !metadata || !recipientId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let parsedMetadata;
    try {
      parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid metadata format' });
    }

    // Create file record with explicit metadata fields
    const file = await File.create({
      sender: req.userId,
      recipient: recipientId,
      filename: req.file.filename,
      iv,
      metadata: {
        name: parsedMetadata.name || 'unknown',
        type: parsedMetadata.type || 'application/octet-stream',
        size: parsedMetadata.size || 0
      }
    });

    // Log file upload
    await Log.create({
      eventType: 'FILE_UPLOADED',
      userId: req.userId,
      details: {
        fileId: file._id,
        recipientId,
        originalName: parsedMetadata.name,
        size: parsedMetadata.size
      },
      severity: 'INFO',
      success: true
    });

    res.status(201).json({
      message: 'File uploaded',
      fileId: file._id
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/files/:id/info - Get file metadata
router.get('/:id/info', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is sender or recipient
    if (file.sender.toString() !== req.userId && file.recipient.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      iv: file.iv,
      metadata: file.metadata,
      sender: file.sender,
      uploadedAt: file.uploadedAt
    });

  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// GET /api/files/:id/download - Download encrypted file
router.get('/:id/download', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is sender or recipient
    if (file.sender.toString() !== req.userId && file.recipient.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(__dirname, '../uploads', file.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Log file download
    await Log.create({
      eventType: 'FILE_DOWNLOADED',
      userId: req.userId,
      details: { fileId: file._id },
      severity: 'INFO',
      success: true
    });

    res.sendFile(filePath);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// GET /api/files - Get files shared with/by user
router.get('/', async (req, res) => {
  try {
    const files = await File.find({
      $or: [
        { sender: req.userId },
        { recipient: req.userId }
      ]
    })
    .sort({ uploadedAt: -1 })
    .select('sender recipient metadata uploadedAt');

    res.json(files);

  } catch (error) {
    console.error('Fetch files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET /api/files/peer/:peerId - Get files shared with a specific peer
router.get('/peer/:peerId', async (req, res) => {
  try {
    const { peerId } = req.params;
    
    const files = await File.find({
      $or: [
        { sender: req.userId, recipient: peerId },
        { sender: peerId, recipient: req.userId }
      ]
    })
    .sort({ uploadedAt: -1 })
    .select('sender recipient metadata uploadedAt iv');

    res.json(files);

  } catch (error) {
    console.error('Fetch peer files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

module.exports = router;
