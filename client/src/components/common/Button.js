import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable button component
 * Memoized to prevent unnecessary re-renders
 */
const Button = memo(function Button({
  type = 'button',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  children,
  onClick,
  className = '',
  ...rest
}) {
  const buttonClasses = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full-width' : '',
    loading ? 'btn--loading' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          <span className="btn-text">Loading...</span>
        </>
      ) : (
        <span className="btn-text">{children}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

Button.propTypes = {
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  className: PropTypes.string
};

export default Button;
