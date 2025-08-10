// src/components/features/ai-assistant/ChatInterface.tsx
import * as React from 'react'
import { ActionButtons } from './ActionButtons'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: string
}

export interface ChatInterfaceProps {
  initialMessages?: ChatMessage[]
  onSend?: (text: string) => Promise<void> | void
}

export function ChatInterface({ initialMessages = [], onSend }: ChatInterfaceProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = React.useState('') 
  const [isTyping, setIsTyping] = React.useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    const msg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text, timestamp: new Date().toISOString() }
    setMessages((m) => [...m, msg])
    setInput('')
    try {
      setIsTyping(true)
      await onSend?.(text)
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} timestamp={m.timestamp} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>
      <div className="border-t p-3">
        <ActionButtons
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isTyping}
        />
      </div>
    </div>
  )
}
