import { Button } from '@components/ui/Button';
export function ActionButtons({ value, onChange, onSend, disabled }: { value: string; onChange: (v:string)=>void; onSend: ()=>void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        placeholder="Type a message…"
        className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <Button onClick={onSend} disabled={disabled}>Send</Button>
    </div>
  )
}
