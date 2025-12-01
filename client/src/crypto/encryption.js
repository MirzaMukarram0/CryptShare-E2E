/**
 * Encryption Module
 * AES-256-GCM for message and file encryption
 * Web Crypto API only!
 */

// Encrypt message with AES-256-GCM
export async function encryptMessage(sessionKey, plaintext) {
  // Generate fresh IV for EVERY message (CRITICAL!)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);
  
  // Encrypt with AES-GCM
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    sessionKey,
    plaintextBuffer
  );
  
  return {
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    iv: arrayToBase64(iv)
  };
}

// Decrypt message
export async function decryptMessage(sessionKey, ciphertextB64, ivB64) {
  const ciphertext = base64ToArray(ciphertextB64);
  const iv = base64ToArray(ivB64);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    sessionKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
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
