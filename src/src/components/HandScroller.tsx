import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../lib/deck';
import { parseCard, SUIT_SYMBOLS, SUIT_COLORS } from '../lib/deck';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav: any = navigator;
  return ('ontouchstart' in window) || (nav?.maxTouchPoints ?? 0) > 0;
}

function DndDraggableCard({
  id,
  card,
  index,
  disabled,
  children,
}: {
  id: string;
  card: Card;
  index: number;
  disabled: boolean;
  children: (opts: { isDragging: boolean; setNodeRef: (node: HTMLElement | null) => void; attributes: any; listeners: any; style: React.CSSProperties }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
    data: { card, index },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    touchAction: 'none',
  };
  return <>{children({ isDragging, setNodeRef, attributes, listeners, style })}</>;
}

export function HandScroller({
  cards,
  selectedCards,
  selectedIndices,
  onCardSelect,
  selectable,
  onReorder,
  allowDragOut,
}: {
  cards: Card[];
  selectedCards: Card[];
  selectedIndices?: number[];
  onCardSelect: (card: Card, index?: number) => void;
  selectable: boolean;
  onReorder?: (newOrder: Card[]) => void;
  allowDragOut?: boolean;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const touchStartPos = useRef<{ x: number; y: number; index: number } | null>(null);
  const touch = useMemo(() => isTouchDevice(), []);
  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);
  const isSmallViewport = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  }, []);
  const isVerySmallViewport = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 400;
  }, []);
  const selectionCount = selectedCards.length + (selectedIndices?.length ?? 0);
  // In touch devices, enable dnd-kit when at least one card is selected (by value or index) for dropping onto melds
  const touchDragOutEnabled = touch && !!allowDragOut && selectionCount >= 1;
  // Sobreposição: só no touch / coarse / telas pequenas. Ajusta conforme largura.
  const shouldOverlap = (touch || isCoarsePointer || isSmallViewport) && cards.length > 7;
  const overlapPx = useMemo(() => {
    if (!shouldOverlap) return 0;
    const base = isVerySmallViewport ? 40 : 32; // até ~60% em telas muito pequenas
    return base;
  }, [shouldOverlap, isVerySmallViewport]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (touch) {
      // Em touch, usamos dnd-kit em vez do drag nativo
      e.preventDefault();
      return;
    }
    if (!onReorder && !allowDragOut) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setDragPosition({ x: e.clientX, y: e.clientY });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Adicionar dados da carta para permitir drop na área de combinações
    if (allowDragOut && cards[index]) {
      const dragSelection = selectedCards.length > 0 ? selectedCards : [cards[index]];
      e.dataTransfer.setData('application/card', JSON.stringify(cards[index]));
      e.dataTransfer.setData('application/selected-cards', JSON.stringify(dragSelection));
    }
    // Criar imagem customizada para o drag
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(5deg)';
    document.body.appendChild(dragImage);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    e.dataTransfer.setDragImage(dragImage, e.clientX - e.currentTarget.getBoundingClientRect().left, e.clientY - e.currentTarget.getBoundingClientRect().top);
    setTimeout(() => document.body.removeChild(dragImage), 0);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === dropIndex || !onReorder) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...cards];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    onReorder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragPosition(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    if (draggedIndex !== null) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  // Touch handlers para mobile - usando eventos globais
  // Suporta reordenar (onReorder) e evita travar seleção quando allowDragOut está ativo
  useEffect(() => {
    // Se estiver no modo de arrastar para mesa via dnd-kit, não interceptar o touch para reorder
    if (touchDragOutEnabled) return;
    if (!onReorder && !allowDragOut) return;

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!touchStartPos.current || draggedIndex === null) return;
      
      const touch = e.touches[0];
      
      // Sempre atualizar posição do drag para a carta seguir o dedo
      const newPosition = { x: touch.clientX, y: touch.clientY };
      setDragPosition(newPosition);
      
      // Encontrar qual carta está sendo tocada agora
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element) {
        const cardElement = element.closest('[data-card-index]');
        if (cardElement) {
          const targetIndex = parseInt(cardElement.getAttribute('data-card-index') || '-1');
          if (targetIndex >= 0 && targetIndex !== draggedIndex) {
            setDragOverIndex(targetIndex);
          } else {
            setDragOverIndex(null);
          }
        } else {
          setDragOverIndex(null);
        }
      }
    };

    const handleGlobalTouchEnd = () => {
      if (!touchStartPos.current) return;

      // Se estava arrastando para reordenar, aplica a troca
      if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex && onReorder) {
        const newOrder = [...cards];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dragOverIndex, 0, removed);
        onReorder(newOrder);
      }

      // Limpa estado (para allowDragOut também, evitando ficar "travado")
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragPosition(null);
      touchStartPos.current = null;
    };

    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [onReorder, allowDragOut, draggedIndex, dragOverIndex, cards, touchDragOutEnabled]);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    // Se estiver no modo dnd-kit (há cartas selecionadas), deixa o dnd-kit assumir
    if (touchDragOutEnabled) return;
    if (!onReorder) return;
    // Não chamar preventDefault aqui para evitar warning de passive listener
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, index };
    // Iniciar drag imediatamente para mostrar a carta
    setDraggedIndex(index);
    setDragPosition({ x: touch.clientX, y: touch.clientY });
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const draggedCard = draggedIndex !== null ? cards[draggedIndex] : null;
  const draggedCardData = draggedCard ? parseCard(draggedCard) : null;

  const containerClass = touch
    ? 'flex flex-nowrap gap-2 justify-center relative overflow-x-auto py-1 px-3'
    : 'flex flex-wrap gap-2 justify-center relative';

  return (
    <div 
      className={containerClass}
      onDragOver={handleContainerDragOver}
      onDrag={handleDrag}
      style={{
        touchAction: onReorder ? 'none' : 'auto', // Prevenir scroll durante drag no mobile
      }}
    >
      {/* Carta sendo arrastada (mobile e desktop durante touch) - renderizada via Portal */}
      {draggedIndex !== null && dragPosition && draggedCardData && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none"
          style={{
            left: `${dragPosition.x - 32}px`,
            top: `${dragPosition.y - 48}px`,
            transform: 'rotate(5deg)',
            zIndex: 99999,
            willChange: 'transform',
          }}
        >
          <div className="relative w-16 h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-md md:rounded-lg shadow-2xl">
            <div className="absolute inset-0 bg-white rounded-md md:rounded-lg border-2 border-yellow-400">
              <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 flex flex-col items-center">
                <span className={`text-xs md:text-sm lg:text-base font-bold leading-none ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                  {draggedCardData.rank === 'T' ? '10' : draggedCardData.rank}
                </span>
                <span className={`text-sm md:text-base lg:text-lg leading-none ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                  {SUIT_SYMBOLS[draggedCardData.suit]}
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={`text-2xl md:text-3xl lg:text-4xl ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                    {SUIT_SYMBOLS[draggedCardData.suit]}
                  </span>
                  <span className={`text-lg md:text-xl lg:text-2xl font-bold ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                    {draggedCardData.rank === 'T' ? '10' : draggedCardData.rank}
                  </span>
                </div>
              </div>
              <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 flex flex-col items-center rotate-180">
                <span className={`text-xs md:text-sm lg:text-base font-bold leading-none ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                  {draggedCardData.rank === 'T' ? '10' : draggedCardData.rank}
                </span>
                <span className={`text-sm md:text-base lg:text-lg leading-none ${SUIT_COLORS[draggedCardData.suit] === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                  {SUIT_SYMBOLS[draggedCardData.suit]}
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {cards.map((card, index) => {
        const { rank, suit } = parseCard(card);
        const rankDisplay = rank === 'T' ? '10' : rank;
        const suitSymbol = SUIT_SYMBOLS[suit];
        const color = SUIT_COLORS[suit] === 'red' ? 'text-red-600' : 'text-gray-900';
        // Use selectedIndices if available (for duplicate cards), otherwise fall back to selectedCards
        const isSelected = selectedIndices 
          ? selectedIndices.includes(index)
          : selectedCards.includes(card);

        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        const cardFace = (
          <div className="absolute inset-0 bg-white rounded-md md:rounded-lg border border-gray-300">
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
        );

        const baseClass = `relative flex-none w-16 h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-md md:rounded-lg shadow-xl transform transition-all active:scale-95 cursor-pointer hover:-translate-y-1 ${
          isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-900' : ''
        } ${!selectable ? 'cursor-not-allowed' : ''} ${
          isDragging ? 'opacity-50 scale-95' : ''
        } ${isDragOver ? 'translate-y-2 scale-105' : ''} ${
          selectable && onReorder ? 'cursor-move' : ''
        }`;

        // Touch: usa dnd-kit (drag para a mesa) somente quando há seleção
        if (touchDragOutEnabled) {
          return (
            <DndDraggableCard
              key={`${card}-${index}`}
              id={`hand-${index}`}
              card={card}
              index={index}
              disabled={!selectable}
            >
              {({ setNodeRef, attributes, listeners, style }) => (
                <div
                  ref={setNodeRef}
                  data-card-index={index}
                  {...attributes}
                  {...listeners}
                  style={{ ...style, marginLeft: shouldOverlap && index > 0 ? -overlapPx : 0 }}
                  onClick={() => {
                    if (selectable) onCardSelect(card, index);
                  }}
                  className={baseClass}
                >
                  {cardFace}
                </div>
              )}
            </DndDraggableCard>
          );
        }

        // Desktop: mantém drag nativo / reorder atual
        return (
          <div
            key={`${card}-${index}`}
            data-card-index={index}
            draggable={allowDragOut || !!onReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(e, index)}
            onClick={() => {
              // Só permitir click se não estiver arrastando
              if (draggedIndex === null && touchStartPos.current === null && selectable) {
                onCardSelect(card, index);
              }
            }}
            style={{
              touchAction: onReorder ? 'none' : 'auto', // Prevenir gestos padrão do touch quando pode reordenar
              marginLeft: shouldOverlap && index > 0 ? -overlapPx : 0,
            }}
            className={baseClass}
          >
            {cardFace}
          </div>
        );
      })}
    </div>
  );
}
