import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * User avatar component
 * Displays first character of username with consistent styling
 */
const Avatar = memo(function Avatar({ 
  username, 
  size = 'medium',
  status,
  className = '' 
}) {
  const sizeClasses = {
    small: 'user-avatar--small',
    medium: 'user-avatar--medium',
    large: 'user-avatar--large'
  };

  const initial = username?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className={`user-avatar ${sizeClasses[size] || ''} ${className}`}>
      {initial}
      {status && (
        <span 
          className={`status-indicator status-indicator--${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

Avatar.propTypes = {
  username: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  status: PropTypes.oneOf(['online', 'offline', 'away']),
  className: PropTypes.string
};

export default Avatar;
