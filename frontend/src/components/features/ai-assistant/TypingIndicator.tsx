export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500" />
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:.15s]" />
      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:.3s]" />
      <span className="ml-1">Assistant is typing…</span>
    </div>
  )
}
