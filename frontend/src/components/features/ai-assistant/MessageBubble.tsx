import React from 'react';

export interface AIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  metadata?: {
    processingTime?: number;
    confidence?: number;   // 0..1
    sources?: string[];
  };
}

export interface MessageBubbleProps {
  message: AIMessage;
  showMetadata?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, showMetadata = false }) => {
  const isUser = message.type === 'user';
  const ts = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lines = String(message.content || '').split('\n');

  const hasProcessing = typeof message.metadata?.processingTime === 'number';
  const hasConfidence = typeof message.metadata?.confidence === 'number';
  const hasSources   = Array.isArray(message.metadata?.sources) && message.metadata!.sources!.length > 0;

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        <div className="message-text">
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}{i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        <div className="message-meta">
          <span className="timestamp">{formatTime(ts)}</span>
          {showMetadata && (
            <>
              {hasProcessing && <span className="processing-time">{message.metadata!.processingTime}ms</span>}
              {hasConfidence && (
                <span className="confidence">
                  {Math.round((message.metadata!.confidence as number) * 100)}% confident
                </span>
              )}
              {hasSources && <span className="sources">Sources: {message.metadata!.sources!.join(', ')}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
