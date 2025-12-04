import { ChevronDown } from 'lucide-react';

type Action = { id: string; label: string; danger?: boolean; type?: 'primary' | 'default'; disabled?: boolean };

export function ActionFab({
  actions,
  onAction,
  disabled,
}: {
  actions: Action[];
  onAction: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            if (!a.disabled && !disabled) {
              onAction(a.id);
            }
          }}
          disabled={a.disabled || disabled}
          type="button"
          className={`w-full rounded-lg transition-all active:scale-[0.99] ${
            a.disabled || disabled
              ? 'bg-emerald-800/30 text-emerald-500 border border-emerald-700/30 cursor-not-allowed text-xs'
              : a.danger
              ? 'bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-5 shadow-lg'
              : a.type === 'primary'
              ? 'bg-emerald-800/50 border border-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-between text-xs'
              : 'bg-emerald-800/50 border border-emerald-600 text-white hover:bg-emerald-700 text-xs'
          }`}
        >
          {a.type === 'primary' ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              <span>{a.label}</span>
            </>
          ) : (
            a.label
          )}
        </button>
      ))}
    </div>
  );
}
