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
    console.log('[Socket] Sending kex_init to:', data.receiverId);
    socket.emit('kex_init', data);
  } else {
    console.error('[Socket] Cannot send kex_init: socket not connected');
  }
}

export function sendKexResponse(data) {
  if (socket) {
    console.log('[Socket] Sending kex_response to:', data.receiverId);
    socket.emit('kex_response', data);
  } else {
    console.error('[Socket] Cannot send kex_response: socket not connected');
  }
}

export function sendKexConfirm(data) {
  if (socket) {
    console.log('[Socket] Sending kex_confirm to:', data.receiverId);
    socket.emit('kex_confirm', data);
  } else {
    console.error('[Socket] Cannot send kex_confirm: socket not connected');
  }
}

export function onKexInit(callback) {
  const sock = initSocket(); // Ensure socket exists
  sock.off('kex_init'); // Remove any existing listener
  sock.on('kex_init', (data) => {
    console.log('[Socket] Received kex_init from:', data.senderId);
    callback(data);
  });
}

export function onKexResponse(callback) {
  const sock = initSocket(); // Ensure socket exists
  sock.off('kex_response'); // Remove any existing listener
  sock.on('kex_response', (data) => {
    console.log('[Socket] Received kex_response from:', data.senderId);
    callback(data);
  });
}

export function onKexConfirm(callback) {
  const sock = initSocket(); // Ensure socket exists
  sock.off('kex_confirm'); // Remove any existing listener
  sock.on('kex_confirm', (data) => {
    console.log('[Socket] Received kex_confirm from:', data.senderId);
    callback(data);
  });
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
