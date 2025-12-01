import React, { useState, useEffect, useRef } from 'react';
import { getUsers } from '../services/api';
import { initSocket, joinRoom, sendEncryptedMessage, onMessage, disconnect } from '../services/socket';

function Chat({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [encryptionStatus, setEncryptionStatus] = useState('pending');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    initSocket();
    joinRoom(user.id);

    // Fetch users list
    fetchUsers();

    // Listen for incoming messages
    onMessage((data) => {
      setMessages(prev => ({
        ...prev,
        [data.from]: [...(prev[data.from] || []), {
          text: data.plaintext || '[Encrypted]',
          sent: false,
          timestamp: data.timestamp
        }]
      }));
    });

    return () => {
      disconnect();
    };
  }, [user.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const fetchUsers = async () => {
    try {
      const userList = await getUsers();
      // Filter out current user
      setUsers(userList.filter(u => u._id !== user.id));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSelectUser = (selectedUser) => {
    setSelectedUser(selectedUser);
    setEncryptionStatus('pending');
    // TODO: Initiate key exchange in Phase 3
    setTimeout(() => setEncryptionStatus('encrypted'), 1000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedUser) return;

    const messageText = inputMessage;
    setInputMessage('');

    // Add to local messages
    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: [...(prev[selectedUser._id] || []), {
        text: messageText,
        sent: true,
        timestamp: Date.now()
      }]
    }));

    // TODO: Encrypt and send in Phase 4
    // For now, just send via socket
    sendEncryptedMessage(selectedUser._id, messageText);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Secure Chat</h3>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
        
        <div className="user-list">
          {users.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>
              No other users yet
            </p>
          ) : (
            users.map(u => (
              <div
                key={u._id}
                className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                onClick={() => handleSelectUser(u)}
              >
                <div className="user-avatar">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">{u.username}</div>
                  <div className={`user-status ${u.status}`}>
                    {u.status || 'offline'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="user-avatar">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <h3>{selectedUser.username}</h3>
              <span className={`encryption-status ${encryptionStatus}`}>
                {encryptionStatus === 'encrypted' ? '🔒 End-to-End Encrypted' : '🔄 Establishing Encryption...'}
              </span>
            </div>

            <div className="messages-container">
              {(messages[selectedUser._id] || []).map((msg, index) => (
                <div key={index} className={`message ${msg.sent ? 'sent' : 'received'}`}>
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-input-container" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button type="submit" className="send-btn">
                &#10148;
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat">
            <h2>Welcome, {user.username}!</h2>
            <p>Select a user to start an encrypted conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
