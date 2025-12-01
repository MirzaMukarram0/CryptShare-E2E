import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../services/api';
import { generateSigningKeyPair, generateKeyExchangeKeyPair, exportPublicKey, exportPrivateKey } from '../crypto/keys';
import { savePrivateKey } from '../crypto/keyStore';

function Register({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setKeyStatus('Generating encryption keys...');

    try {
      // Generate key pairs using Web Crypto API
      setKeyStatus('Generating signing key pair (ECDSA P-256)...');
      const signingKeyPair = await generateSigningKeyPair();
      
      setKeyStatus('Generating key exchange key pair (ECDH P-256)...');
      const keyExchangeKeyPair = await generateKeyExchangeKeyPair();
      
      // Export public keys for server
      const publicSigningKey = await exportPublicKey(signingKeyPair.publicKey);
      const publicKeyExchangeKey = await exportPublicKey(keyExchangeKeyPair.publicKey);
      
      // Register with server
      setKeyStatus('Registering with server...');
      const response = await register(username, password, publicSigningKey, publicKeyExchangeKey);
      
      // Store private keys in IndexedDB
      setKeyStatus('Storing private keys securely...');
      const privateSigningKey = await exportPrivateKey(signingKeyPair.privateKey);
      const privateKeyExchangeKey = await exportPrivateKey(keyExchangeKeyPair.privateKey);
      
      await savePrivateKey(`${response.user.id}_signing`, privateSigningKey);
      await savePrivateKey(`${response.user.id}_keyExchange`, privateKeyExchangeKey);
      
      setKeyStatus('Registration complete!');
      
      // Store keys in session for immediate use
      sessionStorage.setItem('signingKey', JSON.stringify(privateSigningKey));
      sessionStorage.setItem('keyExchangeKey', JSON.stringify(privateKeyExchangeKey));
      
      onLogin(response.user, response.token);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
      setKeyStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>🔐 Secure Register</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {keyStatus && (
          <div className={`key-status ${keyStatus.includes('complete') ? 'success' : 'generating'}`}>
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
            minLength={3}
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
            minLength={6}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
        
        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
