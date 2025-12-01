import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { login } from '../services/api';
import { getPrivateKey } from '../crypto/keyStore';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setKeyStatus('');

    try {
      // Login to server
      const response = await login(username, password);
      
      // Check for private keys in IndexedDB
      setKeyStatus('Retrieving encryption keys...');
      
      const signingKey = await getPrivateKey(`${response.user.id}_signing`);
      const keyExchangeKey = await getPrivateKey(`${response.user.id}_keyExchange`);
      
      if (!signingKey || !keyExchangeKey) {
        setError('Private keys not found. Please register again on this device.');
        setLoading(false);
        return;
      }
      
      setKeyStatus('Keys retrieved successfully!');
      
      // Store keys in memory for session
      sessionStorage.setItem('signingKey', JSON.stringify(signingKey));
      sessionStorage.setItem('keyExchangeKey', JSON.stringify(keyExchangeKey));
      
      onLogin(response.user, response.token);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>🔐 Secure Login</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {keyStatus && (
          <div className={`key-status ${keyStatus.includes('success') ? 'success' : 'generating'}`}>
            {keyStatus}
          </div>
        )}
        
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        
        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
