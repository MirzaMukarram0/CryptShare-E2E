/**
 * ============================================
 * MITM ATTACK DEMONSTRATION
 * ============================================
 * 
 * This script demonstrates:
 * 1. How MITM attack works against plain ECDH (no signatures)
 * 2. How digital signatures (ECDSA) prevent MITM in CryptShare-KEX
 * 
 * REQUIREMENTS COVERED:
 * ✓ Create an "attacker script" - This file!
 * ✓ Show how MITM successfully breaks DH without signatures
 * ✓ Show how digital signatures prevent MITM in final system
 * 
 * Run with: node mitm-demo.js
 */

const crypto = require('crypto');

// Console colors for clear output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
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

function printSuccess(text) {
  console.log(colors.green + '✓ ' + text + colors.reset);
}

function printFail(text) {
  console.log(colors.red + '✗ ' + text + colors.reset);
}

function printWarning(text) {
  console.log(colors.yellow + '⚠ ' + text + colors.reset);
}

// Generate ECDH key pair
function generateKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

// Generate ECDSA signing key pair  
function generateSigningKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

// Compute shared secret
function computeSharedSecret(privateKey, publicKey) {
  const ecdh = crypto.createECDH('prime256v1');
  
  // Parse the PEM keys
  const privateKeyObj = crypto.createPrivateKey(privateKey);
  const publicKeyObj = crypto.createPublicKey(publicKey);
  
  // Convert to raw format for ECDH
  const privateJwk = privateKeyObj.export({ format: 'jwk' });
  const publicJwk = publicKeyObj.export({ format: 'jwk' });
  
  ecdh.setPrivateKey(Buffer.from(privateJwk.d, 'base64url'));
  
  // Extract x,y coordinates from public key
  const x = Buffer.from(publicJwk.x, 'base64url');
  const y = Buffer.from(publicJwk.y, 'base64url');
  const uncompressedPoint = Buffer.concat([Buffer.from([0x04]), x, y]);
  
  return ecdh.computeSecret(uncompressedPoint);
}

// Sign data
function signData(privateKey, data) {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  return sign.sign(privateKey, 'base64');
}

// Verify signature
function verifySignature(publicKey, data, signature) {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  return verify.verify(publicKey, signature, 'base64');
}

