import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// Initialize socket connection
export function initSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }
  return socket;
}

// Join user's room for private messaging
export function joinRoom(userId) {
  if (socket) {
    socket.emit('join', userId);
    socket.userId = userId;
  }
}

// Send encrypted message
export function sendEncryptedMessage(recipientId, plaintext) {
  if (socket) {
    // TODO: Encrypt message before sending (Phase 4)
    // For now, send plaintext wrapped in a message object
    socket.emit('message', {
      to: recipientId,
      ciphertext: btoa(plaintext), // Temporary: base64 encode (NOT encryption!)
      iv: 'temp-iv',
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substr(2, 9),
      sequence: Date.now()
    });
  }
}

// Listen for incoming messages
export function onMessage(callback) {
  if (socket) {
    socket.on('message', (data) => {
      // TODO: Decrypt message (Phase 4)
      // For now, decode base64
      const plaintext = atob(data.ciphertext);
      callback({ ...data, plaintext });
    });
  }
}

// Key Exchange Events
export function sendKexInit(data) {
  if (socket) {
    socket.emit('kex_init', data);
  }
}

export function sendKexResponse(data) {
  if (socket) {
    socket.emit('kex_response', data);
  }
}

export function sendKexConfirm(data) {
  if (socket) {
    socket.emit('kex_confirm', data);
  }
}

export function onKexInit(callback) {
  if (socket) {
    socket.on('kex_init', callback);
  }
}

export function onKexResponse(callback) {
  if (socket) {
    socket.on('kex_response', callback);
  }
}

export function onKexConfirm(callback) {
  if (socket) {
    socket.on('kex_confirm', callback);
  }
}

// Disconnect socket
export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Get socket instance
export function getSocket() {
  return socket;
}
