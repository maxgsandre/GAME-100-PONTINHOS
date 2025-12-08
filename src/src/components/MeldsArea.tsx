import { MeldDoc } from '../lib/firestoreGame';
import { Card, parseCard, SUIT_SYMBOLS, SUIT_COLORS } from '../lib/deck';
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
      className="absolute top-[340px] md:top-[420px] lg:top-[500px] left-0 right-0 bottom-[180px] md:bottom-[220px] lg:bottom-[260px] flex flex-col z-[30] pointer-events-none"
    >
      {/* Zona de drop vazia para criar novas combinações - FIXA NO TOPO, fora do scroll */}
      {isMyTurn && (
        <div className="flex-shrink-0 mx-2 md:mx-4 lg:mx-6 mb-2 md:mb-3 lg:mb-4 pointer-events-auto">
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
              <p className="text-emerald-300 text-xs md:text-sm font-semibold text-center px-2">Solte aqui para criar combinacao</p>
            ) : (
              <p className="text-emerald-400/80 text-xs md:text-sm font-medium text-center px-2">Arraste cartas selecionadas aqui para criar combinacao</p>
            )}
          </div>
        </div>
      )}

      {/* Container com scroll horizontal APENAS para combinações - abaixo da zona de drop */}
      {/* Se combinações forem muito grandes, permite scroll vertical também para não sobrepor os botões */}
      <div className="flex-1 mx-2 md:mx-4 lg:mx-6 overflow-x-auto overflow-y-auto pointer-events-auto">
        <div className="flex flex-row gap-4 md:gap-5 lg:gap-6 items-start justify-start min-w-max pl-2 md:pl-4 lg:pl-6">

          {/* Combinações existentes - Layout em linha, cada meld em um card container */}
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
                  flex-shrink-0 flex flex-col items-center gap-2 md:gap-3 px-2 md:px-3 lg:px-4 py-3 md:py-4
                  ${isDragOver ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-transparent border border-transparent'}
                  transition-colors
                `}
              >
                {/* Player Avatar - Miniatura no topo */}
                {player && (
                  <div className="flex-shrink-0 mb-1">
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

                {/* Cards - Layout vertical (coluna) estilo paciência com sobreposição */}
                <div className="flex flex-col items-center relative" style={{ minHeight: `${meld.cards.length * 20 + 100}px`, width: '100%' }}>
                  {meld.cards.map((card, index) => {
                    const { rank, suit } = parseCard(card);
                    const rankDisplay = rank === 'T' ? '10' : rank;
                    const suitSymbol = SUIT_SYMBOLS[suit];
                    const color = SUIT_COLORS[suit] === 'red' ? 'text-red-600' : 'text-gray-900';
                    
                    return (
                      <div
                        key={`${card}-${index}`}
                        className="absolute flex-shrink-0"
                        style={{
                          top: `${index * 20}px`,
                          zIndex: index,
                        }}
                      >
                        <div className="relative w-16 h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-md md:rounded-lg shadow-xl bg-white border border-gray-300">
                          {/* Top left corner */}
                          <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 flex flex-col items-center">
                            <span className={`text-xs md:text-sm lg:text-base font-bold leading-none ${color}`}>{rankDisplay}</span>
                            <span className={`text-sm md:text-base lg:text-lg leading-none ${color}`}>{suitSymbol}</span>
                          </div>
                          {/* Center */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-2xl md:text-3xl lg:text-4xl ${color}`}>{suitSymbol}</span>
                              <span className={`text-lg md:text-xl lg:text-2xl font-bold ${color}`}>{rankDisplay}</span>
                            </div>
                          </div>
                          {/* Bottom right corner (rotated) */}
                          <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 flex flex-col items-center rotate-180">
                            <span className={`text-xs md:text-sm lg:text-base font-bold leading-none ${color}`}>{rankDisplay}</span>
                            <span className={`text-sm md:text-base lg:text-lg leading-none ${color}`}>{suitSymbol}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


