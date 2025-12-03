/**
 * ============================================
 * REPLAY ATTACK DEMONSTRATION
 * ============================================
 * 
 * This script demonstrates:
 * 1. What a replay attack is
 * 2. How triple-layer protection prevents it
 * 3. Live simulation of attack attempts
 * 
 * Run with: node replay-demo.js
 */

const crypto = require('crypto');

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function printBanner(text) {
  console.log('\n' + '═'.repeat(60));
  console.log(colors.bright + colors.cyan + '  ' + text + colors.reset);
  console.log('═'.repeat(60) + '\n');
}

function printStep(step, text) {
  console.log(colors.yellow + `[Step ${step}]` + colors.reset + ' ' + text);
}

function printAccepted(text) {
  console.log(colors.bgGreen + colors.white + ' ACCEPTED ' + colors.reset + ' ' + colors.green + text + colors.reset);
}

function printRejected(text, reason) {
  console.log(colors.bgRed + colors.white + ' REJECTED ' + colors.reset + ' ' + colors.red + text + colors.reset);
  console.log('          ' + colors.yellow + 'Reason: ' + reason + colors.reset);
}

// ============================================
// SERVER-SIDE REPLAY PROTECTION (Simulation)
// ============================================
class ReplayProtectionServer {
  constructor() {
    this.usedNonces = new Set();
    this.sequenceNumbers = new Map();
    this.timestampWindowMs = 5 * 60 * 1000; // 5 minutes
  }
  
  validateMessage(message, conversationId) {
    const { nonce, timestamp, sequence } = message;
    const errors = [];
    
    console.log();
    console.log(colors.cyan + '   Server validating message:' + colors.reset);
    console.log('   ├─ Nonce: ' + nonce?.substring(0, 16) + '...');
    console.log('   ├─ Timestamp: ' + new Date(timestamp).toISOString());
    console.log('   └─ Sequence: ' + sequence);
    console.log();
    
    // Layer 1: Nonce uniqueness
    console.log('   ' + colors.blue + 'Layer 1: Nonce Check' + colors.reset);
    if (this.usedNonces.has(nonce)) {
      console.log('   └─ ' + colors.red + '✗ Nonce already used!' + colors.reset);
      errors.push('DUPLICATE_NONCE');
    } else {
      console.log('   └─ ' + colors.green + '✓ Nonce is unique' + colors.reset);
    }
    
    // Layer 2: Timestamp freshness
    console.log('   ' + colors.blue + 'Layer 2: Timestamp Check' + colors.reset);
    const now = Date.now();
    const age = now - timestamp;
    const ageSeconds = Math.round(age / 1000);
    const maxAgeSeconds = this.timestampWindowMs / 1000;
    
    if (Math.abs(age) > this.timestampWindowMs) {
      console.log('   └─ ' + colors.red + `✗ Timestamp too old! (${ageSeconds}s > ${maxAgeSeconds}s)` + colors.reset);
      errors.push('STALE_TIMESTAMP');
    } else {
      console.log('   └─ ' + colors.green + `✓ Timestamp is fresh (${ageSeconds}s < ${maxAgeSeconds}s)` + colors.reset);
    }
    
    // Layer 3: Sequence number
    console.log('   ' + colors.blue + 'Layer 3: Sequence Check' + colors.reset);
    const lastSeq = this.sequenceNumbers.get(conversationId) || 0;
    
    if (sequence <= lastSeq) {
      console.log('   └─ ' + colors.red + `✗ Invalid sequence! (${sequence} <= ${lastSeq})` + colors.reset);
      errors.push('INVALID_SEQUENCE');
    } else {
      console.log('   └─ ' + colors.green + `✓ Valid sequence (${sequence} > ${lastSeq})` + colors.reset);
    }
    
    console.log();
    
    // If all checks passed, update state
    if (errors.length === 0) {
      this.usedNonces.add(nonce);
      this.sequenceNumbers.set(conversationId, sequence);
      return { valid: true };
    }
    
    return { valid: false, errors };
  }
  
  // Reset for testing
  reset() {
    this.usedNonces.clear();
    this.sequenceNumbers.clear();
  }
}

