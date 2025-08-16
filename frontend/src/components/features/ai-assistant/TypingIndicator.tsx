import React from 'react';

interface TypingIndicatorProps {
  className?: string;
  message?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  className = '', 
  message = 'AI is thinking...' 
}) => {
  return (
    <div className={`typing-indicator ${className}`}>
      <div className="typing-bubble">
        <div className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <div className="typing-message">{message}</div>
      </div>
    </div>
  );
};

// Default export for compatibility
export default TypingIndicator;