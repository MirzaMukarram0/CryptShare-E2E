import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { getUsers } from '../services/api';
import { initSocket, joinRoom, sendEncryptedMessage, onMessage, disconnect } from '../services/socket';
import { Avatar } from './common';

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
const MessageBubble = memo(function MessageBubble({ message }) {
  return (
    <div className={`message ${message.sent ? 'sent' : 'received'}`}>
      <div className="message-bubble">
        {message.text}
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
const EncryptionStatus = memo(function EncryptionStatus({ status }) {
  return (
    <span className={`encryption-status ${status}`}>
      {status === 'encrypted' ? 'End-to-End Encrypted' : 'Establishing Encryption...'}
    </span>
  );
});

// Memoized chat header component
const ChatHeader = memo(function ChatHeader({ user, encryptionStatus }) {
  return (
    <div className="chat-header">
      <Avatar username={user.username} />
      <h3>{user.username}</h3>
      <EncryptionStatus status={encryptionStatus} />
    </div>
  );
});

function Chat({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [encryptionStatus, setEncryptionStatus] = useState('pending');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  // Socket connection management
  useEffect(() => {
    initSocket();
    joinRoom(user.id);

    const handleMessage = (data) => {
      setMessages(prev => ({
        ...prev,
        [data.from]: [...(prev[data.from] || []), {
          text: data.plaintext || '[Encrypted]',
          sent: false,
          timestamp: data.timestamp
        }]
      }));
    };

    onMessage(handleMessage);

    return () => {
      disconnect();
    };
  }, [user.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  // Memoized handlers
  const handleSelectUser = useCallback((selectedUser) => {
    setSelectedUser(selectedUser);
    setEncryptionStatus('pending');
    // TODO: Initiate key exchange in Phase 3
    setTimeout(() => setEncryptionStatus('encrypted'), 1000);
    // Focus input after selection
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleInputChange = useCallback((e) => {
    setInputMessage(e.target.value);
  }, []);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedUser) return;

    const messageText = inputMessage;
    setInputMessage('');

    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: [...(prev[selectedUser._id] || []), {
        text: messageText,
        sent: true,
        timestamp: Date.now()
      }]
    }));

    // TODO: Encrypt and send in Phase 4
    sendEncryptedMessage(selectedUser._id, messageText);
  }, [inputMessage, selectedUser]);

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
      <MessageBubble key={`${msg.timestamp}-${index}`} message={msg} />
    ));
  }, [currentMessages]);

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
              encryptionStatus={encryptionStatus} 
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
          </>
        ) : (
          <EmptyState username={user.username} />
        )}
      </main>
    </div>
  );
}

export default memo(Chat);
