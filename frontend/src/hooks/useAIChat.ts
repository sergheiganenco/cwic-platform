import { useCallback, useEffect, useRef, useState } from 'react';
import { aiAssistantService } from '../services/api/aiAssistant';

// Type-only imports
import type { AIMessage } from '../components/features/ai-assistant/MessageBubble';
import type { AIResponse } from '../services/api/aiAssistant';

type ConnStatus = 'connected' | 'disconnected' | 'connecting';

interface UseAIChatReturn {
  messages: AIMessage[];
  loading: boolean;
  connected: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => void;
  isTyping: boolean;
  connectionStatus: ConnStatus;
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? '') ||
  `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useAIChat = (): UseAIChatReturn => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnStatus>('disconnected');

  const abortControllerRef = useRef<AbortController | null>(null);
  const connectionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Track last user message content for reliable retry
  const lastUserMessageRef = useRef<string | null>(null);

  // ---- Connection checks
  const checkConnection = useCallback(async () => {
    try {
      // Only show “connecting” when we don’t already know we’re connected
      setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'connecting'));
      const isConnected = await aiAssistantService.isConnected();
      if (!mountedRef.current) return;

      setConnected(isConnected);
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (err) {
      if (!mountedRef.current) return;
      console.warn('Connection check failed:', err);
      setConnected(false);
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial check (don’t await to avoid blocking render)
    void checkConnection();

    // Periodic checks
    connectionCheckIntervalRef.current = setInterval(checkConnection, 10_000);

    return () => {
      mountedRef.current = false;
      if (connectionCheckIntervalRef.current) clearInterval(connectionCheckIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [checkConnection]);

  // ---- Send message
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    const trimmedContent = content?.trim();
    if (!trimmedContent) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage: AIMessage = {
      id: `user_${uid()}`,
      type: 'user',
      content: trimmedContent,
      timestamp: new Date()
    };

    // Update last user content for retry
    lastUserMessageRef.current = trimmedContent;

    // Push user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setIsTyping(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const startTime = performance.now();

      // Build options and pass signal if service supports it
      const opts: any = { requestId: userMessage.id };
      if (signal) opts.signal = signal;

      const response: AIResponse = await aiAssistantService.sendMessageWithFallback(
        trimmedContent,
        opts
      );

      const processingTime = Math.round(performance.now() - startTime);
      if (!mountedRef.current) return;

      if (response?.success && response.data) {
        const assistantMessage: AIMessage = {
          id: `assistant_${uid()}`,
          type: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
          metadata: {
            processingTime,
            // default confidence if not provided
            confidence: response.meta?.confidence ?? 0.9,
            // prefer explicit sources from service, else a generic marker if results exist
            sources: response.data.sources ?? (response.data.results ? ['AI Analysis'] : undefined)
          }
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConnected(true);
        setConnectionStatus('connected');
      } else {
        const errMsg = response?.error?.message || 'Failed to get response from AI service';
        setError(errMsg);

        const errorAssistantMessage: AIMessage = {
          id: `error_${uid()}`,
          type: 'assistant',
          content: `Sorry, I encountered an error: ${errMsg}. Please try again.`,
          timestamp: new Date(),
          metadata: {
            processingTime,
            confidence: 0,
            sources: ['Error Handler']
          }
        };
        setMessages((prev) => [...prev, errorAssistantMessage]);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      const e = err as Error;
      if (e.name !== 'AbortError') {
        const errMsg = e.message || 'An unexpected error occurred';
        setError(errMsg);

        console.error('AI Chat Error:', {
          message: errMsg,
          stack: e.stack,
          userMessage: lastUserMessageRef.current,
          timestamp: new Date().toISOString()
        });

        // Surface a readable assistant message on unexpected errors
        setMessages((prev) => [
          ...prev,
          {
            id: `error_${uid()}`,
            type: 'assistant',
            content: `⚠️ ${errMsg}`,
            timestamp: new Date(),
            metadata: { sources: ['Client Error'] }
          }
        ]);
      }
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  }, []);

  // ---- Clear
  const clearMessages = useCallback((): void => {
    setMessages([]);
    setError(null);
    lastUserMessageRef.current = null;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setLoading(false);
    setIsTyping(false);
  }, []);

  // ---- Retry last user message
  const retryLastMessage = useCallback((): void => {
    const lastContent =
      lastUserMessageRef.current ||
      // fallback if ref is empty: find most recent user message from state
      (messages.length
        ? [...messages].reverse().find((m) => m.type === 'user')?.content ?? null
        : null);

    if (!lastContent) {
      console.warn('No user message found to retry');
      return;
    }

    // If the last bubble is an assistant error/partial, remove it before retry
    setMessages((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.type === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });

    void sendMessage(lastContent);
  }, [messages, sendMessage]);

  return {
    messages,
    loading,
    connected,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
    isTyping,
    connectionStatus
  };
};

// Export the hook type
export type { UseAIChatReturn };

