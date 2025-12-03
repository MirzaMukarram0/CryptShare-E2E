const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const fileRoutes = require('./routes/files');
const logsRoutes = require('./routes/logs');
const Message = require('./models/Message');
const { validateSocketMessage } = require('./middleware/replayProtection');
const logger = require('./services/logger');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/logs', logsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CryptShare E2E Server is running' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room (for private messaging)
  socket.on('join', (userId) => {
    socket.userId = userId; // Store userId on socket for message relay
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // Relay encrypted message (server cannot decrypt)
  socket.on('message', async (data) => {
    const { to, ciphertext, iv, timestamp, nonce, sequence } = data;
    
    console.log(`[Message] Encrypted message from ${socket.userId} to ${to}`);
    
    // Validate replay protection
    const validation = validateSocketMessage(
      { nonce, timestamp, sequence },
      socket.userId,
      to
    );
    
    if (!validation.valid) {
      console.log(`[Message] ⚠️ REPLAY ATTACK BLOCKED:`, validation.errors);
      
      // Log each type of replay attack
      for (const error of validation.errors) {
        if (error.includes('nonce')) {
          await logger.logReplayAttack(socket.userId, 'nonce', { nonce: nonce?.substring(0, 16), targetUserId: to });
        } else if (error.includes('timestamp')) {
          await logger.logReplayAttack(socket.userId, 'timestamp', { timestamp, targetUserId: to });
        } else if (error.includes('sequence')) {
          await logger.logReplayAttack(socket.userId, 'sequence', { sequence, targetUserId: to });
        }
      }
      
      socket.emit('message_error', {
        error: 'Replay attack detected',
        details: validation.errors
      });
      return;
    }
    
    // Log successful message
    await logger.logMessageSent(socket.userId, to);
    
    // Forward to recipient (still encrypted)
    io.to(to).emit('message', {
      from: socket.userId,
      ciphertext,
      iv,
      timestamp,
      nonce,
      sequence
    });
    
    // Store encrypted message in MongoDB
    // Server cannot decrypt - only stores ciphertext + metadata
    try {
      await Message.create({
        sender: socket.userId,
        recipient: to,
        ciphertext,
        iv,
        nonce: nonce || '',
        timestamp: new Date(timestamp)
      });
      console.log(`[Message] Encrypted message stored in MongoDB`);
    } catch (error) {
      console.error('[Message] Failed to store message:', error);
    }
  });

  // Key exchange messages with logging
  socket.on('kex_init', async (data) => {
    await logger.logKeyExchangeInit(data.senderId, data.receiverId);
    io.to(data.receiverId).emit('kex_init', data);
  });

  socket.on('kex_response', async (data) => {
    await logger.log('KEY_EXCHANGE_RESPONSE', {
      userId: data.senderId,
      targetUserId: data.receiverId,
      details: { stage: 'KEX_RESPONSE sent' }
    });
    io.to(data.receiverId).emit('kex_response', data);
  });

  socket.on('kex_confirm', async (data) => {
    await logger.logKeyExchangeComplete(data.senderId, data.receiverId);
    io.to(data.receiverId).emit('kex_confirm', data);
  });

  // File sharing notification
  socket.on('file_shared', async (data) => {
    const { to, fileId, metadata, timestamp } = data;
    
    console.log(`[File] File shared from ${socket.userId} to ${to}: ${metadata.name}`);
    
    // Log file share event
    await logger.logFileUploaded(socket.userId, to, fileId, metadata.name, metadata.size);
    
    // Notify recipient about shared file
    io.to(to).emit('file_shared', {
      from: socket.userId,
      fileId,
      metadata,
      timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Connect to MongoDB with retry logic
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cryptshare-e2e';
  
  const options = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
    maxPoolSize: 10,
    retryWrites: true
  };
  
  try {
    await mongoose.connect(mongoUri, options);
    console.log('Connected to MongoDB');
    // Log database connection
    await logger.log('DATABASE_CONNECTED', { details: { uri: mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') } });
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    await logger.log('DATABASE_ERROR', { details: { error: err.message }, success: false });
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', async (err) => {
  console.error('MongoDB error:', err.message);
  await logger.log('DATABASE_ERROR', { details: { error: err.message }, success: false });
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectDB, 5000);
});

connectDB();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`CryptShare E2E Server running on port ${PORT}`);
  // Log server start
  await logger.log('SERVER_START', { details: { port: PORT } });
});

module.exports = { app, io };
