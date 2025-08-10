export function MessageBubble({ role, text, timestamp }: { role: 'user'|'assistant'|'system'; text: string; timestamp?: string }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
        <div>{text}</div>
        {timestamp && <div className="mt-1 text-[10px] opacity-70">{new Date(timestamp).toLocaleTimeString()}</div>}
      </div>
    </div>
  )
}