// ============================================
// DEMO 1: MITM ATTACK SUCCEEDS (No Signatures)
// ============================================
function demoMITMWithoutSignatures() {
  printBanner('DEMO 1: MITM ATTACK WITHOUT SIGNATURES');
  
  log(colors.cyan, 'Scenario: Alice and Bob try to establish a shared key');
  log(colors.cyan, '          Mallory (attacker) intercepts all communication');
  console.log();
  
  // Generate keys for all parties
  printStep(1, 'Generating ECDH key pairs...');
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  const mallory = generateKeyPair();
  
  printSuccess('Alice generated her ECDH key pair');
  printSuccess('Bob generated his ECDH key pair');
  printWarning('Mallory (attacker) generated her own ECDH key pair');
  console.log();
  
  // Alice sends her public key (Mallory intercepts)
  printStep(2, 'Alice sends her public key to Bob...');
  console.log('   Alice → [public key] → Mallory → [modified] → Bob');
  console.log();
  
  printWarning('Mallory intercepts and replaces Alice\'s public key with her own!');
  const publicKeyToBob = mallory.publicKey; // Mallory's key, not Alice's!
  console.log();
  
  // Bob sends his public key (Mallory intercepts)
  printStep(3, 'Bob sends his public key to Alice...');
  console.log('   Bob → [public key] → Mallory → [modified] → Alice');
  console.log();
  
  printWarning('Mallory intercepts and replaces Bob\'s public key with her own!');
  const publicKeyToAlice = mallory.publicKey; // Mallory's key, not Bob's!
  console.log();
  
  // Compute "shared" secrets
  printStep(4, 'Computing shared secrets...');
  
  try {
    const aliceShared = computeSharedSecret(alice.privateKey, publicKeyToAlice);
    const bobShared = computeSharedSecret(bob.privateKey, publicKeyToBob);
    const malloryAlice = computeSharedSecret(mallory.privateKey, alice.publicKey);
    const malloryBob = computeSharedSecret(mallory.privateKey, bob.publicKey);
    
    console.log();
    console.log('   Alice computed:  ', aliceShared.toString('hex').substring(0, 32) + '...');
    console.log('   Bob computed:    ', bobShared.toString('hex').substring(0, 32) + '...');
    console.log('   Mallory-Alice:   ', malloryAlice.toString('hex').substring(0, 32) + '...');
    console.log('   Mallory-Bob:     ', malloryBob.toString('hex').substring(0, 32) + '...');
    console.log();
    
    // Check if Alice and Bob have the same key
    const aliceBobMatch = aliceShared.equals(bobShared);
    const malloryCanDecryptAlice = aliceShared.equals(malloryAlice);
    const malloryCanDecryptBob = bobShared.equals(malloryBob);
    
    printStep(5, 'Analyzing the attack...');
    console.log();
    
    if (!aliceBobMatch) {
      printFail('Alice and Bob have DIFFERENT shared secrets!');
    }
    
    if (malloryCanDecryptAlice) {
      printWarning('Mallory shares the same key as Alice!');
      printWarning('Mallory can DECRYPT all messages from Alice!');
    }
    
    if (malloryCanDecryptBob) {
      printWarning('Mallory shares the same key as Bob!');
      printWarning('Mallory can DECRYPT all messages from Bob!');
    }
    
    console.log();
    log(colors.red + colors.bright, '╔══════════════════════════════════════════════════════════╗');
    log(colors.red + colors.bright, '║                 🚨 ATTACK SUCCESSFUL! 🚨                  ║');
    log(colors.red + colors.bright, '║                                                          ║');
    log(colors.red + colors.bright, '║  Mallory can now:                                        ║');
    log(colors.red + colors.bright, '║  • Read all messages between Alice and Bob               ║');
    log(colors.red + colors.bright, '║  • Modify messages in transit                            ║');
    log(colors.red + colors.bright, '║  • Impersonate both parties                              ║');
    log(colors.red + colors.bright, '╚══════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('Error in demo:', error.message);
  }
}

// ============================================
// DEMO 2: MITM ATTACK FAILS (With Signatures)
// ============================================
function demoMITMWithSignatures() {
  printBanner('DEMO 2: MITM ATTACK WITH SIGNATURES (CryptShare-KEX)');
  
  log(colors.cyan, 'Scenario: Alice and Bob use ECDSA signatures to authenticate');
  log(colors.cyan, '          Mallory tries the same attack but FAILS');
  console.log();
  
  // Generate keys for all parties
  printStep(1, 'Generating key pairs...');
  const alice = {
    ecdh: generateKeyPair(),
    signing: generateSigningKeyPair()
  };
  const bob = {
    ecdh: generateKeyPair(),
    signing: generateSigningKeyPair()
  };
  const mallory = {
    ecdh: generateKeyPair(),
    signing: generateSigningKeyPair()
  };
  
  printSuccess('Alice generated ECDH + ECDSA key pairs');
  printSuccess('Bob generated ECDH + ECDSA key pairs');
  printWarning('Mallory generated her own key pairs');
  console.log();
  
  // Simulate long-term public key distribution (out of band)
  printStep(2, 'Public signing keys are pre-distributed (server stores them)');
  console.log('   • Bob knows Alice\'s signing public key');
  console.log('   • Alice knows Bob\'s signing public key');
  console.log('   • These were registered when users signed up');
  console.log();
  
  // Alice sends signed KEX_INIT
  printStep(3, 'Alice creates and signs KEX_INIT message...');
  
  const aliceKexInit = {
    senderId: 'alice',
    receiverId: 'bob',
    ephemeralPublicKey: alice.ecdh.publicKey,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  // Sign the message with Alice's signing key
  const dataToSign = JSON.stringify(aliceKexInit);
  const aliceSignature = signData(alice.signing.privateKey, dataToSign);
  
  printSuccess('Alice signed her message with ECDSA');
  console.log('   Signature: ' + aliceSignature.substring(0, 40) + '...');
  console.log();
  
  // Mallory intercepts
  printStep(4, 'Mallory intercepts the message...');
  printWarning('Mallory receives Alice\'s signed KEX_INIT');
  console.log();
  
  // Mallory tries to modify the message
  printStep(5, 'Mallory attempts to replace the ephemeral public key...');
  
  const modifiedKexInit = {
    ...aliceKexInit,
    ephemeralPublicKey: mallory.ecdh.publicKey  // Mallory's key!
  };
  
  printWarning('Mallory changed ephemeralPublicKey to her own');
  console.log();
  
  // Mallory tries to use Alice's signature with modified data
  printStep(6, 'Mallory forwards modified message with original signature...');
  console.log();
  
  // Bob receives and verifies
  printStep(7, 'Bob receives and verifies the signature...');
  
  const modifiedDataToVerify = JSON.stringify(modifiedKexInit);
  
  // Verify with Alice's known public signing key
  const signatureValid = verifySignature(
    alice.signing.publicKey,  // Bob uses Alice's KNOWN public key
    modifiedDataToVerify,     // The modified message
    aliceSignature            // The original signature
  );
  
  console.log();
  if (signatureValid) {
    printSuccess('Signature valid - message accepted');
  } else {
    printFail('SIGNATURE VERIFICATION FAILED!');
    console.log();
    console.log('   Bob\'s verification logic:');
    console.log('   1. Expected: Signature by Alice on received data');
    console.log('   2. Found: Signature by Alice on DIFFERENT data');
    console.log('   3. Result: Signature does NOT match modified message');
  }
  
  console.log();
  
  // Explain why Mallory can't create a valid signature
  printStep(8, 'Why Mallory cannot create a valid signature:');
  console.log();
  console.log('   • Alice\'s signature = ECDSA(Alice_PrivateKey, Original_Message)');
  console.log('   • Mallory doesn\'t have Alice\'s private key');
  console.log('   • Mallory can\'t create: ECDSA(Alice_PrivateKey, Modified_Message)');
  console.log('   • If Mallory uses her own key: Bob won\'t accept it!');
  console.log();
  
  log(colors.green + colors.bright, '╔══════════════════════════════════════════════════════════╗');
  log(colors.green + colors.bright, '║               🛡️ MITM ATTACK PREVENTED! 🛡️                ║');
  log(colors.green + colors.bright, '║                                                          ║');
  log(colors.green + colors.bright, '║  Digital signatures ensure:                              ║');
  log(colors.green + colors.bright, '║  • Authenticity: Message is from claimed sender         ║');
  log(colors.green + colors.bright, '║  • Integrity: Message has not been modified             ║');
  log(colors.green + colors.bright, '║  • Non-repudiation: Sender cannot deny sending          ║');
  log(colors.green + colors.bright, '╚══════════════════════════════════════════════════════════╝');
}

// ============================================
// MAIN: Run both demonstrations
// ============================================
console.log(colors.bright + colors.magenta);
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                                                          ║');
console.log('║           CryptShare-E2E MITM Attack Demo                ║');
console.log('║                                                          ║');
console.log('║   Demonstrates how ECDSA signatures prevent MITM         ║');
console.log('║   attacks in the CryptShare-KEX protocol                 ║');
console.log('║                                                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(colors.reset);

// Run demonstrations
demoMITMWithoutSignatures();
console.log('\n\n');
demoMITMWithSignatures();

console.log('\n');
printBanner('COMPARISON: ECDH vs ECDH+ECDSA');

console.log(colors.cyan + '┌────────────────────────────────────────────────────────────┐');
console.log('│  Property            │ Plain ECDH  │ CryptShare-KEX       │');
console.log('├────────────────────────────────────────────────────────────┤');
console.log('│  Key Exchange        │ ECDH        │ ECDH + ECDSA         │');
console.log('│  Authentication      │ ✗ None      │ ✓ Digital Signatures  │');
console.log('│  MITM Vulnerable     │ ✗ YES       │ ✓ NO                 │');
console.log('│  Key Substitution    │ ✗ Possible  │ ✓ Detected           │');
console.log('│  Identity Binding    │ ✗ None      │ ✓ Signatures bind    │');
console.log('│  Forward Secrecy     │ ✓ Yes       │ ✓ Yes (ephemeral)    │');
console.log('└────────────────────────────────────────────────────────────┘' + colors.reset);
console.log();

printBanner('CONCLUSION');

console.log(colors.green + '══════════════════════════════════════════════════════════════');
console.log('  REQUIREMENTS CHECKLIST - MITM ATTACK DEMONSTRATION');
console.log('══════════════════════════════════════════════════════════════' + colors.reset);
console.log();
console.log('  ✓ Created attacker script          - This file!');
console.log('  ✓ MITM breaks DH without signatures - Demo 1 above');
console.log('  ✓ Digital signatures prevent MITM   - Demo 2 above');
console.log();
console.log('Summary:');
console.log('1. Plain ECDH key exchange is vulnerable to MITM attacks');
console.log('2. Attacker can intercept and replace public keys');
console.log('3. Digital signatures (ECDSA) bind public keys to identities');
console.log('4. CryptShare-KEX signs all key exchange messages');
console.log('5. Any modification breaks the signature verification');
console.log();
console.log('CryptShare-KEX Protocol (client/src/crypto/keyExchange.js):');
console.log('  • KEX_INIT:     Signed with sender\'s ECDSA key');
console.log('  • KEX_RESPONSE: Signed with responder\'s ECDSA key');
console.log('  • KEX_CONFIRM:  Hash confirmation of session key');
console.log('\nFor more details, see the Phase-6 documentation.\n');
