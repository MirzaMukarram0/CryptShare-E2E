import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { getUsers, getUser } from '../services/api';
import { initSocket, joinRoom, onMessage, disconnect, onKexInit, onKexResponse, onKexConfirm, sendKexInit, sendKexResponse, sendKexConfirm, getSocket, onFileShared, emitFileShared } from '../services/socket';
import { Avatar } from './common';
import { getPrivateKey } from '../crypto/keyStore';
import { encryptMessage, decryptMessage } from '../crypto/encryption';
import { deriveConversationKey } from '../crypto/conversationKey';
import { 
  generateEphemeralKeyPair, 
  createKexInit, 
  processKexInitAndCreateResponse, 
  processKexResponseAndCreateConfirm, 
  processKexConfirm 
} from '../crypto/keyExchange';
import { 
  storeSessionKey, 
  hasSessionKey, 
  storePendingKex, 
  getPendingKex, 
  removePendingKex,
  clearAllSessionKeys 
} from '../crypto/sessionKeyStore';
import { FileUploadButton, FileShareModal, FileMessage, useFileHandler } from './FileShare';
import { addReplayProtection } from '../utils/replayProtection';

// Memoized user list item component
const UserListItem = memo(function UserListItem({ user, isSelected, onSelect }) {
  const handleClick = useCallback(() => {
    onSelect(user);
  }, [user, onSelect]);

  return (
    <div
      className={`user-item ${isSelected ? 'active' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-pressed={isSelected}
    >
      <Avatar username={user.username} status={user.status} />
      <div className="user-info">
        <div className="user-name">{user.username}</div>
        <div className={`user-status ${user.status || 'offline'}`}>
          {user.status || 'offline'}
        </div>
      </div>
    </div>
  );
});

// Memoized message bubble component
const MessageBubble = memo(function MessageBubble({ message, onFileDownload, downloading }) {
  // Check if this is a file message
  if (message.type === 'file') {
    return (
      <FileMessage
        file={message.file}
        sent={message.sent}
        onDownload={onFileDownload}
        downloading={downloading}
      />
    );
  }
  
  return (
    <div className={`message ${message.sent ? 'sent' : 'received'} ${message.error ? 'error' : ''}`}>
      <div className="message-bubble">
        {message.text}
        {message.error && <span className="message-error-icon" title="Decryption failed"> ⚠️</span>}
      </div>
    </div>
  );
});

// Memoized empty state component
const EmptyState = memo(function EmptyState({ username }) {
  return (
    <div className="no-chat">
      <h2>Welcome, {username}</h2>
      <p>Select a contact to start an encrypted conversation</p>
    </div>
  );
});

// Memoized encryption status component
const EncryptionStatus = memo(function EncryptionStatus({ status, peerStatus }) {
  const statusText = {
    pending: peerStatus === 'offline' ? 'Peer Offline - Waiting...' : 'Establishing Encryption...',
    exchanging: 'Key Exchange in Progress...',
    complete: 'End-to-End Encrypted',
    error: 'Encryption Failed'
  };
  
  return (
    <span className={`encryption-status ${status}`}>
      {statusText[status] || statusText.pending}
    </span>
  );
});

// Memoized chat header component
const ChatHeader = memo(function ChatHeader({ user, encryptionStatus }) {
  return (
    <div className="chat-header">
      <Avatar username={user.username} status={user.status} />
      <h3>{user.username}</h3>
      <EncryptionStatus status={encryptionStatus} peerStatus={user.status} />
    </div>
  );
});

function Chat({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [encryptionStatus, setEncryptionStatus] = useState({});
  const [showFileModal, setShowFileModal] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const ephemeralKeysRef = useRef(new Map()); // Store ephemeral keys during exchange
  const conversationKeysRef = useRef(new Map()); // Cache conversation keys
  
  // File download handler
  const { downloading, handleDownload } = useFileHandler(user.id);

  // Console logging styles
  const LOG_STYLES = useMemo(() => ({
    header: 'background: #ec4899; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
    info: 'color: #60a5fa;',
    success: 'color: #22c55e; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
    detail: 'color: #94a3b8;'
  }), []);

  // Get or derive conversation key for a peer
  const getConversationKey = useCallback(async (peerId, peerPublicKeys = null) => {
    // Check cache first
    if (conversationKeysRef.current.has(peerId)) {
      return conversationKeysRef.current.get(peerId);
    }
    
    // If peerPublicKeys not provided, fetch from API
    let publicKeys = peerPublicKeys;
    if (!publicKeys) {
      const peerData = await getUser(peerId);
      publicKeys = peerData.publicKeys;
    }
    
    // Derive new conversation key
    const convKey = await deriveConversationKey(user.id, publicKeys.keyExchange);
    conversationKeysRef.current.set(peerId, convKey);
    return convKey;
  }, [user.id]);

  // Get my signing private key from IndexedDB
  const getMySigningKey = useCallback(async () => {
    const signingKey = await getPrivateKey(`${user.id}_signing`);
    if (!signingKey) {
      console.error('%c✗ Signing key not found in IndexedDB!', LOG_STYLES.error);
      throw new Error('Signing key not found');
    }
    return signingKey;
  }, [user.id, LOG_STYLES.error]);

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userList = await getUsers();
        setUsers(userList.filter(u => u._id !== user.id));
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [user.id]);

  // Key Exchange Protocol Handlers
  const initiateKeyExchange = useCallback(async (peerId, peerPublicKeys) => {
    console.log('%c🔄 CHAT: Initiating CryptShare-KEX', LOG_STYLES.header);
    console.log('%c    With peer: ' + peerId, LOG_STYLES.detail);
    
    // Check if we already have a session key
    if (hasSessionKey(peerId)) {
      console.log('%c✓ Session key already exists, skipping KEX', LOG_STYLES.success);
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      return;
    }
    
    try {
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'exchanging' }));
      
      // Generate ephemeral keys for this exchange
      const ephemeralKeyPair = await generateEphemeralKeyPair();
      ephemeralKeysRef.current.set(peerId, ephemeralKeyPair);
      
      // Get my signing key from IndexedDB
      const signingKey = await getMySigningKey();
      
      // Create KEX_INIT message
      const kexInit = await createKexInit(
        ephemeralKeyPair,
        signingKey,
        user.id,
        peerId
      );
      
      // Store pending state
      storePendingKex(peerId, {
        ephemeralKeyPair,
        myNonce: kexInit.nonce,
        peerPublicKeys,
        role: 'initiator'
      });
      
      // Send via socket
      sendKexInit(kexInit);
      
      console.log('%c✓ KEX_INIT sent, waiting for response...', LOG_STYLES.info);
      
    } catch (err) {
      console.error('%c✗ Key exchange initiation failed:', LOG_STYLES.error, err);
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'error' }));
    }
  }, [user.id, getMySigningKey, LOG_STYLES]);

  // Handle incoming KEX_INIT (we are responder)
  const handleKexInit = useCallback(async (kexInit) => {
    console.log('%c📥 CHAT: Received KEX_INIT', LOG_STYLES.header);
    console.log('%c    From: ' + kexInit.senderId, LOG_STYLES.detail);
    
    const peerId = kexInit.senderId;
    
    try {
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'exchanging' }));
      
      // Fetch peer's public keys
      const peerData = await getUser(peerId);
      const peerPublicKeys = peerData.publicKeys;
      
      // Generate our ephemeral keys
      const myEphemeralKeyPair = await generateEphemeralKeyPair();
      ephemeralKeysRef.current.set(peerId, myEphemeralKeyPair);
      
      // Get my signing key
      const signingKey = await getMySigningKey();
      
      // Process KEX_INIT and create response
      const result = await processKexInitAndCreateResponse(
        kexInit,
        peerPublicKeys.signing,
        myEphemeralKeyPair,
        signingKey,
        user.id
      );
      
      // Store the session key (but mark as pending confirmation)
      storePendingKex(peerId, {
        sessionKey: result.sessionKey,
        initiatorNonce: result.initiatorNonce,
        responderNonce: result.responderNonce,
        peerPublicKeys,
        role: 'responder'
      });
      
      // Send response
      sendKexResponse(result.response);
      
      console.log('%c✓ KEX_RESPONSE sent, waiting for confirmation...', LOG_STYLES.info);
      
    } catch (err) {
      console.error('%c✗ KEX_INIT processing failed:', LOG_STYLES.error, err);
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'error' }));
    }
  }, [user.id, getMySigningKey, LOG_STYLES]);

  // Handle incoming KEX_RESPONSE (we are initiator)
  const handleKexResponse = useCallback(async (kexResponse) => {
    console.log('%c📥 CHAT: Received KEX_RESPONSE', LOG_STYLES.header);
    console.log('%c    From: ' + kexResponse.senderId, LOG_STYLES.detail);
    
    const peerId = kexResponse.senderId;
    
    try {
      // Get pending state
      const pendingState = getPendingKex(peerId);
      if (!pendingState) {
        throw new Error('No pending key exchange found');
      }
      
      // Get my signing key
      const signingKey = await getMySigningKey();
      
      // Process response and create confirmation
      const result = await processKexResponseAndCreateConfirm(
        kexResponse,
        pendingState.peerPublicKeys.signing,
        pendingState.ephemeralKeyPair.privateKey,
        signingKey,
        pendingState.myNonce,
        user.id
      );
      
      // Store the session key
      storeSessionKey(peerId, result.sessionKey, {
        initiatorNonce: result.initiatorNonce,
        responderNonce: result.responderNonce,
        role: 'initiator'
      });
      
      // Send confirmation
      sendKexConfirm(result.confirm);
      
      // Clean up
      removePendingKex(peerId);
      ephemeralKeysRef.current.delete(peerId);
      
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      
      console.log('%c🎉 Key exchange COMPLETE (initiator)', LOG_STYLES.success);
      
    } catch (err) {
      console.error('%c✗ KEX_RESPONSE processing failed:', LOG_STYLES.error, err);
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'error' }));
    }
  }, [user.id, getMySigningKey, LOG_STYLES]);

  // Handle incoming KEX_CONFIRM (we are responder)
  const handleKexConfirm = useCallback(async (kexConfirm) => {
    console.log('%c📥 CHAT: Received KEX_CONFIRM', LOG_STYLES.header);
    console.log('%c    From: ' + kexConfirm.senderId, LOG_STYLES.detail);
    
    const peerId = kexConfirm.senderId;
    
    try {
      // Get pending state
      const pendingState = getPendingKex(peerId);
      if (!pendingState) {
        throw new Error('No pending key exchange found');
      }
      
      // Verify confirmation
      await processKexConfirm(
        kexConfirm,
        pendingState.peerPublicKeys.signing,
        pendingState.sessionKey,
        pendingState.initiatorNonce,
        pendingState.responderNonce,
        peerId,
        user.id
      );
      
      // Now store the session key (confirmed!)
      storeSessionKey(peerId, pendingState.sessionKey, {
        initiatorNonce: pendingState.initiatorNonce,
        responderNonce: pendingState.responderNonce,
        role: 'responder'
      });
      
      // Clean up
      removePendingKex(peerId);
      ephemeralKeysRef.current.delete(peerId);
      
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      
      console.log('%c🎉 Key exchange COMPLETE (responder)', LOG_STYLES.success);
      
    } catch (err) {
      console.error('%c✗ KEX_CONFIRM processing failed:', LOG_STYLES.error, err);
      setEncryptionStatus(prev => ({ ...prev, [peerId]: 'error' }));
    }
  }, [user.id, LOG_STYLES]);

  // Socket connection management
  useEffect(() => {
    initSocket();
    joinRoom(user.id);

    const handleMessage = (data) => {
      console.log('%c📨 Incoming message', 'color: #3b82f6; font-weight: bold;', {
        from: data.from,
        decrypted: data.decrypted,
        error: data.error
      });
      
      setMessages(prev => ({
        ...prev,
        [data.from]: [...(prev[data.from] || []), {
          text: data.plaintext || '[Encrypted]',
          sent: false,
          timestamp: data.timestamp,
          error: data.error // Flag if decryption failed
        }]
      }));
    };

    onMessage(handleMessage);
    
    // Setup KEX listeners
    onKexInit(handleKexInit);
    onKexResponse(handleKexResponse);
    onKexConfirm(handleKexConfirm);
    
    // Setup file shared listener
    onFileShared((data) => {
      console.log('%c📁 File received:', 'color: #f97316; font-weight: bold;', data.metadata.name);
      
      // Add file message to chat
      setMessages(prev => ({
        ...prev,
        [data.from]: [...(prev[data.from] || []), {
          type: 'file',
          file: {
            _id: data.fileId,
            metadata: data.metadata,
            sender: data.from
          },
          sent: false,
          timestamp: data.timestamp
        }]
      }));
    });

    return () => {
      disconnect();
      clearAllSessionKeys(); // Clear session keys on unmount
    };
  }, [user.id, handleKexInit, handleKexResponse, handleKexConfirm]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  // Memoized handlers
  const handleSelectUser = useCallback((selectedUser) => {
    setSelectedUser(selectedUser);
    
    // Check if we already have a session key
    if (hasSessionKey(selectedUser._id)) {
      setEncryptionStatus(prev => ({ ...prev, [selectedUser._id]: 'complete' }));
    } else {
      setEncryptionStatus(prev => ({ ...prev, [selectedUser._id]: 'pending' }));
      // Initiate key exchange with the selected user
      initiateKeyExchange(selectedUser._id, selectedUser.publicKeys);
    }
    
    // Focus input after selection
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [initiateKeyExchange]);

  const handleInputChange = useCallback((e) => {
    setInputMessage(e.target.value);
  }, []);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedUser) return;

    const messageText = inputMessage;
    setInputMessage('');

    // Add optimistic message to UI
    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: [...(prev[selectedUser._id] || []), {
        text: messageText,
        sent: true,
        timestamp: Date.now()
      }]
    }));

    // Encrypt and send message using conversation key
    try {
      // Get or derive conversation key
      const conversationKey = await getConversationKey(selectedUser._id, selectedUser.publicKeys);
      
      // Encrypt the message
      const { ciphertext, iv } = await encryptMessage(conversationKey, messageText);
      
      // Create message with replay protection
      const conversationId = [user.id, selectedUser._id].sort().join('-');
      const protectedMessage = addReplayProtection({
        to: selectedUser._id,
        ciphertext,
        iv
      }, conversationId);
      
      // Send via socket with replay protection
      const socket = getSocket();
      if (socket) {
        socket.emit('message', protectedMessage);
        console.log('%c📤 Message sent with replay protection', 'color: #22c55e; font-weight: bold;');
        console.log('%c    Nonce: ' + protectedMessage.nonce.substring(0, 16) + '...', 'color: #94a3b8;');
        console.log('%c    Sequence: ' + protectedMessage.sequence, 'color: #94a3b8;');
      } else {
        throw new Error('Socket not connected');
      }
    } catch (error) {
      console.error('%c✗ Failed to send message:', 'color: #ef4444; font-weight: bold;', error);
    }
  }, [inputMessage, selectedUser, getConversationKey, user.id]);

  // Handle file share completion
  const handleFileShared = useCallback((data) => {
    console.log('%c📁 File shared:', 'color: #f97316; font-weight: bold;', data.metadata.name);
    
    // Add file message to local chat
    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: [...(prev[selectedUser._id] || []), {
        type: 'file',
        file: {
          _id: data.fileId,
          metadata: data.metadata,
          sender: user.id
        },
        sent: true,
        timestamp: Date.now()
      }]
    }));
    
    // Notify recipient via socket
    emitFileShared({
      to: selectedUser._id,
      fileId: data.fileId,
      metadata: data.metadata,
      timestamp: Date.now()
    });
  }, [selectedUser, user.id]);

  // Handle file download
  // For conversation key derivation, we always need the PEER's ID (not the file sender)
  // Because: ECDH(myPrivate, peerPublic) = ECDH(peerPrivate, myPublic)
  const handleFileDownload = useCallback((file) => {
    // Always use selectedUser._id as the peer for key derivation
    const peerId = selectedUser?._id;
    if (!peerId) {
      console.error('No peer selected for file download');
      return;
    }
    handleDownload(file, peerId);
  }, [handleDownload, selectedUser]);

  // Fetch encrypted message history and decrypt using conversation key
  const loadMessageHistory = useCallback(async (peerId) => {
    console.log('%c📂 Loading message history...', 'color: #3b82f6; font-weight: bold;');
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/messages/${peerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) return;
      
      const encryptedMessages = await response.json();
      console.log('%c    Found ' + encryptedMessages.length + ' encrypted messages', 'color: #94a3b8;');
      
      if (encryptedMessages.length === 0) return;
      
      // Get or derive conversation key (persistent across sessions)
      // getConversationKey will fetch peer's public keys if not cached
      const conversationKey = await getConversationKey(peerId);
      
      // Decrypt each message
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg) => {
          try {
            const plaintext = await decryptMessage(conversationKey, msg.ciphertext, msg.iv);
            return {
              id: msg._id, // Add ID for deduplication
              text: plaintext,
              sent: msg.sender === user.id,
              timestamp: new Date(msg.timestamp).getTime(),
              encrypted: true
            };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return {
              id: msg._id,
              text: '[Failed to decrypt]',
              sent: msg.sender === user.id,
              timestamp: new Date(msg.timestamp).getTime(),
              error: true
            };
          }
        })
      );
      
      // Merge with existing messages (preserve files, avoid duplicates)
      setMessages(prev => {
        const existing = prev[peerId] || [];
        // Keep only file messages from existing
        const existingFiles = existing.filter(m => m.type === 'file');
        // Merge text messages and files, sort by timestamp
        const merged = [...decryptedMessages, ...existingFiles].sort((a, b) => a.timestamp - b.timestamp);
        return {
          ...prev,
          [peerId]: merged
        };
      });
      
      console.log('%c✓ Message history loaded and decrypted', 'color: #22c55e; font-weight: bold;');
      
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  }, [user.id, getConversationKey]);

  // Load message history when a user is selected
  // We can use conversation keys (derived from long-term keys) even before session key exchange
  useEffect(() => {
    if (selectedUser) {
      // Load sequentially to avoid race conditions with setMessages
      (async () => {
        await loadMessageHistory(selectedUser._id);
        await loadFileHistory(selectedUser._id);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, loadMessageHistory]);
  
  // Load file history for a peer
  const loadFileHistory = useCallback(async (peerId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/files/peer/${peerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) return;
      
      const files = await response.json();
      
      if (files.length === 0) return;
      
      console.log('%c📁 Found ' + files.length + ' shared files', 'color: #f97316;');
      
      // Convert to file messages and add to messages state
      const fileMessages = files.map(file => ({
        type: 'file',
        file: {
          _id: file._id,
          metadata: file.metadata,
          sender: file.sender
        },
        sent: file.sender === user.id,
        timestamp: new Date(file.uploadedAt).getTime()
      }));
      
      // Merge file messages with existing messages (avoiding duplicates)
      setMessages(prev => {
        const existing = prev[peerId] || [];
        
        // Get existing file IDs to avoid duplicates
        const existingFileIds = new Set(
          existing.filter(m => m.type === 'file').map(m => m.file?._id)
        );
        
        // Filter out files that already exist
        const newFiles = fileMessages.filter(fm => !existingFileIds.has(fm.file._id));
        
        if (newFiles.length === 0) return prev;
        
        // Keep all existing messages (text + existing files) and add new files
        const merged = [...existing, ...newFiles].sort((a, b) => a.timestamp - b.timestamp);
        
        return {
          ...prev,
          [peerId]: merged
        };
      });
      
    } catch (error) {
      console.error('Failed to load file history:', error);
    }
  }, [user.id]);

  // Memoized current messages
  const currentMessages = useMemo(() => {
    return selectedUser ? (messages[selectedUser._id] || []) : [];
  }, [messages, selectedUser]);

  // Memoized user list
  const userList = useMemo(() => {
    return users.map(u => (
      <UserListItem
        key={u._id}
        user={u}
        isSelected={selectedUser?._id === u._id}
        onSelect={handleSelectUser}
      />
    ));
  }, [users, selectedUser, handleSelectUser]);

  // Memoized message list
  const messageList = useMemo(() => {
    return currentMessages.map((msg, index) => (
      <MessageBubble 
        key={`${msg.timestamp}-${index}`} 
        message={msg}
        onFileDownload={handleFileDownload}
        downloading={downloading[msg.file?._id]}
      />
    ));
  }, [currentMessages, handleFileDownload, downloading]);

  // Get current encryption status for selected user
  const currentEncryptionStatus = useMemo(() => {
    if (!selectedUser) return 'pending';
    return encryptionStatus[selectedUser._id] || 'pending';
  }, [selectedUser, encryptionStatus]);

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <aside className="sidebar" role="navigation" aria-label="Contacts">
        <div className="sidebar-header">
          <h3>CryptShare</h3>
          <button 
            className="logout-btn" 
            onClick={onLogout}
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
        
        <div className="user-list" role="listbox" aria-label="Contact list">
          {users.length === 0 ? (
            <p className="empty-contacts">
              No contacts available
            </p>
          ) : (
            userList
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="chat-area" role="main">
        {selectedUser ? (
          <>
            <ChatHeader 
              user={selectedUser} 
              encryptionStatus={currentEncryptionStatus}
            />

            <div 
              className="messages-container" 
              role="log" 
              aria-live="polite"
              aria-label="Message history"
            >
              {messageList}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>

            <form 
              className="message-input-container" 
              onSubmit={handleSendMessage}
              aria-label="Send message"
            >
              <FileUploadButton
                onFileSelect={() => setShowFileModal(true)}
                disabled={false}
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={handleInputChange}
                aria-label="Message input"
              />
              <button 
                type="submit" 
                className="send-btn"
                disabled={!inputMessage.trim()}
                aria-label="Send message"
              >
                &#10148;
              </button>
            </form>
            
            {/* File Share Modal */}
            <FileShareModal
              isOpen={showFileModal}
              onClose={() => setShowFileModal(false)}
              myUserId={user.id}
              recipientId={selectedUser?._id}
              recipientName={selectedUser?.username}
              onFileShared={handleFileShared}
            />
          </>
        ) : (
          <EmptyState username={user.username} />
        )}
      </main>
    </div>
  );
}

export default memo(Chat);
