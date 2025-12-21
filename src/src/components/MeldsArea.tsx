import { MeldDoc } from '../lib/firestoreGame';
import { Card, parseCard, SUIT_SYMBOLS, SUIT_COLORS, getRankValue } from '../lib/deck';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../contexts/DialogContext';
import { useDroppable } from '@dnd-kit/core';

interface MeldsAreaProps {
  melds: MeldDoc[];
  players: Array<{ id: string; name: string; photoURL?: string; score?: number }>;
  isMyTurn: boolean;
  onAddCardToMeld?: (meldId: string, card: Card) => void;
  onCreateMeld?: (cards: Card[]) => void;
  selectedCards?: Card[];
}

function MeldDropTarget({
  meldId,
  children,
  className,
}: {
  meldId: string;
  children: React.ReactNode;
  className: (isOver: boolean) => string;
}) {
  const drop = useDroppable({ id: `meld-${meldId}` });
  return (
    <div ref={drop.setNodeRef} className={className(drop.isOver)}>
      {children}
    </div>
  );
}

export function MeldsArea({ melds, players, isMyTurn, onAddCardToMeld, onCreateMeld, selectedCards = [] }: MeldsAreaProps) {
  const { alert } = useDialog();
  const [dragOverMeldId, setDragOverMeldId] = useState<string | null>(null);
  const [dragOverEmpty, setDragOverEmpty] = useState(false);
  const [showAllMelds, setShowAllMelds] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const emptyDrop = useDroppable({ id: 'meld-drop-zone' });
  // Ajuste dinâmico:
  // - Quando a zona de arraste aparece (isMyTurn), desce um pouco para não encostar em "Descartou..."
  // - Quando NÃO aparece, sobe para ocupar o espaço vazio
  const areaTopClass = isMyTurn
    ? 'top-[320px] md:top-[380px] lg:top-[440px]'
    : 'top-[290px] md:top-[350px] lg:top-[410px]';

  const getPlayer = (uid: string) => {
    return players.find(p => p.id === uid);
  };

  // Ordena visualmente as cartas: sequências em ordem crescente; trincas alternando vermelho/preto sempre que possível.
  const getDisplayCards = (meld: MeldDoc): Card[] => {
    if (meld.type === 'sequence') {
      // Ordenar do maior para o menor (mais altas em cima)
      return [...meld.cards].sort((a, b) => {
        const ra = getRankValue(parseCard(a).rank);
        const rb = getRankValue(parseCard(b).rank);
        return rb - ra;
      });
    }

    const reds: Card[] = [];
    const blacks: Card[] = [];
    meld.cards.forEach((card) => {
      const color = SUIT_COLORS[parseCard(card).suit];
      if (color === 'red') reds.push(card);
      else blacks.push(card);
    });

    const ordered: Card[] = [];
    const maxLen = Math.max(reds.length, blacks.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < reds.length) ordered.push(reds[i]);
      if (i < blacks.length) ordered.push(blacks[i]);
    }

    return ordered.length > 0 ? ordered : [...meld.cards];
  };


  const handleDragOver = (e: React.DragEvent, meldId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMeldId(meldId);
  };

  const handleDragLeave = () => {
    setDragOverMeldId(null);
  };

  const handleDrop = async (e: React.DragEvent, meldId: string) => {
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

  const handleEmptyDrop = async (e: React.DragEvent) => {
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
      await alert({ message: 'Selecione pelo menos 3 cartas para criar uma combinação' });
    }
    setDragOverEmpty(false);
  };

  return (
    <>
    <div
      ref={areaRef}
      className={`absolute ${areaTopClass} left-0 right-0 bottom-[80px] md:bottom-[120px] lg:bottom-[150px] flex flex-col z-[30] pointer-events-none`}
    >
      {/* Zona de drop vazia para criar novas combinações - FIXA NO TOPO, fora do scroll */}
      {isMyTurn && (
        <div className="flex-shrink-0 px-2 md:px-4 lg:px-6 mb-1 pointer-events-auto flex justify-center">
          <div
            ref={emptyDrop.setNodeRef}
            onDragOver={handleEmptyDragOver}
            onDragLeave={handleEmptyDragLeave}
            onDrop={handleEmptyDrop}
            data-testid="meld-drop-zone"
            className={`
              w-full max-w-[520px] min-h-[44px] rounded-lg border-2 border-dashed
              flex items-center justify-center cursor-pointer relative z-[31]
              ${(dragOverEmpty || emptyDrop.isOver)
                ? 'bg-emerald-500/40 border-emerald-400' 
                : 'bg-emerald-900/30 border-emerald-700/70 hover:bg-emerald-900/40'
              }
              transition-colors
            `}
            title="Arraste cartas selecionadas aqui para criar combinacao"
            style={{ pointerEvents: 'auto' }}
          >
            {dragOverEmpty ? (
              <p className="text-emerald-300 text-xs font-semibold text-center px-2">Solte aqui para criar combinacao</p>
            ) : (
              <p className="text-emerald-400/80 text-xs font-medium text-center px-2">Arraste cartas selecionadas aqui para criar combinacao</p>
            )}
          </div>
        </div>
      )}

      {/* Botão para abrir modal com todas as combinações (quando muitas) */}
      {melds.length > 5 && (
        <div className="flex justify-center pb-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowAllMelds(true)}
            className="px-3 py-1.5 text-xs md:text-sm rounded-md bg-emerald-800/80 text-emerald-100 border border-emerald-500 hover:bg-emerald-700 transition-colors"
          >
            Ver todas as combinações
          </button>
        </div>
      )}

      {/* Container com scroll horizontal APENAS para combinações - abaixo da zona de drop */}
      {/* Se combinações forem muito grandes, permite scroll vertical também para não sobrepor os botões */}
      <div
        className="flex-1 mx-2 md:mx-4 lg:mx-6 overflow-x-auto overflow-y-auto md:overflow-y-auto max-h-[230px] md:max-h-[300px] lg:max-h-[340px] pointer-events-auto pr-1"
        style={{
          paddingLeft: 'calc(12px + env(safe-area-inset-left))',
          paddingRight: 'calc(12px + env(safe-area-inset-right))',
          scrollPaddingLeft: 'calc(12px + env(safe-area-inset-left))',
          scrollPaddingRight: 'calc(12px + env(safe-area-inset-right))',
        }}
      >
        <div className="flex flex-row gap-2 md:gap-3 lg:gap-3 items-start justify-start min-w-max">

          {/* Combinações existentes - Layout em linha, cada meld em um card container */}
          {melds.map((meld) => {
            const player = getPlayer(meld.ownerUid);
            const isDragOverDesktop = dragOverMeldId === meld.id;

            return (
              <MeldDropTarget
                key={meld.id}
                meldId={meld.id}
                className={(isOver) => `
                  flex-shrink-0 flex flex-col items-center gap-1 px-1 py-2
                  w-14 h-auto md:w-18 lg:w-20 min-h-[132px]
                  ${isOver || isDragOverDesktop ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-transparent'}
                  transition-colors
                `}
              >
                <div
                  onDragOver={(e) => handleDragOver(e, meld.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, meld.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 md:gap-3 w-full py-2 md:py-3"
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
                  <div
                    className="flex flex-col items-center relative w-14 md:w-18 lg:w-20"
                    style={{ minHeight: `${meld.cards.length * 18 + 90}px` }}
                  >
                    {getDisplayCards(meld).map((card, index) => {
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
                          <div className="relative w-14 h-20 md:w-18 md:h-26 lg:w-20 lg:h-30 rounded-md md:rounded-lg shadow-xl bg-white border border-gray-300">
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
              </MeldDropTarget>
            );
          })}
        </div>
      </div>
    </div>

    {/* Modal com todas as combinações */}
    {showAllMelds && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
        <div className="bg-emerald-950/95 border border-emerald-700 rounded-xl w-full max-w-6xl max-h-[80vh] overflow-y-auto p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-emerald-100 font-semibold text-lg">Combinações</h2>
            <button
              type="button"
              onClick={() => setShowAllMelds(false)}
              className="px-3 py-1.5 rounded-md text-sm bg-emerald-800 text-emerald-100 border border-emerald-600 hover:bg-emerald-700"
            >
              Fechar
            </button>
          </div>
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {melds.map((meld) => {
              const player = getPlayer(meld.ownerUid);
              return (
                <div
                  key={`modal-${meld.id}`}
                  className="flex flex-col items-center gap-2 px-2 py-2 bg-emerald-900/40 rounded-lg border border-emerald-700/60"
                >
                  {player && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-400">
                        {player.photoURL ? (
                          <img src={player.photoURL} alt={player.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-purple-600 text-white flex items-center justify-center text-sm font-semibold">
                            {player.name[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-emerald-100 text-sm font-semibold">{player.name}</span>
                    </div>
                  )}
                  <div
                    className="relative w-full flex flex-col items-center"
                    style={{ minHeight: `${meld.cards.length * 18 + 80}px` }}
                  >
                    {getDisplayCards(meld).map((card, index) => {
                      const { rank, suit } = parseCard(card);
                      const rankDisplay = rank === 'T' ? '10' : rank;
                      const suitSymbol = SUIT_SYMBOLS[suit];
                      const color = SUIT_COLORS[suit] === 'red' ? 'text-red-600' : 'text-gray-900';
                      return (
                        <div
                          key={`modal-${card}-${index}`}
                          className="absolute flex-shrink-0"
                          style={{ top: `${index * 18}px`, zIndex: index }}
                        >
                          <div className="relative w-14 h-20 md:w-18 md:h-26 lg:w-20 lg:h-30 rounded-md md:rounded-lg shadow-xl bg-white border border-gray-300">
                            <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 flex flex-col items-center">
                              <span className={`text-xs md:text-sm lg:text-base font-bold leading-none ${color}`}>{rankDisplay}</span>
                              <span className={`text-sm md:text-base lg:text-lg leading-none ${color}`}>{suitSymbol}</span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex flex-col items-center">
                                <span className={`text-2xl md:text-3xl lg:text-4xl ${color}`}>{suitSymbol}</span>
                                <span className={`text-lg md:text-xl lg:text-2xl font-bold ${color}`}>{rankDisplay}</span>
                              </div>
                            </div>
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
      </div>,
      document.body
    )}
    </>
  );
}


