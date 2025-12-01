const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Log = require('../models/Log');

const BCRYPT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, publicSigningKey, publicKeyExchangeKey } = req.body;

    // Validate input
    if (!email || !username || !password || !publicSigningKey || !publicKeyExchangeKey) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await User.create({
      email,
      username,
      passwordHash,
      publicKeys: {
        signing: publicSigningKey,
        keyExchange: publicKeyExchangeKey
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log registration
    await Log.create({
      eventType: 'AUTH_REGISTER',
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email, username },
      severity: 'INFO',
      success: true
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        publicKeys: user.publicKeys
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      // Log failed attempt
      await Log.create({
        eventType: 'AUTH_LOGIN_FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { email, reason: 'User not found' },
        severity: 'WARNING',
        success: false
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      // Log failed attempt
      await Log.create({
        eventType: 'AUTH_LOGIN_FAILED',
        userId: user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid password' },
        severity: 'WARNING',
        success: false
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update user status
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    // Log successful login
    await Log.create({
      eventType: 'AUTH_LOGIN',
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: 'INFO',
      success: true
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        publicKeys: user.publicKeys
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/users - Get all users (for user discovery)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email username publicKeys status lastSeen');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/auth/user/:id - Get specific user's public keys
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, 'username publicKeys');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
