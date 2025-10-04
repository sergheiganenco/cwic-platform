
type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CommandPalette({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-sm text-gray-600">Command Palette</div>
        <input
          autoFocus
          className="w-full rounded border px-3 py-2 text-sm outline-none"
          placeholder="Type a command…"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <div className="mt-3 flex justify-end">
          <button className="text-sm text-blue-600 hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
