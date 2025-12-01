const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Log = require('../models/Log');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// POST /api/messages - Store encrypted message
router.post('/', async (req, res) => {
  try {
    const { recipientId, ciphertext, iv, nonce } = req.body;

    if (!recipientId || !ciphertext || !iv || !nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create message (only ciphertext stored)
    const message = await Message.create({
      sender: req.userId,
      recipient: recipientId,
      ciphertext,
      iv,
      nonce
    });

    // Log message sent (no plaintext!)
    await Log.create({
      eventType: 'MESSAGE_SENT',
      userId: req.userId,
      details: { recipientId, messageId: message._id },
      severity: 'INFO',
      success: true
    });

    res.status(201).json({
      message: 'Message stored',
      id: message._id,
      timestamp: message.timestamp
    });

  } catch (error) {
    console.error('Message storage error:', error);
    res.status(500).json({ error: 'Failed to store message' });
  }
});

// GET /api/messages/:recipientId - Get messages with a specific user
router.get('/:recipientId', async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      $or: [
        { sender: req.userId, recipient: recipientId },
        { sender: recipientId, recipient: req.userId }
      ]
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('sender recipient ciphertext iv nonce timestamp');

    res.json(messages.reverse());

  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
