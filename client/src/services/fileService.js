/**
 * File Service
 * ============
 * 
 * Handles encrypted file upload and download operations.
 * Works with conversation keys for encryption/decryption.
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

// Console logging styles
const LOG_STYLES = {
  header: 'background: #f97316; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;'
};

/**
 * Upload an encrypted file
 * @param {string} myUserId - Current user's ID
 * @param {string} recipientId - Recipient's user ID
 * @param {File} file - File to encrypt and upload
 * @param {Function} onProgress - Progress callback
 * @returns {Object} { fileId, metadata }
 */
export async function uploadEncryptedFile(myUserId, recipientId, file, onProgress = () => {}) {
  console.log('%c📤 UPLOADING ENCRYPTED FILE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    File: ' + file.name, LOG_STYLES.info);
  console.log('%c    Size: ' + formatFileSize(file.size), LOG_STYLES.info);
  console.log('%c    Recipient: ' + recipientId, LOG_STYLES.info);
  
  try {
    // Get recipient's public key
    console.log('%c[1] Fetching recipient public key...', LOG_STYLES.info);
    const recipientData = await getUser(recipientId);
    const recipientPublicKey = recipientData.publicKeys.keyExchange;
    
    // Get or derive conversation key
    console.log('%c[2] Deriving conversation key...', LOG_STYLES.info);
    const conversationKey = await getOrCreateConversationKey(myUserId, recipientId, recipientPublicKey);
    
    // Encrypt file
    console.log('%c[3] Encrypting file...', LOG_STYLES.info);
    onProgress(10);
    const { encryptedData, iv, metadata } = await encryptFile(conversationKey, file);
    onProgress(50);
    
    // Create FormData for upload
    console.log('%c[4] Preparing upload...', LOG_STYLES.info);
    const formData = new FormData();
    formData.append('file', new Blob([encryptedData]), 'encrypted');
    formData.append('iv', arrayToBase64(iv));
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('recipientId', recipientId);
    
    // Upload to server
    console.log('%c[5] Uploading to server...', LOG_STYLES.info);
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
 * Download and decrypt a file
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
    
    const { iv, metadata, sender } = await infoResponse.json();
    console.log('%c    File: ' + metadata.name, LOG_STYLES.detail);
    console.log('%c    Size: ' + formatFileSize(metadata.size), LOG_STYLES.detail);
    onProgress(10);
    
    // Use sender ID from file info if not provided
    const otherUserId = senderId || sender;
    
    // Get sender's public key for conversation key derivation
    console.log('%c[2] Fetching sender public key...', LOG_STYLES.info);
    const senderData = await getUser(otherUserId);
    const senderPublicKey = senderData.publicKeys.keyExchange;
    
    // Get or derive conversation key
    console.log('%c[3] Deriving conversation key...', LOG_STYLES.info);
    const conversationKey = await getOrCreateConversationKey(myUserId, otherUserId, senderPublicKey);
    onProgress(20);
    
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
    onProgress(60);
    
    // Decrypt file
    console.log('%c[5] Decrypting file...', LOG_STYLES.info);
    const ivArray = base64ToArray(iv);
    const decryptedData = await decryptFile(conversationKey, encryptedData, ivArray);
    onProgress(90);
    
    // Trigger download
    console.log('%c[6] Triggering download...', LOG_STYLES.info);
    downloadDecryptedFile(decryptedData, metadata.name, metadata.type);
    onProgress(100);
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE DOWNLOADED AND DECRYPTED', LOG_STYLES.success);
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
