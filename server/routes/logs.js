/**
 * Logs API Routes
 * ================
 * 
 * Endpoints for viewing security logs (admin/audit purposes)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getLogs, getSecurityEvents, getLogStats } = require('../services/logger');

/**
 * GET /api/logs
 * Get logs with optional filtering
 * 
 * Query params:
 * - eventType: Filter by event type
 * - severity: Filter by severity (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 * - userId: Filter by user ID
 * - startDate: Filter from date (ISO string)
 * - endDate: Filter to date (ISO string)
 * - limit: Max number of results (default 100)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { eventType, severity, userId, startDate, endDate, limit } = req.query;
    
    const filters = {};
    if (eventType) filters.eventType = eventType;
    if (severity) filters.severity = severity;
    if (userId) filters.userId = userId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = parseInt(limit);
    
    const logs = await getLogs(filters);
    
    res.json({
      count: logs.length,
      logs
    });
    
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/logs/security
 * Get security-related events (attacks, failures, critical events)
 */
router.get('/security', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const securityEvents = await getSecurityEvents(limit);
    
    res.json({
      count: securityEvents.length,
      events: securityEvents
    });
    
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

/**
 * GET /api/logs/stats
 * Get log statistics (event counts, severity distribution)
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await getLogStats();
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log statistics' });
  }
});

/**
 * GET /api/logs/my
 * Get logs related to the current user
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const logs = await getLogs({
      userId: req.userId,
      limit: parseInt(req.query.limit) || 50
    });
    
    res.json({
      count: logs.length,
      logs
    });
    
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({ error: 'Failed to fetch user logs' });
  }
});

/**
 * GET /api/logs/event-types
 * Get list of available event types
 */
router.get('/event-types', authenticate, (req, res) => {
  const eventTypes = [
    // Authentication
    { category: 'Authentication', events: [
      'AUTH_REGISTER', 'AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_TOKEN_INVALID'
    ]},
    // Key Management
    { category: 'Key Management', events: [
      'KEY_UPDATE', 'KEY_GENERATION', 'KEY_EXCHANGE_INIT', 'KEY_EXCHANGE_RESPONSE', 
      'KEY_EXCHANGE_COMPLETE', 'KEY_EXCHANGE_FAILED'
    ]},
    // Messaging
    { category: 'Messaging', events: [
      'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_DECRYPTION_FAILED'
    ]},
    // Files
    { category: 'Files', events: [
      'FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_ENCRYPTION_FAILED', 'FILE_DECRYPTION_FAILED'
    ]},
    // Security Attacks
    { category: 'Security Attacks', events: [
      'REPLAY_ATTACK_NONCE', 'REPLAY_ATTACK_TIMESTAMP', 'REPLAY_ATTACK_SEQUENCE',
      'MITM_ATTACK_DETECTED', 'SIGNATURE_VERIFICATION_FAILED', 'INVALID_TIMESTAMP', 'INVALID_NONCE'
    ]},
    // Access Control
    { category: 'Access Control', events: [
      'UNAUTHORIZED_ACCESS', 'RATE_LIMIT_EXCEEDED'
    ]},
    // System
    { category: 'System', events: [
      'SERVER_START', 'SERVER_SHUTDOWN', 'DATABASE_CONNECTED', 'DATABASE_ERROR'
    ]}
  ];
  
  res.json(eventTypes);
});

module.exports = router;
