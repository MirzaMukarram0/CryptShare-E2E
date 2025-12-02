/**
 * File Encryption Module
 * ======================
 * 
 * Encrypts files client-side using AES-256-GCM before uploading.
 * Server only stores encrypted data - cannot see file contents.
 * 
 * Supports optional chunking for large files (>10MB).
 */

// Console logging styles
const LOG_STYLES = {
  header: 'background: #06b6d4; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;',
  crypto: 'background: #8b5cf6; color: white; padding: 1px 6px; border-radius: 3px;'
};

// Chunk size for large files (10MB)
const CHUNK_SIZE = 10 * 1024 * 1024;

/**
 * Encrypt a file with AES-256-GCM
 * @param {CryptoKey} key - AES-256-GCM key (from conversation key)
 * @param {File} file - File object to encrypt
 * @returns {Object} { encryptedData, iv, metadata }
 */
export async function encryptFile(key, file) {
  console.log('%c📁 ENCRYPTING FILE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    File: ' + file.name, LOG_STYLES.info);
  console.log('%c    Size: ' + formatFileSize(file.size), LOG_STYLES.info);
  console.log('%c    Type: ' + (file.type || 'unknown'), LOG_STYLES.info);
  
  const startTime = performance.now();
  
  try {
    // Read file as ArrayBuffer
    console.log('%c[1] Reading file into memory...', LOG_STYLES.info);
    const fileBuffer = await file.arrayBuffer();
    console.log('%c✓ File read complete', LOG_STYLES.success);
    
    // Generate fresh IV (12 bytes for GCM)
    console.log('%c[2] Generating fresh IV (12 bytes)...', LOG_STYLES.crypto);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    console.log('%c✓ IV generated', LOG_STYLES.success);
    
    // Encrypt with AES-256-GCM
    console.log('%c[3] Encrypting with AES-256-GCM...', LOG_STYLES.crypto);
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      fileBuffer
    );
    console.log('%c✓ Encryption complete', LOG_STYLES.success);
    
    const endTime = performance.now();
    const encryptedData = new Uint8Array(encryptedBuffer);
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE ENCRYPTED SUCCESSFULLY', LOG_STYLES.success);
    console.log('%c    Original size: ' + formatFileSize(file.size), LOG_STYLES.detail);
    console.log('%c    Encrypted size: ' + formatFileSize(encryptedData.length), LOG_STYLES.detail);
    console.log('%c    Encryption time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return {
      encryptedData,
      iv,
      metadata: {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size
      }
    };
    
  } catch (error) {
    console.error('%c✗ File encryption failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Decrypt a file with AES-256-GCM
 * @param {CryptoKey} key - AES-256-GCM key
 * @param {ArrayBuffer|Uint8Array} encryptedData - Encrypted file data
 * @param {Uint8Array} iv - Initialization vector
 * @returns {ArrayBuffer} Decrypted file data
 */
export async function decryptFile(key, encryptedData, iv) {
  console.log('%c📁 DECRYPTING FILE', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    Encrypted size: ' + formatFileSize(encryptedData.byteLength || encryptedData.length), LOG_STYLES.info);
  
  const startTime = performance.now();
  
  try {
    // Ensure IV is Uint8Array
    const ivArray = iv instanceof Uint8Array ? iv : new Uint8Array(iv);
    
    // Decrypt with AES-256-GCM
    console.log('%c[1] Decrypting with AES-256-GCM...', LOG_STYLES.crypto);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivArray },
      key,
      encryptedData
    );
    
    const endTime = performance.now();
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE DECRYPTED SUCCESSFULLY', LOG_STYLES.success);
    console.log('%c    Decrypted size: ' + formatFileSize(decryptedBuffer.byteLength), LOG_STYLES.detail);
    console.log('%c    Decryption time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return decryptedBuffer;
    
  } catch (error) {
    console.error('%c✗ File decryption failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Encrypt a large file in chunks
 * @param {CryptoKey} key - AES-256-GCM key
 * @param {File} file - File object to encrypt
 * @param {Function} onProgress - Progress callback (percent)
 * @returns {Object} { chunks, metadata }
 */
export async function encryptFileChunked(key, file, onProgress = () => {}) {
  console.log('%c📁 ENCRYPTING FILE (CHUNKED)', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c    File: ' + file.name, LOG_STYLES.info);
  console.log('%c    Size: ' + formatFileSize(file.size), LOG_STYLES.info);
  console.log('%c    Chunk size: ' + formatFileSize(CHUNK_SIZE), LOG_STYLES.info);
  
  const startTime = performance.now();
  const chunks = [];
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let offset = 0;
  let chunkIndex = 0;
  
  try {
    while (offset < file.size) {
      // Read chunk
      const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
      const chunkBuffer = await chunk.arrayBuffer();
      
      // Generate fresh IV for each chunk
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt chunk
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        chunkBuffer
      );
      
      chunks.push({
        data: new Uint8Array(encryptedBuffer),
        iv: iv,
        index: chunkIndex
      });
      
      offset += CHUNK_SIZE;
      chunkIndex++;
      
      // Report progress
      const progress = Math.round((offset / file.size) * 100);
      onProgress(Math.min(progress, 100));
      
      console.log('%c    Chunk ' + chunkIndex + '/' + totalChunks + ' encrypted', LOG_STYLES.detail);
    }
    
    const endTime = performance.now();
    
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c✓ FILE ENCRYPTED (CHUNKED)', LOG_STYLES.success);
    console.log('%c    Total chunks: ' + chunks.length, LOG_STYLES.detail);
    console.log('%c    Total time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return {
      chunks,
      metadata: {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        totalChunks: chunks.length
      }
    };
    
  } catch (error) {
    console.error('%c✗ Chunked file encryption failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Decrypt chunked file data
 * @param {CryptoKey} key - AES-256-GCM key
 * @param {Array} chunks - Array of { data, iv } chunks
 * @param {Function} onProgress - Progress callback
 * @returns {ArrayBuffer} Decrypted file data
 */
export async function decryptFileChunked(key, chunks, onProgress = () => {}) {
  console.log('%c📁 DECRYPTING FILE (CHUNKED)', LOG_STYLES.header);
  console.log('%c    Total chunks: ' + chunks.length, LOG_STYLES.info);
  
  const decryptedChunks = [];
  let totalSize = 0;
  
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const ivArray = chunk.iv instanceof Uint8Array ? chunk.iv : new Uint8Array(chunk.iv);
      
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivArray },
        key,
        chunk.data
      );
      
      decryptedChunks.push(new Uint8Array(decryptedBuffer));
      totalSize += decryptedBuffer.byteLength;
      
      onProgress(Math.round(((i + 1) / chunks.length) * 100));
    }
    
    // Combine chunks
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of decryptedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log('%c✓ File decrypted and reassembled', LOG_STYLES.success);
    return combined.buffer;
    
  } catch (error) {
    console.error('%c✗ Chunked file decryption failed:', LOG_STYLES.error, error);
    throw error;
  }
}

/**
 * Create a downloadable file from decrypted data
 * @param {ArrayBuffer} data - Decrypted file data
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 */
export function downloadDecryptedFile(data, filename, mimeType) {
  console.log('%c💾 Creating download for: ' + filename, LOG_STYLES.info);
  
  // Create blob
  const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  
  // Create and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  
  console.log('%c✓ Download triggered', LOG_STYLES.success);
}

/**
 * Create a blob URL for previewing decrypted data (images, etc.)
 * @param {ArrayBuffer} data - Decrypted file data
 * @param {string} mimeType - MIME type
 * @returns {string} Blob URL
 */
export function createPreviewUrl(data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} array - Byte array
 * @returns {string} Base64 encoded string
 */
export function arrayToBase64(array) {
  return btoa(String.fromCharCode.apply(null, array));
}

/**
 * Convert base64 string to Uint8Array
 * @param {string} base64 - Base64 encoded string
 * @returns {Uint8Array} Byte array
 */
export function base64ToArray(base64) {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

/**
 * Check if file should use chunked encryption
 * @param {File} file - File to check
 * @returns {boolean} True if file should be chunked
 */
export function shouldUseChunking(file) {
  return file.size > CHUNK_SIZE;
}

export default {
  encryptFile,
  decryptFile,
  encryptFileChunked,
  decryptFileChunked,
  downloadDecryptedFile,
  createPreviewUrl,
  formatFileSize,
  arrayToBase64,
  base64ToArray,
  shouldUseChunking
};
