/**
 * useKeyExchange Hook
 * Manages CryptShare-KEX protocol for establishing secure sessions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  generateEphemeralKeyPair,
  createKexInit,
  processKexInitAndCreateResponse,
  processKexResponseAndCreateConfirm,
  processKexConfirm,
  exportSessionKey
} from '../crypto/keyExchange';
import {
  storeSessionKey,
  getSessionKey,
  hasSessionKey,
  storePendingKex,
  getPendingKex,
  removePendingKex
} from '../crypto/sessionKeyStore';
import {
  sendKexInit,
  sendKexResponse,
  sendKexConfirm,
  onKexInit,
  onKexResponse,
  onKexConfirm
} from '../services/socket';

// Console logging styles
const LOG_STYLES = {
  header: 'background: #ec4899; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
  info: 'color: #60a5fa;',
  success: 'color: #22c55e; font-weight: bold;',
  error: 'color: #ef4444; font-weight: bold;',
  detail: 'color: #94a3b8;'
};

export function useKeyExchange(currentUserId, getSigningKey, getUserPublicKeys) {
  const [keyExchangeStatus, setKeyExchangeStatus] = useState({}); // peerId -> 'pending' | 'complete' | 'error'
  const [error, setError] = useState(null);
  const ephemeralKeysRef = useRef(new Map()); // Store ephemeral keys during exchange

  /**
   * Initiate key exchange with a peer
   */
  const initiateKeyExchange = useCallback(async (peerId, peerPublicKeys) => {
    console.log('%c🔄 useKeyExchange: Initiating KEX', LOG_STYLES.header);
    console.log('%c    With peer: ' + peerId, LOG_STYLES.detail);
    
    // Check if we already have a session key
    if (hasSessionKey(peerId)) {
      console.log('%c✓ Session key already exists', LOG_STYLES.success);
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      return getSessionKey(peerId);
    }

    try {
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'pending' }));
      
      // Generate ephemeral keys for this exchange
      const ephemeralKeyPair = await generateEphemeralKeyPair();
      ephemeralKeysRef.current.set(peerId, ephemeralKeyPair);
      
      // Get my signing key
      const signingKey = await getSigningKey();
      
      // Create KEX_INIT
      const kexInit = await createKexInit(
        ephemeralKeyPair,
        signingKey,
        currentUserId,
        peerId
      );
      
      // Store pending state
      storePendingKex(peerId, {
        ephemeralKeyPair,
        myNonce: kexInit.nonce,
        peerPublicKeys
      });
      
      // Send via socket
      sendKexInit(kexInit);
      
      console.log('%c✓ KEX_INIT sent, waiting for response...', LOG_STYLES.info);
      
    } catch (err) {
      console.error('%c✗ Key exchange initiation failed:', LOG_STYLES.error, err);
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'error' }));
      setError(err.message);
    }
  }, [currentUserId, getSigningKey]);

  /**
   * Handle incoming KEX_INIT (we are responder)
   */
  const handleKexInit = useCallback(async (kexInit) => {
    console.log('%c📥 useKeyExchange: Received KEX_INIT', LOG_STYLES.header);
    console.log('%c    From: ' + kexInit.senderId, LOG_STYLES.detail);
    
    const peerId = kexInit.senderId;
    
    try {
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'pending' }));
      
      // Get peer's public signing key
      const peerPublicKeys = await getUserPublicKeys(peerId);
      
      // Generate our ephemeral keys
      const myEphemeralKeyPair = await generateEphemeralKeyPair();
      ephemeralKeysRef.current.set(peerId, myEphemeralKeyPair);
      
      // Get my signing key
      const signingKey = await getSigningKey();
      
      // Process KEX_INIT and create response
      const result = await processKexInitAndCreateResponse(
        kexInit,
        peerPublicKeys.signing,
        myEphemeralKeyPair,
        signingKey,
        currentUserId
      );
      
      // Store the session key
      storeSessionKey(peerId, result.sessionKey, {
        initiatorNonce: result.initiatorNonce,
        responderNonce: result.responderNonce,
        role: 'responder'
      });
      
      // Store pending for confirmation
      storePendingKex(peerId, {
        sessionKey: result.sessionKey,
        initiatorNonce: result.initiatorNonce,
        responderNonce: result.responderNonce,
        peerPublicKeys
      });
      
      // Send response
      sendKexResponse(result.response);
      
      console.log('%c✓ KEX_RESPONSE sent, waiting for confirmation...', LOG_STYLES.info);
      
    } catch (err) {
      console.error('%c✗ KEX_INIT processing failed:', LOG_STYLES.error, err);
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'error' }));
      setError(err.message);
    }
  }, [currentUserId, getSigningKey, getUserPublicKeys]);

  /**
   * Handle incoming KEX_RESPONSE (we are initiator)
   */
  const handleKexResponse = useCallback(async (kexResponse) => {
    console.log('%c📥 useKeyExchange: Received KEX_RESPONSE', LOG_STYLES.header);
    console.log('%c    From: ' + kexResponse.senderId, LOG_STYLES.detail);
    
    const peerId = kexResponse.senderId;
    
    try {
      // Get pending state
      const pendingState = getPendingKex(peerId);
      if (!pendingState) {
        throw new Error('No pending key exchange found');
      }
      
      // Get my signing key
      const signingKey = await getSigningKey();
      
      // Get peer's public keys
      const peerPublicKeys = pendingState.peerPublicKeys || await getUserPublicKeys(peerId);
      
      // Process response and create confirmation
      const result = await processKexResponseAndCreateConfirm(
        kexResponse,
        peerPublicKeys.signing,
        pendingState.ephemeralKeyPair.privateKey,
        signingKey,
        pendingState.myNonce,
        currentUserId
      );
      
      // Store the session key
      storeSessionKey(peerId, result.sessionKey, {
        initiatorNonce: result.initiatorNonce,
        responderNonce: result.responderNonce,
        role: 'initiator'
      });
      
      // Send confirmation
      sendKexConfirm(result.confirm);
      
      // Clean up
      removePendingKex(peerId);
      ephemeralKeysRef.current.delete(peerId);
      
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      
      console.log('%c🎉 Key exchange COMPLETE (initiator)', LOG_STYLES.success);
      
      return result.sessionKey;
      
    } catch (err) {
      console.error('%c✗ KEX_RESPONSE processing failed:', LOG_STYLES.error, err);
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'error' }));
      setError(err.message);
    }
  }, [currentUserId, getSigningKey, getUserPublicKeys]);

  /**
   * Handle incoming KEX_CONFIRM (we are responder)
   */
  const handleKexConfirm = useCallback(async (kexConfirm) => {
    console.log('%c📥 useKeyExchange: Received KEX_CONFIRM', LOG_STYLES.header);
    console.log('%c    From: ' + kexConfirm.senderId, LOG_STYLES.detail);
    
    const peerId = kexConfirm.senderId;
    
    try {
      // Get pending state
      const pendingState = getPendingKex(peerId);
      if (!pendingState) {
        throw new Error('No pending key exchange found');
      }
      
      // Get peer's public keys
      const peerPublicKeys = pendingState.peerPublicKeys || await getUserPublicKeys(peerId);
      
      // Verify confirmation
      await processKexConfirm(
        kexConfirm,
        peerPublicKeys.signing,
        pendingState.sessionKey,
        pendingState.initiatorNonce,
        pendingState.responderNonce,
        peerId,
        currentUserId
      );
      
      // Clean up
      removePendingKex(peerId);
      ephemeralKeysRef.current.delete(peerId);
      
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'complete' }));
      
      console.log('%c🎉 Key exchange COMPLETE (responder)', LOG_STYLES.success);
      
    } catch (err) {
      console.error('%c✗ KEX_CONFIRM processing failed:', LOG_STYLES.error, err);
      setKeyExchangeStatus(prev => ({ ...prev, [peerId]: 'error' }));
      setError(err.message);
    }
  }, [currentUserId, getUserPublicKeys]);

  /**
   * Setup socket listeners
   */
  useEffect(() => {
    onKexInit(handleKexInit);
    onKexResponse(handleKexResponse);
    onKexConfirm(handleKexConfirm);
    
    // Cleanup handled by socket disconnect
  }, [handleKexInit, handleKexResponse, handleKexConfirm]);

  /**
   * Get session key for a peer (or null if not established)
   */
  const getSessionKeyForPeer = useCallback((peerId) => {
    return getSessionKey(peerId);
  }, []);

  /**
   * Check if session is established with peer
   */
  const isSessionEstablished = useCallback((peerId) => {
    return hasSessionKey(peerId);
  }, []);

  return {
    initiateKeyExchange,
    getSessionKeyForPeer,
    isSessionEstablished,
    keyExchangeStatus,
    error
  };
}

export default useKeyExchange;