// Generate a nonce
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// DEMO 1: What is a Replay Attack?
// ============================================
function demoWhatIsReplayAttack() {
  printBanner('WHAT IS A REPLAY ATTACK?');
  
  console.log('A replay attack occurs when an attacker:');
  console.log();
  console.log('  1. 🔍 Captures a valid message in transit');
  console.log('  2. 💾 Stores the captured message');
  console.log('  3. 📤 Resends (replays) it later');
  console.log();
  console.log('Even though the message is encrypted, replaying it can cause harm:');
  console.log();
  console.log('  Example: "Transfer $100 to Bob"');
  console.log('  ┌────────────────────────────────────────────────────────┐');
  console.log('  │ Alice ──────────────────────────────────────► Server   │');
  console.log('  │          [Encrypted: Transfer $100]                    │');
  console.log('  │                        │                               │');
  console.log('  │                        │ Attacker captures             │');
  console.log('  │                        ▼                               │');
  console.log('  │                   [Message copy]                       │');
  console.log('  │                        │                               │');
  console.log('  │                        │ Later, attacker replays       │');
  console.log('  │                        ▼                               │');
  console.log('  │ Attacker ──────────────────────────────────► Server   │');
  console.log('  │          [Same encrypted message]                      │');
  console.log('  │                                                        │');
  console.log('  │ Result: $200 transferred instead of $100!              │');
  console.log('  └────────────────────────────────────────────────────────┘');
  console.log();
}

// ============================================
// DEMO 2: Triple-Layer Protection
// ============================================
function demoTripleLayerProtection() {
  printBanner('TRIPLE-LAYER REPLAY PROTECTION');
  
  console.log('CryptShare-E2E uses THREE layers of protection:\n');
  
  console.log(colors.cyan + '┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Layer 1: NONCE (Number used ONCE)                          │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  • Each message has a unique random 128-bit nonce           │');
  console.log('│  • Server stores all seen nonces                            │');
  console.log('│  • If same nonce appears twice → REJECT                     │');
  console.log('│  • Prevents: Simple replay of captured messages             │');
  console.log('└─────────────────────────────────────────────────────────────┘' + colors.reset);
  console.log();
  
  console.log(colors.yellow + '┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Layer 2: TIMESTAMP                                         │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  • Each message includes current timestamp                  │');
  console.log('│  • Server checks: |now - timestamp| < 5 minutes             │');
  console.log('│  • Old messages → REJECT                                    │');
  console.log('│  • Prevents: Replay of messages captured long ago           │');
  console.log('└─────────────────────────────────────────────────────────────┘' + colors.reset);
  console.log();
  
  console.log(colors.green + '┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Layer 3: SEQUENCE NUMBER                                   │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  • Each message has incrementing sequence number            │');
  console.log('│  • Server tracks: next expected sequence per conversation   │');
  console.log('│  • If sequence ≤ last seen → REJECT                         │');
  console.log('│  • Prevents: Out-of-order replay attacks                    │');
  console.log('└─────────────────────────────────────────────────────────────┘' + colors.reset);
  console.log();
}

