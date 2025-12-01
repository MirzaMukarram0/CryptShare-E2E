/**
 * Encryption Module
 * AES-256-GCM for message and file encryption
 * Web Crypto API only!
 */

// Console logging styles
const LOG_STYLES = {
  header: 'background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  warning: 'color: #f59e0b;',
  detail: 'color: #94a3b8;',
  crypto: 'background: #3b82f6; color: white; padding: 1px 6px; border-radius: 3px;'
};

// Encrypt message with AES-256-GCM
export async function encryptMessage(sessionKey, plaintext) {
  console.log('%c🔐 AES-256-GCM ENCRYPTION', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c[ENCRYPT] Encrypting message...', LOG_STYLES.info);
  
  const startTime = performance.now();
  
  // Generate fresh IV for EVERY message (CRITICAL!)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  console.log('%c[IV] Generated fresh 12-byte IV', LOG_STYLES.crypto);
  console.log('%c    ⚠️  NEVER reuse IV with same key!', LOG_STYLES.warning);
  
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);
  console.log('%c[PLAINTEXT] Size: ' + plaintextBuffer.length + ' bytes', LOG_STYLES.detail);
  
  try {
    // Encrypt with AES-GCM
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      sessionKey,
      plaintextBuffer
    );
    
    const endTime = performance.now();
    
    console.log('%c✓ Message encrypted successfully!', LOG_STYLES.success);
    console.log('%c    Algorithm: AES-256-GCM', LOG_STYLES.detail);
    console.log('%c    Ciphertext size: ' + ciphertext.byteLength + ' bytes (includes 16-byte auth tag)', LOG_STYLES.detail);
    console.log('%c    Encryption time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return {
      ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
      iv: arrayToBase64(iv)
    };
  } catch (error) {
    console.error('%c✗ Encryption failed:', LOG_STYLES.error, error);
    throw new Error('Message encryption failed');
  }
}

// Decrypt message
export async function decryptMessage(sessionKey, ciphertextB64, ivB64) {
  console.log('%c🔓 AES-256-GCM DECRYPTION', LOG_STYLES.header);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
  console.log('%c[DECRYPT] Decrypting message...', LOG_STYLES.info);
  
  const startTime = performance.now();
  
  try {
    const ciphertext = base64ToArray(ciphertextB64);
    const iv = base64ToArray(ivB64);
    
    console.log('%c[CIPHERTEXT] Size: ' + ciphertext.length + ' bytes', LOG_STYLES.detail);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      sessionKey,
      ciphertext
    );
    
    const endTime = performance.now();
    
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    
    console.log('%c✓ Message decrypted successfully!', LOG_STYLES.success);
    console.log('%c    Plaintext size: ' + plaintext.length + ' characters', LOG_STYLES.detail);
    console.log('%c    Decryption time: ' + (endTime - startTime).toFixed(2) + 'ms', LOG_STYLES.detail);
    console.log('%c    Authentication tag: VERIFIED ✓', LOG_STYLES.success);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    
    return plaintext;
  } catch (error) {
    console.error('%c✗ Decryption failed:', LOG_STYLES.error, error);
    console.error('%c    Possible causes: Wrong key, tampered message, or corrupted data', LOG_STYLES.detail);
    throw new Error('Message decryption failed - authentication tag mismatch');
  }
}

// Encrypt file with AES-256-GCM
export async function encryptFile(sessionKey, file) {
  const fileBuffer = await file.arrayBuffer();
  
  // Fresh IV for file encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    sessionKey,
    fileBuffer
  );
  
  return {
    encryptedData: new Uint8Array(encryptedBuffer),
    iv: iv,
    metadata: {
      name: file.name,
      type: file.type,
      size: file.size
    }
  };
}

// Decrypt file
export async function decryptFile(sessionKey, encryptedData, iv) {
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    sessionKey,
    encryptedData
  );
  
  return decryptedBuffer;
}

// Create downloadable blob from decrypted file
export function createDownloadableFile(decryptedBuffer, filename, mimeType) {
  const blob = new Blob([decryptedBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

// Helper: Convert Uint8Array to Base64
export function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr));
}

// Helper: Convert Base64 to Uint8Array
export function base64ToArray(base64) {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}
