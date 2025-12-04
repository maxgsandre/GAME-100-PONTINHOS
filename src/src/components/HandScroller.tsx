import { Card } from '../lib/deck';
import { parseCard, SUIT_SYMBOLS, SUIT_COLORS } from '../lib/deck';

export function HandScroller({
  cards,
  selectedCards,
  onCardSelect,
  selectable,
}: {
  cards: Card[];
  selectedCards: Card[];
  onCardSelect: (card: Card) => void;
  selectable: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {cards.map((card, index) => {
        const { rank, suit } = parseCard(card);
        const rankDisplay = rank === 'T' ? '10' : rank;
        const suitSymbol = SUIT_SYMBOLS[suit];
        const color = SUIT_COLORS[suit] === 'red' ? 'text-red-600' : 'text-gray-900';
        const isSelected = selectedCards.includes(card);

        return (
          <div
            key={`${card}-${index}`}
            onClick={() => selectable && onCardSelect(card)}
            className={`relative w-16 h-24 rounded-md shadow-xl transform transition-all active:scale-95 cursor-pointer hover:-translate-y-1 ${
              isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-900' : ''
            } ${!selectable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="absolute inset-0 bg-white rounded-md border border-gray-300">
              <div className="absolute top-0.5 left-0.5 flex flex-col items-center">
                <span className={`text-xs font-bold leading-none ${color}`}>{rankDisplay}</span>
                <span className={`text-sm leading-none ${color}`}>{suitSymbol}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={`text-2xl ${color}`}>{suitSymbol}</span>
                  <span className={`text-lg font-bold ${color}`}>{rankDisplay}</span>
                </div>
              </div>
              <div className="absolute bottom-0.5 right-0.5 flex flex-col items-center rotate-180">
                <span className={`text-xs font-bold leading-none ${color}`}>{rankDisplay}</span>
                <span className={`text-sm leading-none ${color}`}>{suitSymbol}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
