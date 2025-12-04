import { Card } from '../lib/deck';
import { parseCard, SUIT_SYMBOLS, SUIT_COLORS } from '../lib/deck';

export function DeckArea({
  stockCount,
  discardTop,
  canPlay,
  onBuyStock,
  onBuyDiscard,
}: {
  stockCount: number;
  discardTop?: Card | null;
  canPlay: boolean;
  onBuyStock: () => void;
  onBuyDiscard: () => void;
}) {
  const renderDiscardCard = () => {
    if (!discardTop) return null;
    
    const { rank, suit } = parseCard(discardTop);
    const rankDisplay = rank === 'T' ? '10' : rank;
    const suitSymbol = SUIT_SYMBOLS[suit];
    const color = SUIT_COLORS[suit] === 'red' ? 'text-red-600' : 'text-gray-900';

    return (
      <div className="absolute inset-0 bg-white rounded-lg border border-gray-300">
        <div className="absolute top-1 left-1 flex flex-col items-center">
          <span className={`text-lg font-bold ${color} leading-none`}>{rankDisplay}</span>
          <span className={`text-xl ${color} leading-none`}>{suitSymbol}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-5xl ${color}`}>{suitSymbol}</span>
        </div>
        <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
          <span className={`text-lg font-bold ${color} leading-none`}>{rankDisplay}</span>
          <span className={`text-xl ${color} leading-none`}>{suitSymbol}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onBuyStock}
          disabled={!canPlay}
          className="relative w-24 h-32 rounded-lg shadow-2xl transform transition-transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-800 via-red-900 to-red-950 rounded-lg border-2 border-red-700">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-2 border-2 border-red-500 rounded-md"></div>
              <div className="absolute inset-4 border border-red-500 rounded-sm"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-red-500 flex items-center justify-center bg-red-950">
                <div className="text-red-400 text-xs font-bold">{stockCount}</div>
              </div>
            </div>
          </div>
        </button>
        <span className="text-xs font-bold text-white">Monte</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onBuyDiscard}
          disabled={!canPlay || !discardTop}
          className="relative w-24 h-32 rounded-lg shadow-2xl transform transition-transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          {renderDiscardCard()}
        </button>
        <span className="text-xs font-bold text-white">Descarte</span>
      </div>
    </>
  );
}
