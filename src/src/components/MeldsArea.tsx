import { MeldDoc } from '../lib/firestoreGame';
import { Card } from '../lib/deck';
import { CardComponent } from './CardComponent';
import { useState, useRef } from 'react';

interface MeldsAreaProps {
  melds: MeldDoc[];
  players: Array<{ id: string; name: string; photoURL?: string; score?: number }>;
  isMyTurn: boolean;
  onAddCardToMeld?: (meldId: string, card: Card) => void;
  onCreateMeld?: (cards: Card[]) => void;
  selectedCards?: Card[];
}

export function MeldsArea({ melds, players, isMyTurn, onAddCardToMeld, onCreateMeld, selectedCards = [] }: MeldsAreaProps) {
  const [dragOverMeldId, setDragOverMeldId] = useState<string | null>(null);
  const [dragOverEmpty, setDragOverEmpty] = useState(false);
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

  const handleEmptyDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Verificar se há cartas selecionadas e se pode criar combinação
    if (selectedCards.length >= 3 && onCreateMeld && isMyTurn) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverEmpty(true);
    } else {
      e.dataTransfer.dropEffect = 'none';
      setDragOverEmpty(false);
    }
  };

  const handleEmptyDragLeave = () => {
    setDragOverEmpty(false);
  };

  const handleEmptyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Tentar ler do dataTransfer primeiro (para drag and drop)
    let cardsToUse = selectedCards;
    try {
      const selectedCardsData = e.dataTransfer.getData('application/selected-cards');
      if (selectedCardsData) {
        cardsToUse = JSON.parse(selectedCardsData) as Card[];
      }
    } catch (error) {
      // Se não conseguir ler, usar selectedCards do prop
      console.error('Error parsing selected cards data:', error);
    }
    
    if (cardsToUse.length >= 3 && onCreateMeld && isMyTurn) {
      onCreateMeld(cardsToUse);
    } else if (cardsToUse.length < 3) {
      alert('Selecione pelo menos 3 cartas para criar uma combinacao');
    }
    setDragOverEmpty(false);
  };

  return (
    <div
      ref={areaRef}
      className="absolute top-[340px] md:top-[420px] lg:top-[500px] left-0 right-0 bottom-[90px] md:bottom-[118px] lg:bottom-[146px] flex items-center justify-center z-[30] pointer-events-none"
    >
      <div className="w-full h-full mx-2 md:mx-4 lg:mx-6 my-2 md:my-4 lg:my-6 overflow-y-auto overflow-x-hidden pointer-events-auto">
        <div className="flex flex-col gap-2 md:gap-3 lg:gap-4 items-center">
          {/* Zona de drop vazia para criar novas combinações - sempre visível quando é minha vez */}
          {isMyTurn && (
            <div
              onDragOver={handleEmptyDragOver}
              onDragLeave={handleEmptyDragLeave}
              onDrop={handleEmptyDrop}
              data-testid="meld-drop-zone"
              className={`
                w-full min-h-[80px] md:min-h-[100px] lg:min-h-[120px] rounded-lg md:rounded-xl border-2 border-dashed
                flex items-center justify-center cursor-pointer relative z-[31]
                ${dragOverEmpty 
                  ? 'bg-emerald-500/40 border-emerald-400' 
                  : 'bg-emerald-900/30 border-emerald-700/70 hover:bg-emerald-900/40'
                }
                transition-colors
              `}
              title="Arraste cartas selecionadas aqui para criar combinacao"
              style={{ pointerEvents: 'auto' }}
            >
              {dragOverEmpty ? (
                <p className="text-emerald-300 text-sm md:text-base font-semibold">Solte aqui para criar combinacao</p>
              ) : (
                <p className="text-emerald-400/80 text-xs md:text-sm font-medium">Arraste cartas selecionadas aqui para criar combinacao</p>
              )}
            </div>
          )}

          {/* Combinações existentes - Layout vertical (coluna) */}
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
                  w-full flex flex-col items-center gap-2 md:gap-3 px-2 md:px-3 lg:px-4 py-2 md:py-3 rounded-lg md:rounded-xl
                  ${isDragOver ? 'bg-emerald-500/30 border-2 border-emerald-400' : 'bg-emerald-900/40 border border-emerald-700/50'}
                  transition-colors
                `}
              >
                {/* Player Avatar - Miniatura no topo */}
                {player && (
                  <div className="flex-shrink-0">
                    {player.photoURL ? (
                      <img
                        src={player.photoURL}
                        alt={player.name}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-full object-cover border border-emerald-400"
                      />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-semibold text-xs md:text-sm lg:text-base border border-emerald-400 bg-purple-600">
                        {player.name[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Cards - Layout vertical (coluna) como paciência */}
                <div className="flex flex-col gap-1 md:gap-2 items-center">
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
            );
          })}
        </div>
      </div>
    </div>
  );
}


