import React, { useState, useCallback, useRef, memo } from 'react';
import { uploadEncryptedFile, downloadAndDecryptFile } from '../services/fileService';
import { formatFileSize } from '../crypto/fileEncryption';

// File type icons
const FILE_ICONS = {
  'image': '🖼️',
  'video': '🎬',
  'audio': '🎵',
  'application/pdf': '📄',
  'text': '📝',
  'application/zip': '📦',
  'application/x-zip-compressed': '📦',
  'default': '📎'
};

/**
 * Get icon for file type
 */
function getFileIcon(mimeType) {
  if (!mimeType) return FILE_ICONS.default;
  
  const type = mimeType.split('/')[0];
  return FILE_ICONS[mimeType] || FILE_ICONS[type] || FILE_ICONS.default;
}

/**
 * FileUploadButton - Triggers file selection
 */
export const FileUploadButton = memo(function FileUploadButton({ 
  onFileSelect, 
  disabled = false,
  className = ''
}) {
  const inputRef = useRef(null);
  
  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);
  
  const handleChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }, [onFileSelect]);
  
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`file-upload-btn ${className}`}
        title="Share encrypted file"
        aria-label="Share file"
      >
        📎
      </button>
    </>
  );
});

/**
 * FileUploadProgress - Shows upload progress
 */
export const FileUploadProgress = memo(function FileUploadProgress({ 
  file, 
  progress, 
  status 
}) {
  return (
    <div className="file-upload-progress">
      <div className="file-info">
        <span className="file-icon">{getFileIcon(file?.type)}</span>
        <span className="file-name">{file?.name || 'Unknown'}</span>
        <span className="file-size">{file ? formatFileSize(file.size) : ''}</span>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="upload-status">{status}</div>
    </div>
  );
});

/**
 * FileMessage - Displays a file in the chat
 */
export const FileMessage = memo(function FileMessage({ 
  file, 
  sent, 
  onDownload,
  downloading = false,
  timestamp
}) {
  const icon = getFileIcon(file.metadata?.type);
  const isImage = file.metadata?.type?.startsWith('image/');
  
  // Format timestamp to readable time
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className={`file-message ${sent ? 'sent' : 'received'}`}>
      <div className="file-message-content">
        <div className="file-header">
          <span className="file-icon">{icon}</span>
          <span className="file-name">{file.metadata?.name || 'Unknown file'}</span>
        </div>
        <div className="file-details">
          <span className="file-size">{formatFileSize(file.metadata?.size || 0)}</span>
          <span className="file-type">{file.metadata?.type || 'Unknown type'}</span>
        </div>
        <button
          className="file-download-btn"
          onClick={() => onDownload(file)}
          disabled={downloading}
        >
          {downloading ? '⏳ Decrypting...' : '⬇️ Download & Decrypt'}
        </button>
        {isImage && (
          <div className="file-preview-hint">
            🔒 Encrypted image - download to view
          </div>
        )}
        {timestamp && (
          <span className="file-time">{formatTime(timestamp)}</span>
        )}
      </div>
    </div>
  );
});

/**
 * FileShareModal - Full-screen file sharing interface
 */
export function FileShareModal({ 
  isOpen, 
  onClose, 
  myUserId, 
  recipientId, 
  recipientName,
  onFileShared 
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  }, []);
  
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      setStatus('Encrypting file...');
      
      const result = await uploadEncryptedFile(
        myUserId,
        recipientId,
        selectedFile,
        (p) => {
          setProgress(p);
          if (p < 50) setStatus('Encrypting file...');
          else if (p < 90) setStatus('Uploading encrypted data...');
          else setStatus('Finalizing...');
        }
      );
      
      setStatus('File shared successfully!');
      setProgress(100);
      
      // Notify parent
      if (onFileShared) {
        onFileShared({
          fileId: result.fileId,
          metadata: result.metadata
        });
      }
      
      // Close after short delay
      setTimeout(() => {
        setSelectedFile(null);
        setUploading(false);
        setProgress(0);
        setStatus('');
        onClose();
      }, 1500);
      
    } catch (err) {
      setError(err.message || 'Upload failed');
      setStatus('Upload failed');
      setUploading(false);
    }
  }, [selectedFile, myUserId, recipientId, onFileShared, onClose]);
  
  const handleCancel = useCallback(() => {
    if (!uploading) {
      setSelectedFile(null);
      setError(null);
      onClose();
    }
  }, [uploading, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="file-share-modal-overlay" onClick={handleCancel}>
      <div className="file-share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔒 Share Encrypted File</h3>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="share-info">
            Share a file with <strong>{recipientName}</strong>
          </p>
          <p className="encryption-notice">
            📌 Files are encrypted locally before upload. The server cannot see file contents.
          </p>
          
          {!selectedFile ? (
            <div className="file-select-area">
              <label className="file-select-label">
                <input 
                  type="file" 
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <span className="file-select-text">
                  📁 Click or drag to select a file
                </span>
              </label>
            </div>
          ) : (
            <div className="selected-file-info">
              <div className="file-preview">
                <span className="file-icon-large">{getFileIcon(selectedFile.type)}</span>
                <div className="file-details">
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-meta">
                    {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                  </span>
                </div>
              </div>
              
              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="progress-status">{status}</span>
                </div>
              )}
              
              {error && (
                <div className="upload-error">
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-cancel" 
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancel
          </button>
          <button 
            className="btn-upload"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? '🔐 Encrypting & Uploading...' : '🚀 Encrypt & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * useFileHandler - Hook for handling file operations
 */
export function useFileHandler(myUserId) {
  const [downloading, setDownloading] = useState({});
  
  const handleDownload = useCallback(async (file, peerId) => {
    const fileId = file._id || file.fileId;
    
    if (downloading[fileId]) return;
    
    setDownloading(prev => ({ ...prev, [fileId]: true }));
    
    try {
      await downloadAndDecryptFile(
        myUserId,
        fileId,
        peerId,  // Peer ID for conversation key derivation
        () => {} // Progress callback
      );
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file: ' + error.message);
    } finally {
      setDownloading(prev => ({ ...prev, [fileId]: false }));
    }
  }, [myUserId, downloading]);
  
  return { downloading, handleDownload };
}

export default {
  FileUploadButton,
  FileUploadProgress,
  FileMessage,
  FileShareModal,
  useFileHandler
};