// ============================================
// DEMO 3: Live Attack Simulation
// ============================================
function demoLiveAttackSimulation() {
  printBanner('LIVE REPLAY ATTACK SIMULATION');
  
  const server = new ReplayProtectionServer();
  const conversationId = 'alice-bob';
  
  // Original legitimate message
  const originalMessage = {
    content: 'Encrypted: Transfer $100 to Bob',
    nonce: generateNonce(),
    timestamp: Date.now(),
    sequence: 1
  };
  
  printStep(1, 'Alice sends a legitimate message');
  console.log();
  console.log('   Message content: "Transfer $100 to Bob" (encrypted)');
  
  const result1 = server.validateMessage(originalMessage, conversationId);
  
  if (result1.valid) {
    printAccepted('Original message processed - $100 transferred');
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // ATTACK 1: Exact replay
  printStep(2, 'Attacker captures and replays the EXACT same message');
  console.log();
  console.log('   Attacker: "Let me replay this to transfer another $100!"');
  
  const result2 = server.validateMessage(originalMessage, conversationId);
  
  if (!result2.valid) {
    printRejected('Replay blocked!', result2.errors.join(', '));
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // ATTACK 2: New nonce, but old timestamp
  printStep(3, 'Attacker generates new nonce but uses old timestamp');
  console.log();
  console.log('   Attacker: "Maybe I just need a new nonce..."');
  
  const attackMessage2 = {
    ...originalMessage,
    nonce: generateNonce(),  // New nonce
    // timestamp stays old (10 minutes ago simulation)
    timestamp: Date.now() - 10 * 60 * 1000,
    sequence: 1  // Trying old sequence
  };
  
  const result3 = server.validateMessage(attackMessage2, conversationId);
  
  if (!result3.valid) {
    printRejected('Replay blocked!', result3.errors.join(', '));
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // ATTACK 3: New nonce, new timestamp, but old sequence
  printStep(4, 'Attacker uses new nonce + new timestamp but old sequence');
  console.log();
  console.log('   Attacker: "What if I update the timestamp too?"');
  
  const attackMessage3 = {
    ...originalMessage,
    nonce: generateNonce(),
    timestamp: Date.now(),  // Fresh timestamp
    sequence: 1  // Still old sequence!
  };
  
  const result4 = server.validateMessage(attackMessage3, conversationId);
  
  if (!result4.valid) {
    printRejected('Replay blocked!', result4.errors.join(', '));
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
  
  // LEGITIMATE: Next message with incremented sequence
  printStep(5, 'Alice sends ANOTHER legitimate message (sequence 2)');
  console.log();
  console.log('   Alice: "Transfer $50 to Carol" (new transaction)');
  
  const nextMessage = {
    content: 'Encrypted: Transfer $50 to Carol',
    nonce: generateNonce(),
    timestamp: Date.now(),
    sequence: 2  // Incremented!
  };
  
  const result5 = server.validateMessage(nextMessage, conversationId);
  
  if (result5.valid) {
    printAccepted('New message processed - $50 transferred to Carol');
  }
}

// ============================================
// DEMO 4: VERIFICATION LOGIC CODE
// ============================================
function demoVerificationLogic() {
  printBanner('VERIFICATION LOGIC IMPLEMENTATION');
  
  console.log(colors.cyan + 'The server-side verification code that rejects replays:' + colors.reset);
  console.log();
  console.log(colors.yellow + '// Server-side replay protection middleware' + colors.reset);
  console.log(`
function validateMessage(message, conversationId) {
  const { nonce, timestamp, sequence } = message;
  const errors = [];

  // ═══════════════════════════════════════════════════════════
  // LAYER 1: NONCE UNIQUENESS CHECK
  // ═══════════════════════════════════════════════════════════
  ${colors.green}if (usedNonces.has(nonce)) {
    // REJECT: This nonce was already used!
    errors.push('REPLAY_ATTACK: Duplicate nonce detected');
    logSecurityEvent('REPLAY_ATTACK_NONCE', { nonce });
  } else {
    usedNonces.add(nonce);  // Mark nonce as used
  }${colors.reset}

  // ═══════════════════════════════════════════════════════════
  // LAYER 2: TIMESTAMP FRESHNESS CHECK  
  // ═══════════════════════════════════════════════════════════
  ${colors.green}const now = Date.now();
  const age = Math.abs(now - timestamp);
  const WINDOW = 5 * 60 * 1000;  // 5 minutes
  
  if (age > WINDOW) {
    // REJECT: Message is too old!
    errors.push('REPLAY_ATTACK: Stale timestamp');
    logSecurityEvent('REPLAY_ATTACK_TIMESTAMP', { age, timestamp });
  }${colors.reset}

  // ═══════════════════════════════════════════════════════════
  // LAYER 3: SEQUENCE NUMBER CHECK
  // ═══════════════════════════════════════════════════════════
  ${colors.green}const lastSeq = sequenceNumbers.get(conversationId) || 0;
  
  if (sequence <= lastSeq) {
    // REJECT: Out-of-order or replayed sequence!
    errors.push('REPLAY_ATTACK: Invalid sequence number');
    logSecurityEvent('REPLAY_ATTACK_SEQUENCE', { sequence, lastSeq });
  } else {
    sequenceNumbers.set(conversationId, sequence);  // Update
  }${colors.reset}

  // ═══════════════════════════════════════════════════════════
  // FINAL DECISION: Accept or Reject
  // ═══════════════════════════════════════════════════════════
  if (errors.length > 0) {
    return { valid: false, errors };  // MESSAGE REJECTED
  }
  return { valid: true };  // MESSAGE ACCEPTED
}
`);
  console.log();
  
  console.log(colors.cyan + 'Key points:' + colors.reset);
  console.log('  1. Each layer is checked INDEPENDENTLY');
  console.log('  2. ANY failed check results in REJECTION');
  console.log('  3. Security events are LOGGED for audit');
  console.log('  4. State is updated ONLY if all checks pass');
  console.log();
}

// ============================================
// DEMO 5: Why All Three Layers Are Needed
// ============================================
function demoWhyThreeLayers() {
  printBanner('WHY ALL THREE LAYERS ARE NECESSARY');
  
  console.log('Each layer alone has weaknesses:\n');
  
  console.log(colors.red + '  Nonce only:' + colors.reset);
  console.log('    ✗ Attacker can replay within same session');
  console.log('    ✗ No protection after server restart (nonces lost)');
  console.log();
  
  console.log(colors.red + '  Timestamp only:' + colors.reset);
  console.log('    ✗ Attacker can replay within 5-minute window');
  console.log('    ✗ Same message can be replayed if sent again quickly');
  console.log();
  
  console.log(colors.red + '  Sequence only:' + colors.reset);
  console.log('    ✗ Attacker can send messages out of order');
  console.log('    ✗ If server loses sequence state, replays succeed');
  console.log();
  
  console.log(colors.green + '  All three together:' + colors.reset);
  console.log('    ✓ Nonce: Ensures message uniqueness');
  console.log('    ✓ Timestamp: Ensures message freshness');
  console.log('    ✓ Sequence: Ensures message ordering');
  console.log('    ✓ Defense in depth: Multiple barriers for attacker');
  console.log();
  
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│  Attack Vector        │ Nonce │ Timestamp │ Sequence │ All │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Exact replay         │  ✓    │    ✓      │    ✓     │ ✓✓✓ │');
  console.log('│  Quick replay (<5m)   │  ✓    │    ✗      │    ✓     │  ✓✓ │');
  console.log('│  Delayed replay       │  ✗    │    ✓      │    ✓     │  ✓✓ │');
  console.log('│  Out-of-order         │  ✓    │    ✗      │    ✓     │  ✓✓ │');
  console.log('│  After server restart │  ✗    │    ✓      │    ✗     │  ✓  │');
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log();
  console.log('✓ = Protected, ✗ = Vulnerable');
}

// ============================================
// MAIN: Run all demonstrations
// ============================================
console.log(colors.bright + colors.magenta);
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                                                          ║');
console.log('║          CryptShare-E2E Replay Attack Demo               ║');
console.log('║                                                          ║');
console.log('║   Demonstrates triple-layer replay protection:           ║');
console.log('║   Nonces + Timestamps + Sequence Numbers                 ║');
console.log('║                                                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(colors.reset);

// Run all demos
demoWhatIsReplayAttack();
demoTripleLayerProtection();
demoLiveAttackSimulation();
demoVerificationLogic();
demoWhyThreeLayers();

printBanner('CONCLUSION');

console.log(colors.green + '══════════════════════════════════════════════════════════════');
console.log('  REQUIREMENTS CHECKLIST - REPLAY ATTACK PROTECTION');
console.log('══════════════════════════════════════════════════════════════' + colors.reset);
console.log();
console.log('  ✓ Nonces                        - Implemented (Layer 1)');
console.log('  ✓ Timestamps                    - Implemented (Layer 2)');
console.log('  ✓ Message sequence numbers      - Implemented (Layer 3)');
console.log('  ✓ Verification logic to reject  - Implemented (validateMessage)');
console.log('  ✓ Attack demonstration          - This script!');
console.log();
console.log('Summary:');
console.log('1. Replay attacks can cause harm even with encrypted messages');
console.log('2. Single-layer protection has vulnerabilities');
console.log('3. CryptShare-E2E uses ALL THREE layers:');
console.log('   • Nonce: ' + colors.cyan + 'crypto.randomBytes(16)' + colors.reset + ' - Unique per message');
console.log('   • Timestamp: ' + colors.cyan + 'Date.now()' + colors.reset + ' - Fresh within 5-minute window');
console.log('   • Sequence: ' + colors.cyan + 'incrementing counter' + colors.reset + ' - Per conversation');
console.log('4. All three layers work together for defense in depth');
console.log();
console.log('Server file: server/middleware/replayProtection.js');
console.log('Client file: client/src/utils/replayProtection.js');
console.log('\nFor more details, see the Phase-6 documentation.\n');
