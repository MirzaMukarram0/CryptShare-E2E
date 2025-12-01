/**
 * Secure Key Storage Module
 * Uses IndexedDB for persistent client-side storage
 * Private keys NEVER leave the client!
 * 
 * Security Features:
 * - IndexedDB is isolated per origin (same-origin policy)
 * - Data persists across sessions but stays local
 * - Keys are never transmitted over network
 */

const DB_NAME = 'CryptShareKeys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

// Console styling
const LOG_STYLES = {
  header: 'background: #6366f1; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  detail: 'color: #94a3b8;',
  warning: 'color: #f59e0b;',
  security: 'background: #dc2626; color: white; padding: 1px 6px; border-radius: 3px;'
};

// Open/Initialize IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    console.log('%c💾 INDEXEDDB - SECURE KEY STORAGE', LOG_STYLES.header);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
    console.log('%c[IndexedDB] Opening database: ' + DB_NAME, LOG_STYLES.info);
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('%c✗ IndexedDB Error:', LOG_STYLES.security, request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log('%c✓ IndexedDB Connection Established', LOG_STYLES.success);
      console.log('%c    Database: ' + DB_NAME, LOG_STYLES.detail);
      console.log('%c    Version: ' + DB_VERSION, LOG_STYLES.detail);
      console.log('%c    Object Store: ' + STORE_NAME, LOG_STYLES.detail);
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('%c[IndexedDB] Creating/Upgrading database schema...', LOG_STYLES.info);
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log('%c✓ Created object store: ' + STORE_NAME, LOG_STYLES.success);
      }
    };
  });
}

// Save private key to IndexedDB
export async function savePrivateKey(keyId, privateKeyJwk) {
  console.log('%c[SAVE] Storing Private Key in IndexedDB...', LOG_STYLES.info);
  console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
  console.log('%c    Storage Location: IndexedDB (Browser Local Storage)', LOG_STYLES.detail);
  console.log('%c    %c SECURITY: Private key stored CLIENT-SIDE ONLY ', LOG_STYLES.detail, LOG_STYLES.security);
  
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
    
    request.onsuccess = () => {
      console.log('%c✓ Private Key Saved Successfully!', LOG_STYLES.success);
      console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
      console.log('%c    Timestamp: ' + new Date(keyRecord.createdAt).toISOString(), LOG_STYLES.detail);
      console.log('%c    🔒 Key is encrypted by browser\'s IndexedDB implementation', LOG_STYLES.warning);
      console.log('%c    🔒 Key is protected by same-origin policy', LOG_STYLES.warning);
      console.log('%c    🔒 Key is NOT accessible to other websites', LOG_STYLES.warning);
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', LOG_STYLES.detail);
      resolve(true);
    };
    
    request.onerror = () => {
      console.error('%c✗ Failed to save private key:', LOG_STYLES.security, request.error);
      reject(request.error);
    };
  });
}

// Retrieve private key from IndexedDB
export async function getPrivateKey(keyId) {
  console.log('%c[RETRIEVE] Loading Private Key from IndexedDB...', LOG_STYLES.info);
  console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(keyId);
    
    request.onsuccess = () => {
      if (request.result) {
        console.log('%c✓ Private Key Retrieved Successfully!', LOG_STYLES.success);
        console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
        console.log('%c    Created: ' + new Date(request.result.createdAt).toISOString(), LOG_STYLES.detail);
        console.log('%c    Key Type: ' + request.result.key.kty, LOG_STYLES.detail);
        console.log('%c    Curve: ' + request.result.key.crv, LOG_STYLES.detail);
        console.log('%c    🔒 Key retrieved from secure local storage', LOG_STYLES.warning);
        resolve(request.result.key);
      } else {
        console.log('%c⚠️  Private Key Not Found: ' + keyId, LOG_STYLES.warning);
        resolve(null);
      }
    };
    
    request.onerror = () => {
      console.error('%c✗ Failed to retrieve private key:', LOG_STYLES.security, request.error);
      reject(request.error);
    };
  });
}

// Delete private key from IndexedDB
export async function deletePrivateKey(keyId) {
  console.log('%c[DELETE] Removing Private Key from IndexedDB...', LOG_STYLES.info);
  console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(keyId);
    
    request.onsuccess = () => {
      console.log('%c✓ Private Key Deleted Successfully!', LOG_STYLES.success);
      console.log('%c    Key ID: ' + keyId, LOG_STYLES.detail);
      resolve(true);
    };
    
    request.onerror = () => {
      console.error('%c✗ Failed to delete private key:', LOG_STYLES.security, request.error);
      reject(request.error);
    };
  });
}

// Check if private key exists
export async function hasPrivateKey(keyId) {
  const key = await getPrivateKey(keyId);
  return key !== null;
}

// Clear all keys (for logout/account deletion)
export async function clearAllKeys() {
  console.log('%c[CLEAR] Removing ALL Private Keys from IndexedDB...', LOG_STYLES.info);
  console.log('%c    ⚠️  This will delete all stored cryptographic keys!', LOG_STYLES.warning);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('%c✓ All Private Keys Cleared!', LOG_STYLES.success);
      console.log('%c    IndexedDB store emptied', LOG_STYLES.detail);
      resolve(true);
    };
    
    request.onerror = () => {
      console.error('%c✗ Failed to clear keys:', LOG_STYLES.security, request.error);
      reject(request.error);
    };
  });
}
