import { io } from 'socket.io-client';
import { encryptMessage, decryptMessage } from '../crypto/encryption';
import { getOrCreateConversationKey } from '../crypto/conversationKey';
import { getUser } from './api';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let currentUserId = null;

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
    currentUserId = userId;
  }
}

// Send encrypted message
export async function sendEncryptedMessage(recipientId, plaintext) {
  if (!socket) {
    console.error('[Socket] Cannot send message: socket not connected');
    return;
  }
  
  try {
    // Get recipient's public key from API to derive conversation key
    const recipientData = await getUser(recipientId);
    const recipientPublicKeyExchange = recipientData.publicKeys.keyExchange;
    
    // Get or derive conversation key (persistent across sessions)
    const conversationKey = await getOrCreateConversationKey(currentUserId, recipientId, recipientPublicKeyExchange);
    
    // Encrypt the message
    const { ciphertext, iv } = await encryptMessage(conversationKey, plaintext);
    
    console.log('[Socket] Sending encrypted message to:', recipientId);
    
    // Send encrypted message
    socket.emit('message', {
      to: recipientId,
      ciphertext,
      iv,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[Socket] Failed to send encrypted message:', error);
    throw error;
  }
}

// Listen for incoming messages
export function onMessage(callback) {
  if (socket) {
    // Remove any existing listener to prevent duplicates
    socket.off('message');
    
    socket.on('message', async (data) => {
      console.log('[Socket] Received encrypted message from:', data.from);
      
      try {
        // Get sender's public key from API to derive conversation key
        const senderData = await getUser(data.from);
        const senderPublicKeyExchange = senderData.publicKeys.keyExchange;
        
        // Get or derive conversation key (persistent across sessions)
        const conversationKey = await getOrCreateConversationKey(currentUserId, data.from, senderPublicKeyExchange);
        
        // Decrypt the message
        const plaintext = await decryptMessage(conversationKey, data.ciphertext, data.iv);
        
        console.log('[Socket] Message decrypted successfully');
        
        // Call callback with decrypted message
        callback({ ...data, plaintext, decrypted: true });
        
      } catch (error) {
        console.error('[Socket] Decryption failed:', error);
        callback({ ...data, plaintext: '[Decryption failed]', error: true });
      }
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

// Listen for file sharing notifications
export function onFileShared(callback) {
  const sock = initSocket();
  sock.off('file_shared');
  sock.on('file_shared', (data) => {
    console.log('[Socket] Received file_shared from:', data.from);
    callback(data);
  });
}

// Emit file shared notification
export function emitFileShared(data) {
  if (socket) {
    console.log('[Socket] Sending file_shared to:', data.to);
    socket.emit('file_shared', data);
  }
}

// Listen for message errors (e.g., replay attack detection)
export function onMessageError(callback) {
  const sock = initSocket();
  sock.off('message_error');
  sock.on('message_error', (data) => {
    console.error('[Socket] Message error:', data);
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
