/**
 * Secure Key Storage Module
 * Uses IndexedDB for persistent client-side storage
 * Private keys NEVER leave the client!
 */

const DB_NAME = 'CryptShareKeys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

// Open/Initialize IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save private key to IndexedDB
export async function savePrivateKey(keyId, privateKeyJwk) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const keyRecord = {
      id: keyId,
      key: privateKeyJwk,
      createdAt: Date.now()
    };
    
    const request = store.put(keyRecord);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Retrieve private key from IndexedDB
export async function getPrivateKey(keyId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(keyId);
    
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.key);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Delete private key from IndexedDB
export async function deletePrivateKey(keyId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(keyId);
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Check if private key exists
export async function hasPrivateKey(keyId) {
  const key = await getPrivateKey(keyId);
  return key !== null;
}

// Clear all keys (for logout/account deletion)
export async function clearAllKeys() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}
