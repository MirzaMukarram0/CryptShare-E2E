/**
 * File Service
 * ============
 * 
 * Handles encrypted file upload and download operations.
 * Works with conversation keys for encryption/decryption.
 * 
 * CHUNKING: Files > 5MB are processed in chunks for better memory management
 * and progress tracking. Each chunk is encrypted with a unique IV.
 */

import { 
  encryptFile, 
  decryptFile, 
  downloadDecryptedFile,
  arrayToBase64, 
  base64ToArray,
  formatFileSize 
} from '../crypto/fileEncryption';
import { getOrCreateConversationKey } from '../crypto/conversationKey';
import { getUser } from './api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Chunking configuration
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNK_THRESHOLD = 5 * 1024 * 1024; // Use chunking for files > 5MB

// Console logging styles
const LOG_STYLES = {
  header: 'background: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;',
  chunk: 'background: #8b5cf6; color: white; padding: 1px 6px; border-radius: 3px;'
};

/**
 * Encrypt a file in chunks (optimal for large files)
 * Each chunk gets its own IV, combined into single encrypted blob
 */
async function encryptFileInChunks(key, file, onProgress = () => {}) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const encryptedChunks = [];
  const chunkIVs = [];
  
  console.log('%c[CHUNKED] Processing ' + totalChunks + ' chunks...', LOG_STYLES.chunk);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkBuffer = await chunk.arrayBuffer();
    
    // Each chunk gets fresh IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    chunkIVs.push(iv);
    
    // Encrypt chunk
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      chunkBuffer
    );
    
    encryptedChunks.push(new Uint8Array(encryptedBuffer));
    
    // Progress: 10% for setup, 80% for encryption, 10% for upload
    const encryptProgress = 10 + Math.round(((i + 1) / totalChunks) * 40);
    onProgress(encryptProgress);
    
    console.log('%c    Chunk ' + (i + 1) + '/' + totalChunks + ' encrypted (' + formatFileSize(end - start) + ')', LOG_STYLES.detail);
  }
  
  // Combine all encrypted chunks into single blob
  const totalEncryptedSize = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combinedEncrypted = new Uint8Array(totalEncryptedSize);
  let offset = 0;
  
  for (const chunk of encryptedChunks) {
    combinedEncrypted.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Store chunk sizes for decryption (each chunk has 16-byte auth tag added by GCM)
  const chunkSizes = encryptedChunks.map(c => c.length);
  
  return {
    encryptedData: combinedEncrypted,
    chunkIVs,
    chunkSizes,
    metadata: {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      chunked: true,
      totalChunks,
      chunkSize: CHUNK_SIZE
    }
  };
}

/**
 * Decrypt a chunked file
 */
async function decryptFileInChunks(key, encryptedData, chunkIVs, chunkSizes, onProgress = () => {}) {
  const decryptedChunks = [];
  let offset = 0;
  
  console.log('%c[CHUNKED] Decrypting ' + chunkIVs.length + ' chunks...', LOG_STYLES.chunk);
  
  for (let i = 0; i < chunkIVs.length; i++) {
    const chunkSize = chunkSizes[i];
    const chunkData = encryptedData.slice(offset, offset + chunkSize);
    const iv = chunkIVs[i] instanceof Uint8Array ? chunkIVs[i] : new Uint8Array(chunkIVs[i]);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      chunkData
    );
    
    decryptedChunks.push(new Uint8Array(decryptedBuffer));
    offset += chunkSize;
    
    // Progress: 20% for download, 70% for decryption, 10% for save
    const decryptProgress = 20 + Math.round(((i + 1) / chunkIVs.length) * 70);
    onProgress(decryptProgress);
    
    console.log('%c    Chunk ' + (i + 1) + '/' + chunkIVs.length + ' decrypted', LOG_STYLES.detail);
  }
  
  // Combine decrypted chunks
  const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalSize);
  offset = 0;
  
  for (const chunk of decryptedChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  
  return combined.buffer;
}

/**
 * Upload an encrypted file (with automatic chunking for large files)
 * @param {string} myUserId - Current user's ID
 * @param {string} recipientId - Recipient's user ID
 * @param {File} file - File to encrypt and upload
 * @param {Function} onProgress - Progress callback
 * @returns {Object} { fileId, metadata }
 */
