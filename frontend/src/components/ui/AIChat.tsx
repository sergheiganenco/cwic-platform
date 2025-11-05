/**
 * AIChat Component
 * Floating AI assistant chat widget
 */
import React, { useState } from 'react';
import { Bot, ChevronDown, MessageSquare, X, Sparkles } from 'lucide-react';
import { cn } from '@/utils';
import { Button } from './Button';
import { Input } from './Input';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultMessages: Message[] = [
  {
    id: '1',
    type: 'assistant',
    text: "Hi! I'm your CWIC AI assistant. How can I help you today?",
    timestamp: new Date(),
  },
];

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I've analyzed your data sources and found 3 optimization opportunities. Would you like me to apply them?",
        "Your data quality score improved by 5% this week! Key improvements in Customer DB.",
        "I detected a new PII field in the users table. I've automatically applied classification policies.",
        "Based on your query patterns, I recommend adding an index on events.timestamp for 60% better performance.",
      ];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border-2 border-gray-200 flex flex-col max-h-[600px] z-50 animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI Assistant</h3>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.type === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                msg.type === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-white text-gray-900 border-2 border-gray-200'
              )}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border-2 border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t-2 border-gray-200 rounded-b-2xl bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <button
            onClick={handleSend}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-xl transition-all"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
