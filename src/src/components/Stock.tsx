interface StockProps {
  count: number;
  onDraw?: () => void;
  disabled?: boolean;
}

export function Stock({ count, onDraw, disabled }: StockProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onDraw}
        disabled={disabled || count === 0}
        className={`
          w-20 h-28 rounded-lg shadow-lg
          bg-blue-600 border-4 border-blue-800
          flex items-center justify-center
          transition-all duration-200
          ${!disabled && count > 0 ? 'hover:scale-105 hover:shadow-xl cursor-pointer active:scale-95' : 'opacity-50 cursor-not-allowed'}
        `}
      >
        <div className="text-white text-center">
          <div className="text-2xl">🎴</div>
          <div className="text-xs mt-1">{count}</div>
        </div>
      </button>
      <p className="text-xs text-gray-600">Monte</p>
    </div>
  );
}