export async function uploadEncryptedFile(myUserId, recipientId, file, onProgress = () => {}) {
  const useChunking = file.size > CHUNK_THRESHOLD;
  
  console.log('%c📤 UPLOADING ENCRYPTED FILE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    File: ' + file.name, LOG_STYLES.info);
  console.log('%c    Size: ' + formatFileSize(file.size), LOG_STYLES.info);
  console.log('%c    Mode: ' + (useChunking ? 'CHUNKED (' + Math.ceil(file.size / CHUNK_SIZE) + ' chunks)' : 'SINGLE'), LOG_STYLES.info);
  console.log('%c    Recipient: ' + recipientId, LOG_STYLES.info);
  
  try {
    // Get recipient's public key
    console.log('%c[1] Fetching recipient public key...', LOG_STYLES.info);
    const recipientData = await getUser(recipientId);
    const recipientPublicKey = recipientData.publicKeys.keyExchange;
    onProgress(5);
    
    // Get or derive conversation key
    console.log('%c[2] Deriving conversation key...', LOG_STYLES.info);
    const conversationKey = await getOrCreateConversationKey(myUserId, recipientId, recipientPublicKey);
    onProgress(10);
    
    let encryptedData, iv, metadata, chunkInfo;
    
    if (useChunking) {
      // CHUNKED ENCRYPTION for large files
      console.log('%c[3] Encrypting file in chunks...', LOG_STYLES.chunk);
      const result = await encryptFileInChunks(conversationKey, file, onProgress);
      encryptedData = result.encryptedData;
      metadata = result.metadata;
      
      // For chunked files, we store chunk IVs and sizes in metadata
      chunkInfo = {
        ivs: result.chunkIVs.map(iv => arrayToBase64(iv)),
        sizes: result.chunkSizes
      };
      
      // Use first chunk's IV as the main IV (for backwards compatibility)
      iv = result.chunkIVs[0];
    } else {
      // SINGLE FILE ENCRYPTION for small files
      console.log('%c[3] Encrypting file...', LOG_STYLES.info);
      const result = await encryptFile(conversationKey, file);
      encryptedData = result.encryptedData;
      iv = result.iv;
      metadata = result.metadata;
      onProgress(50);
    }
    
    // Create FormData for upload
    console.log('%c[4] Preparing upload...', LOG_STYLES.info);
    const formData = new FormData();
    formData.append('file', new Blob([encryptedData]), 'encrypted');
    formData.append('iv', arrayToBase64(iv));
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('recipientId', recipientId);
    
    // Add chunk info if chunked
    if (chunkInfo) {
      formData.append('chunkInfo', JSON.stringify(chunkInfo));
    }
    
    onProgress(55);
    
    // Upload to server
    console.log('%c[5] Uploading to server (' + formatFileSize(encryptedData.length) + ')...', LOG_STYLES.info);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const result = await response.json();
    onProgress(100);
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE UPLOADED SUCCESSFULLY', LOG_STYLES.success);
    console.log('%c    File ID: ' + result.fileId, LOG_STYLES.detail);
    console.log('%c    Encrypted size: ' + formatFileSize(encryptedData.length), LOG_STYLES.detail);
    if (useChunking) {
      console.log('%c    Chunks: ' + metadata.totalChunks, LOG_STYLES.detail);
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return {
      fileId: result.fileId,
      metadata
    };
    
  } catch (error) {
    console.error('%c✗ File upload failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Download and decrypt a file (handles both chunked and single files)
 * @param {string} myUserId - Current user's ID
 * @param {string} fileId - File ID to download
 * @param {string} senderId - ID of the user who sent the file (for key derivation)
 * @param {Function} onProgress - Progress callback
 */
export async function downloadAndDecryptFile(myUserId, fileId, senderId, onProgress = () => {}) {
  console.log('%c📥 DOWNLOADING ENCRYPTED FILE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    File ID: ' + fileId, LOG_STYLES.info);
  
  try {
    const token = localStorage.getItem('token');
    
    // Get file info
    console.log('%c[1] Fetching file info...', LOG_STYLES.info);
    const infoResponse = await fetch(`${API_URL}/files/${fileId}/info`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!infoResponse.ok) {
      throw new Error('Failed to get file info');
    }
    
    const { iv, metadata, sender, chunkInfo } = await infoResponse.json();
    const isChunked = metadata.chunked && chunkInfo;
    
    console.log('%c    File: ' + metadata.name, LOG_STYLES.detail);
    console.log('%c    Size: ' + formatFileSize(metadata.size), LOG_STYLES.detail);
    console.log('%c    Mode: ' + (isChunked ? 'CHUNKED (' + metadata.totalChunks + ' chunks)' : 'SINGLE'), LOG_STYLES.detail);
    onProgress(5);
    
    // Use sender ID from file info if not provided
    const otherUserId = senderId || sender;
    
    // Get sender's public key for conversation key derivation
    console.log('%c[2] Fetching sender public key...', LOG_STYLES.info);
    const senderData = await getUser(otherUserId);
    const senderPublicKey = senderData.publicKeys.keyExchange;
    onProgress(10);
    
    // Get or derive conversation key
    console.log('%c[3] Deriving conversation key...', LOG_STYLES.info);
    const conversationKey = await getOrCreateConversationKey(myUserId, otherUserId, senderPublicKey);
    onProgress(15);
    
    // Download encrypted file
    console.log('%c[4] Downloading encrypted data...', LOG_STYLES.info);
    const fileResponse = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }
    
    const encryptedData = await fileResponse.arrayBuffer();
    console.log('%c    Downloaded: ' + formatFileSize(encryptedData.byteLength), LOG_STYLES.detail);
    onProgress(20);
    
    let decryptedData;
    
    if (isChunked) {
      // CHUNKED DECRYPTION
      console.log('%c[5] Decrypting file in chunks...', LOG_STYLES.chunk);
      const chunkIVs = chunkInfo.ivs.map(ivStr => base64ToArray(ivStr));
      decryptedData = await decryptFileInChunks(
        conversationKey, 
        encryptedData, 
        chunkIVs, 
        chunkInfo.sizes,
        onProgress
      );
    } else {
      // SINGLE FILE DECRYPTION
      console.log('%c[5] Decrypting file...', LOG_STYLES.info);
      const ivArray = base64ToArray(iv);
      decryptedData = await decryptFile(conversationKey, encryptedData, ivArray);
      onProgress(90);
    }
    
    // Trigger download
    console.log('%c[6] Triggering download...', LOG_STYLES.info);
    downloadDecryptedFile(decryptedData, metadata.name, metadata.type);
    onProgress(100);
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE DOWNLOADED AND DECRYPTED', LOG_STYLES.success);
    console.log('%c    Original size: ' + formatFileSize(metadata.size), LOG_STYLES.detail);
    if (isChunked) {
      console.log('%c    Chunks processed: ' + metadata.totalChunks, LOG_STYLES.detail);
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return { metadata, decryptedData };
    
  } catch (error) {
    console.error('%c✗ File download failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Get preview URL for an encrypted file (for images)
 * @param {string} myUserId - Current user's ID
 * @param {string} fileId - File ID
 * @param {string} senderId - Sender's user ID
 * @returns {Object} { url, metadata, cleanup }
 */
export async function getFilePreview(myUserId, fileId, senderId) {
  console.log('%c🖼️ Creating file preview...', LOG_STYLES.info);
  
  try {
    const token = localStorage.getItem('token');
    
    // Get file info
    const infoResponse = await fetch(`${API_URL}/files/${fileId}/info`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!infoResponse.ok) {
      throw new Error('Failed to get file info');
    }
    
    const { iv, metadata, sender } = await infoResponse.json();
    const otherUserId = senderId || sender;
    
    // Get conversation key
    const senderData = await getUser(otherUserId);
    const conversationKey = await getOrCreateConversationKey(myUserId, otherUserId, senderData.publicKeys.keyExchange);
    
    // Download encrypted file
    const fileResponse = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }
    
    const encryptedData = await fileResponse.arrayBuffer();
    
    // Decrypt file
    const ivArray = base64ToArray(iv);
    const decryptedData = await decryptFile(conversationKey, encryptedData, ivArray);
    
    // Create blob URL
    const blob = new Blob([decryptedData], { type: metadata.type });
    const url = URL.createObjectURL(blob);
    
    console.log('%c✓ Preview URL created', LOG_STYLES.success);
    
    return {
      url,
      metadata,
      cleanup: () => URL.revokeObjectURL(url)
    };
    
  } catch (error) {
    console.error('%c✗ Preview creation failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Get list of files shared with/by user
 * @returns {Array} List of file metadata
 */
export async function getSharedFiles() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/files`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Failed to fetch shared files:', error);
    throw error;
  }
}

export default {
  uploadEncryptedFile,
  downloadAndDecryptFile,
  getFilePreview,
  getSharedFiles
};
