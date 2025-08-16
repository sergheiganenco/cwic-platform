import React from 'react';

interface ActionButtonsProps {
  onClearChat: () => void;
  onRetry: () => void;
  disabled?: boolean;
  messageCount: number;
  characterCount: number;
  maxCharacters?: number;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onClearChat,
  onRetry,
  disabled = false,
  messageCount,
  characterCount,
  maxCharacters = 500
}) => {
  return (
    <div className="action-buttons">
      <div className="button-group">
        <button
          onClick={onClearChat}
          disabled={disabled || messageCount === 0}
          className="action-btn clear-btn"
          title="Clear chat history"
        >
          🗑️ Clear Chat
        </button>
        
        <button
          onClick={onRetry}
          disabled={disabled || messageCount === 0}
          className="action-btn retry-btn"
          title="Retry last message"
        >
          🔄 Retry
        </button>
      </div>
      
      <div className="chat-info">
        <span className="message-count">
          Messages: {messageCount}
        </span>
        
        <span className={`character-count ${characterCount > maxCharacters * 0.9 ? 'warning' : ''}`}>
          {characterCount}/{maxCharacters}
        </span>
      </div>
    </div>
  );
};

// Default export for compatibility
export default ActionButtons;