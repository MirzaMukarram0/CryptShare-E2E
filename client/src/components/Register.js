import React, { useState, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../services/api';
import { generateSigningKeyPair, generateKeyExchangeKeyPair, exportPublicKey, exportPrivateKey } from '../crypto/keys';
import { savePrivateKey } from '../crypto/keyStore';
import { FormInput, Button, PasswordStrength } from './common';

// Validation helpers - defined outside component to avoid recreation
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

const validateEmail = (email) => EMAIL_REGEX.test(email);
const validateUsername = (username) => USERNAME_REGEX.test(username);

// Memoized status message component
const KeyStatusMessage = memo(function KeyStatusMessage({ status }) {
  if (!status) return null;
  
  const isComplete = status.includes('complete');
  return (
    <div className={`key-status ${isComplete ? 'success' : 'generating'}`} role="status">
      {status}
    </div>
  );
});

function Register({ onLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
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

  const handleUsernameChange = useCallback((e) => {
    const value = e.target.value.trim();
    setFormData(prev => ({ ...prev, username: value }));
    
    if (value && value.length < 3) {
      setFieldErrors(prev => ({ ...prev, username: 'Username must be at least 3 characters' }));
    } else if (value && value.length > 30) {
      setFieldErrors(prev => ({ ...prev, username: 'Username must be less than 30 characters' }));
    } else if (value && !validateUsername(value)) {
      setFieldErrors(prev => ({ ...prev, username: 'Username can only contain letters, numbers, underscores, and hyphens' }));
    } else {
      setFieldErrors(prev => ({ ...prev, username: '' }));
    }
  }, []);

  const handlePasswordChange = useCallback((e) => {
    const value = e.target.value;
    setFormData(prev => {
      const newData = { ...prev, password: value };
      
      // Check confirm password match if already entered
      if (prev.confirmPassword && value !== prev.confirmPassword) {
        setFieldErrors(errs => ({ ...errs, confirmPassword: 'Passwords do not match' }));
      } else if (prev.confirmPassword) {
        setFieldErrors(errs => ({ ...errs, confirmPassword: '' }));
      }
      
      return newData;
    });
    
    if (value && value.length < 6) {
      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
    } else {
      setFieldErrors(prev => ({ ...prev, password: '' }));
    }
  }, []);

  const handleConfirmPasswordChange = useCallback((e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, confirmPassword: value }));
    
    setFormData(prev => {
      if (value && value !== prev.password) {
        setFieldErrors(errs => ({ ...errs, confirmPassword: 'Passwords do not match' }));
      } else {
        setFieldErrors(errs => ({ ...errs, confirmPassword: '' }));
      }
      return { ...prev, confirmPassword: value };
    });
  }, []);

  // Blur handlers
  const handleEmailBlur = useCallback(() => {
    if (!formData.email) {
      setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
    }
  }, [formData.email]);

  const handleUsernameBlur = useCallback(() => {
    if (!formData.username) {
      setFieldErrors(prev => ({ ...prev, username: 'Username is required' }));
    }
  }, [formData.username]);

  const handlePasswordBlur = useCallback(() => {
    if (!formData.password) {
      setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
    }
  }, [formData.password]);

  const handleConfirmPasswordBlur = useCallback(() => {
    if (!formData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
    }
  }, [formData.confirmPassword]);

  // Memoized form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 30) {
      errors.username = 'Username must be less than 30 characters';
    } else if (!validateUsername(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
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
    setKeyStatus('Generating encryption keys...');

    try {
      // Generate key pairs in parallel for better performance
      setKeyStatus('Generating signing key pair (ECDSA P-256)...');
      const [signingKeyPair, keyExchangeKeyPair] = await Promise.all([
        generateSigningKeyPair(),
        generateKeyExchangeKeyPair()
      ]);
      
      setKeyStatus('Exporting public keys...');
      const [publicSigningKey, publicKeyExchangeKey] = await Promise.all([
        exportPublicKey(signingKeyPair.publicKey),
        exportPublicKey(keyExchangeKeyPair.publicKey)
      ]);
      
      setKeyStatus('Registering with server...');
      const response = await register(
        formData.email.toLowerCase(), 
        formData.username, 
        formData.password, 
        publicSigningKey, 
        publicKeyExchangeKey
      );
      
      setKeyStatus('Storing private keys securely...');
      const [privateSigningKey, privateKeyExchangeKey] = await Promise.all([
        exportPrivateKey(signingKeyPair.privateKey),
        exportPrivateKey(keyExchangeKeyPair.privateKey)
      ]);
      
      await Promise.all([
        savePrivateKey(`${response.user.id}_signing`, privateSigningKey),
        savePrivateKey(`${response.user.id}_keyExchange`, privateKeyExchangeKey)
      ]);
      
      setKeyStatus('Registration complete!');
      
      sessionStorage.setItem('signingKey', JSON.stringify(privateSigningKey));
      sessionStorage.setItem('keyExchangeKey', JSON.stringify(privateKeyExchangeKey));
      
      onLogin(response.user, response.token);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setKeyStatus('');
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, onLogin]);

  // Memoized form validity check
  const isFormValid = useMemo(() => {
    return formData.email && 
           formData.username && 
           formData.password && 
           formData.confirmPassword && 
           !fieldErrors.email && 
           !fieldErrors.username && 
           !fieldErrors.password && 
           !fieldErrors.confirmPassword;
  }, [formData, fieldErrors]);

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join CryptShare E2E for secure messaging</p>
        
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
          type="text"
          label="Username (Display Name)"
          value={formData.username}
          onChange={handleUsernameChange}
          onBlur={handleUsernameBlur}
          error={fieldErrors.username}
          hint="3-30 characters, letters, numbers, underscores, hyphens"
          placeholder="How others will see you"
          autoComplete="username"
          disabled={loading}
        />
        
        <FormInput
          type="password"
          label="Password"
          value={formData.password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          error={fieldErrors.password}
          placeholder="Min. 6 characters"
          autoComplete="new-password"
          disabled={loading}
          showPasswordToggle
        />
        
        <PasswordStrength password={formData.password} />
        
        <FormInput
          type="password"
          label="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={handleConfirmPasswordBlur}
          error={fieldErrors.confirmPassword}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={loading}
          showPasswordToggle
        />
        
        <Button 
          type="submit" 
          disabled={!isFormValid}
          loading={loading}
          fullWidth
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>
        
        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default memo(Register);
