import { MeldDoc } from '../lib/firestoreGame';
import { Card } from '../lib/deck';
import { CardComponent } from './CardComponent';
import { useState, useRef } from 'react';

interface MeldsAreaProps {
  melds: MeldDoc[];
  players: Array<{ id: string; name: string; photoURL?: string; score?: number }>;
  isMyTurn: boolean;
  onAddCardToMeld?: (meldId: string, card: Card) => void;
}

export function MeldsArea({ melds, players, isMyTurn, onAddCardToMeld }: MeldsAreaProps) {
  const [dragOverMeldId, setDragOverMeldId] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const getPlayer = (uid: string) => {
    return players.find(p => p.id === uid);
  };


  const handleDragOver = (e: React.DragEvent, meldId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMeldId(meldId);
  };

  const handleDragLeave = () => {
    setDragOverMeldId(null);
  };

  const handleDrop = (e: React.DragEvent, meldId: string) => {
    e.preventDefault();
    const cardData = e.dataTransfer.getData('application/card');
    if (cardData && onAddCardToMeld && isMyTurn) {
      try {
        const card = JSON.parse(cardData) as Card;
        onAddCardToMeld(meldId, card);
      } catch (error) {
        console.error('Error parsing card data:', error);
      }
    }
    setDragOverMeldId(null);
  };

  if (melds.length === 0) {
    return null;
  }

  return (
    <div
      ref={areaRef}
      className="absolute top-44 left-0 right-0 bottom-32 flex items-center justify-center z-15 pointer-events-none"
    >
      <div className="w-full h-full mx-4 my-2 overflow-y-auto overflow-x-hidden">
        <div className="space-y-2 pointer-events-auto">
          {melds.map((meld) => {
            const player = getPlayer(meld.ownerUid);
            const isDragOver = dragOverMeldId === meld.id;

            return (
              <div
                key={meld.id}
                onDragOver={(e) => handleDragOver(e, meld.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, meld.id)}
                className={`
                  flex items-center gap-2 px-2 py-1 rounded-lg
                  ${isDragOver ? 'bg-emerald-500/30 border-2 border-emerald-400' : 'bg-emerald-900/40 border border-emerald-700/50'}
                  transition-colors
                `}
              >
                {/* Player Avatar - Miniatura */}
                {player && (
                  <div className="flex-shrink-0">
                    {player.photoURL ? (
                      <img
                        src={player.photoURL}
                        alt={player.name}
                        className="w-8 h-8 rounded-full object-cover border border-emerald-400"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs border border-emerald-400 bg-purple-600">
                        {player.name[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Cards - Scroll horizontal se necessário */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                  <div className="flex gap-1 items-center min-w-max">
                    {meld.cards.map((card, index) => (
                      <div key={`${card}-${index}`} className="flex-shrink-0">
                        <CardComponent
                          card={card}
                          size="tiny"
                          disabled
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

