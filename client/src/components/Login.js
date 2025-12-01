import React, { useState, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { login, updatePublicKeys } from '../services/api';
import { getPrivateKey, savePrivateKey } from '../crypto/keyStore';
import { generateSigningKeyPair, generateKeyExchangeKeyPair, exportPublicKey, exportPrivateKey } from '../crypto/keys';
import { FormInput, Button } from './common';

// Validation helpers - defined outside component to avoid recreation
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const validateEmail = (email) => EMAIL_REGEX.test(email);

// Memoized status message component
const KeyStatusMessage = memo(function KeyStatusMessage({ status }) {
  if (!status) return null;
  
  const isSuccess = status.includes('success');
  return (
    <div className={`key-status ${isSuccess ? 'success' : 'generating'}`} role="status">
      {status}
    </div>
  );
});

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');

  // Memoized field change handlers
  const handleEmailChange = useCallback((e) => {
    const value = e.target.value.trim().toLowerCase();
    setFormData(prev => ({ ...prev, email: value }));
    
    if (value && !validateEmail(value)) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    } else {
      setFieldErrors(prev => ({ ...prev, email: '' }));
    }
  }, []);

  const handlePasswordChange = useCallback((e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, password: value }));
    
    if (value && value.length < 6) {
      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
    } else {
      setFieldErrors(prev => ({ ...prev, password: '' }));
    }
  }, []);

  const handleEmailBlur = useCallback(() => {
    if (!formData.email) {
      setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
    }
  }, [formData.email]);

  const handlePasswordBlur = useCallback(() => {
    if (!formData.password) {
      setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
    }
  }, [formData.password]);

  // Memoized form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Memoized submit handler
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setLoading(true);
    setKeyStatus('');

    try {
      const response = await login(formData.email.toLowerCase(), formData.password);
      
      setKeyStatus('Retrieving encryption keys...');
      
      let [signingKey, keyExchangeKey] = await Promise.all([
        getPrivateKey(`${response.user.id}_signing`),
        getPrivateKey(`${response.user.id}_keyExchange`)
      ]);
      
      // If keys not found on this device, regenerate them
      if (!signingKey || !keyExchangeKey) {
        console.log('%c⚠️ Keys not found - regenerating for this device...', 'color: #f59e0b; font-weight: bold;');
        setKeyStatus('Generating new encryption keys for this device...');
        
        // Generate new key pairs
        const [signingKeyPair, keyExchangeKeyPair] = await Promise.all([
          generateSigningKeyPair(),
          generateKeyExchangeKeyPair()
        ]);
        
        // Export keys
        const [publicSigningKey, privateSigningKey, publicKeyExchangeKey, privateKeyExchangeKey] = await Promise.all([
          exportPublicKey(signingKeyPair.publicKey),
          exportPrivateKey(signingKeyPair.privateKey),
          exportPublicKey(keyExchangeKeyPair.publicKey),
          exportPrivateKey(keyExchangeKeyPair.privateKey)
        ]);
        
        // Save private keys to IndexedDB
        await Promise.all([
          savePrivateKey(`${response.user.id}_signing`, privateSigningKey),
          savePrivateKey(`${response.user.id}_keyExchange`, privateKeyExchangeKey)
        ]);
        
        // Update public keys on server
        setKeyStatus('Updating server with new public keys...');
        await updatePublicKeys(response.token, publicSigningKey, publicKeyExchangeKey);
        
        signingKey = privateSigningKey;
        keyExchangeKey = privateKeyExchangeKey;
        
        console.log('%c✓ New keys generated and synced!', 'color: #22c55e; font-weight: bold;');
        setKeyStatus('New keys generated successfully!');
      } else {
        setKeyStatus('Keys retrieved successfully!');
      }
      
      sessionStorage.setItem('signingKey', JSON.stringify(signingKey));
      sessionStorage.setItem('keyExchangeKey', JSON.stringify(keyExchangeKey));
      
      onLogin(response.user, response.token);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, onLogin]);

  // Memoized form validity check
  const isFormValid = useMemo(() => {
    return formData.email && 
           formData.password && 
           !fieldErrors.email && 
           !fieldErrors.password;
  }, [formData.email, formData.password, fieldErrors.email, fieldErrors.password]);

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your CryptShare E2E account</p>
        
        {error && <div className="error-message" role="alert">{error}</div>}
        
        <KeyStatusMessage status={keyStatus} />
        
        <FormInput
          type="email"
          label="Email"
          value={formData.email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          error={fieldErrors.email}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          disabled={loading}
        />
        
        <FormInput
          type="password"
          label="Password"
          value={formData.password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          error={fieldErrors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={loading}
          showPasswordToggle
        />
        
        <Button 
          type="submit" 
          disabled={!isFormValid}
          loading={loading}
          fullWidth
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
        
        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default memo(Login);
