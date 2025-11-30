import { useState } from 'react';
import { Card, sortCards } from '../lib/deck';
import { CardComponent } from './CardComponent';

interface HandProps {
  cards: Card[];
  onCardSelect?: (cards: Card[]) => void;
  selectable?: boolean;
}

export function Hand({ cards, onCardSelect, selectable = false }: HandProps) {
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  const sortedCards = sortCards(cards);

  const handleCardClick = (card: Card) => {
    if (!selectable) return;

    let newSelected: Card[];
    if (selectedCards.includes(card)) {
      newSelected = selectedCards.filter(c => c !== card);
    } else {
      newSelected = [...selectedCards, card];
    }

    setSelectedCards(newSelected);
    onCardSelect?.(newSelected);
  };

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Sem cartas na mão</p>
      </div>
    );
  }

  return (
    <div className="bg-green-700 rounded-lg p-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {sortedCards.map((card, index) => (
          <CardComponent
            key={`${card}-${index}`}
            card={card}
            selected={selectedCards.includes(card)}
            onClick={() => handleCardClick(card)}
            disabled={!selectable}
          />
        ))}
      </div>
    </div>
  );
}
