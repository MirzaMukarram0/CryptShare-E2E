import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Password strength indicator component
 * Memoized with useMemo for expensive calculations
 */
const PasswordStrength = memo(function PasswordStrength({ password }) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#666' };
    
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#ff4444', '#ff8800', '#ffcc00', '#88cc00', '#00cc44'];
    
    return {
      score,
      label: labels[Math.min(score, 4)] || '',
      color: colors[Math.min(score, 4)] || '#666'
    };
  }, [password]);

  if (!password) return null;

  const percentage = (strength.score / 5) * 100;

  return (
    <div className="password-strength" role="meter" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={5}>
      <div className="strength-bar">
        <div 
          className="strength-fill" 
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: strength.color 
          }}
        />
      </div>
      <span 
        className="strength-label" 
        style={{ color: strength.color }}
        aria-live="polite"
      >
        {strength.label}
      </span>
    </div>
  );
});

PasswordStrength.displayName = 'PasswordStrength';

PasswordStrength.propTypes = {
  password: PropTypes.string
};

export default PasswordStrength;
