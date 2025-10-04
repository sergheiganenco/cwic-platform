
type Props = {
  open: boolean;
  onClose: () => void;
};

export default function QuickActions({ open, onClose }: Props) {
  if (!open) return null;

  const actions = [
    { id: 'new-request', label: 'New Request' },
    { id: 'ingest-now', label: 'Trigger Ingestion' },
    { id: 'open-settings', label: 'Open Settings' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-sm font-medium text-gray-900">Quick Actions</div>
        <ul className="space-y-2">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                className="w-full rounded border px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={onClose}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <button className="text-sm text-blue-600 hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
