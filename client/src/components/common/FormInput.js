import React, { memo, forwardRef, useCallback, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable form input component with validation support
 * Memoized and uses forwardRef for ref forwarding
 */
const FormInput = memo(forwardRef(function FormInput({
  type = 'text',
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  hint,
  disabled = false,
  autoComplete,
  autoFocus = false,
  name,
  id,
  required = false,
  className = '',
  showPasswordToggle = false,
  ...rest
}, ref) {
  const [showPassword, setShowPassword] = useState(false);
  
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = Boolean(error);
  const hasSuccess = value && !hasError;
  
  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const inputType = showPasswordToggle && type === 'password' 
    ? (showPassword ? 'text' : 'password') 
    : type;

  const formGroupClasses = [
    'form-group',
    hasError ? 'has-error' : '',
    hasSuccess ? 'has-success' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={formGroupClasses}>
      {label && (
        <label htmlFor={inputId}>
          {label}
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </label>
      )}
      
      <div className={showPasswordToggle ? 'password-input-wrapper' : undefined}>
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        
        {showPasswordToggle && (
          <button 
            type="button" 
            className="password-toggle"
            onClick={handleTogglePassword}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      
      {hint && !error && (
        <span id={`${inputId}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      
      {error && (
        <span id={`${inputId}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}));

FormInput.displayName = 'FormInput';

FormInput.propTypes = {
  type: PropTypes.string,
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  disabled: PropTypes.bool,
  autoComplete: PropTypes.string,
  autoFocus: PropTypes.bool,
  name: PropTypes.string,
  id: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  showPasswordToggle: PropTypes.bool
};

export default FormInput;
