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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CryptShare E2E Server is running' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room (for private messaging)
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // Relay encrypted message (server cannot decrypt)
  socket.on('message', (data) => {
    const { to, ciphertext, iv, timestamp, nonce, sequence } = data;
    
    // Forward to recipient (still encrypted)
    io.to(to).emit('message', {
      from: socket.userId,
      ciphertext,
      iv,
      timestamp,
      nonce,
      sequence
    });
  });

  // Key exchange messages
  socket.on('kex_init', (data) => {
    io.to(data.receiverId).emit('kex_init', data);
  });

  socket.on('kex_response', (data) => {
    io.to(data.receiverId).emit('kex_response', data);
  });

  socket.on('kex_confirm', (data) => {
    io.to(data.receiverId).emit('kex_confirm', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cryptshare-e2e')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`CryptShare E2E Server running on port ${PORT}`);
});

module.exports = { app, io };
