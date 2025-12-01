import React, { memo } from 'react';

/**
 * Reusable loading spinner component
 * Memoized to prevent unnecessary re-renders
 */
const LoadingSpinner = memo(function LoadingSpinner({ 
  size = 'medium', 
  text = '', 
  fullScreen = false 
}) {
  const sizeClasses = {
    small: 'loading-spinner--small',
    medium: 'loading-spinner--medium',
    large: 'loading-spinner--large'
  };

  if (fullScreen) {
    return (
      <div className="loading">
        <div className={`loading-spinner ${sizeClasses[size] || ''}`} />
        {text && <div className="loading-text">{text}</div>}
      </div>
    );
  }

  return (
    <div className="loading-inline">
      <div className={`loading-spinner ${sizeClasses[size] || ''}`} />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
