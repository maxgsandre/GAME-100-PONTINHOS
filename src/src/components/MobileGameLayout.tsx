import { Card } from '../lib/deck';
import { DeckArea } from './DeckArea';
import { HandScroller } from './HandScroller';
import { MeldDoc } from '../lib/firestoreGame';
import { GameRules } from '../lib/rules';
import { LogOut, MessageSquare, Ban } from 'lucide-react';
import { useState } from 'react';
import { Chat } from './Chat';
import { MeldsArea } from './MeldsArea';

type Player = { 
  id: string;
  name: string; 
  score: number; 
  photoURL?: string;
  handCount?: number;
  isYou?: boolean; 
  isTurn?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isBlocked?: boolean;
};

interface MobileGameLayoutProps {
  round: number;
  lastAction?: string;
  players: Player[];
  discardTop?: Card | null;
  stockCount: number;
  hand: Card[];
  selectedCards: Card[];
  selectedIndices?: number[];
  melds: MeldDoc[];
  playerNames: Record<string, string>;
  canPlay: boolean;
  hasDrawn: boolean;
  rules?: GameRules;
  roomId: string;
  canGoOutByLayoff?: boolean;
  onBuyStock: () => void;
  onBuyDiscard: () => void;
  onCardSelect: (card: Card, index?: number) => void;
  onDiscard: () => void;
  onMeld: () => void;
  onKnock: () => void;
  onReorderHand?: (newOrder: Card[]) => void;
  onLeaveRoom?: () => void;
  onAddCardToMeld?: (meldId: string, card: Card) => void;
  onCreateMeld?: (cards: Card[]) => void;
}

// Component for opponent hand (fanned cards facing center)
function OpponentHand({ count, position }: { count: number; position: 'top' | 'bottom' | 'left' | 'right' }) {
  // Show actual card count (no limit)
  const cards = Array.from({ length: count }, (_, i) => i);
  
  if (position === 'top' || position === 'bottom') {
    return (
      <div className={`flex justify-center items-center ${position === 'top' ? '' : ''}`}>
        {cards.map((_, i) => (
          <div
            key={i}
            className="w-8 h-12 md:w-12 md:h-18 lg:w-14 lg:h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border-2 border-blue-400 shadow-lg"
            style={{
              transform: `rotate(${(i - cards.length / 2) * 4}deg) translateY(${position === 'top' ? '0' : '0'})`,
              marginLeft: i === 0 ? 0 : '-10px',
              zIndex: cards.length - i,
            }}
          />
        ))}
      </div>
    );
  } else {
    return (
      <div className={`flex flex-col justify-center items-center ${position === 'left' ? '' : ''}`}>
        {cards.map((_, i) => (
          <div
            key={i}
            className="w-12 h-8 md:w-18 md:h-12 lg:w-20 lg:h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border-2 border-blue-400 shadow-lg"
            style={{
              transform: `rotate(${(i - cards.length / 2) * -4}deg)`,
              marginTop: i === 0 ? 0 : '-10px',
              zIndex: cards.length - i,
            }}
          />
        ))}
      </div>
    );
  }
}

// Component for player avatar with score
function PlayerAvatar({ player, position }: { player: Player; position: 'top' | 'bottom' | 'left' | 'right' }) {
  const isVertical = position === 'left' || position === 'right';
  const isTurn = player.isTurn;
  const isBlocked = player.isBlocked || false;
  
  if (isVertical) {
    return (
      <div className={`flex flex-col items-center gap-1 relative`}>
        <div className="relative">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.name}
              className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full object-cover border-2 ${isTurn ? 'border-green-400' : isBlocked ? 'border-red-400' : 'border-gray-400'}`}
            />
          ) : (
            <div className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm md:text-base lg:text-lg border-2 ${isTurn ? 'border-green-400 bg-purple-500' : isBlocked ? 'border-red-400 bg-purple-600' : 'border-gray-400 bg-purple-600'}`}>
              {player.name[0].toUpperCase()}
            </div>
          )}
          {isBlocked && (
            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
              <Ban size={12} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-xs md:text-sm lg:text-base font-semibold ${isTurn ? 'text-green-400' : isBlocked ? 'text-red-400' : 'text-white'}`}>
            {player.name}
          </span>
          <span className="text-[10px] md:text-xs lg:text-sm text-gray-300">{player.score} pts</span>
        </div>
      </div>
    );
  } else {
    return (
      <div className={`flex ${position === 'top' ? 'flex-col items-center gap-1' : 'flex-col-reverse items-center gap-1'} relative`}>
        <div className="relative">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.name}
              className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full object-cover border-2 ${isTurn ? 'border-green-400' : isBlocked ? 'border-red-400' : 'border-gray-400'}`}
            />
          ) : (
            <div className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm md:text-base lg:text-lg border-2 ${isTurn ? 'border-green-400 bg-purple-500' : isBlocked ? 'border-red-400 bg-purple-600' : 'border-gray-400 bg-purple-600'}`}>
              {player.name[0].toUpperCase()}
            </div>
          )}
          {isBlocked && (
            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
              <Ban size={12} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-xs md:text-sm lg:text-base font-semibold ${isTurn ? 'text-green-400' : isBlocked ? 'text-red-400' : 'text-white'}`}>
            {player.name}
          </span>
          <span className="text-[10px] md:text-xs lg:text-sm text-gray-300">{player.score} pts</span>
        </div>
      </div>
    );
  }
}

export function MobileGameLayout({
  round,
  lastAction,
  players,
  discardTop,
  stockCount,
  hand,
  selectedCards,
  selectedIndices,
  melds,
  canPlay,
  hasDrawn,
  roomId,
  canGoOutByLayoff = false,
  onBuyStock,
  onBuyDiscard,
  onCardSelect,
  onDiscard,
  onKnock,
  onReorderHand,
  onLeaveRoom,
  onAddCardToMeld,
  onCreateMeld,
}: MobileGameLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  // Separate players by position
  const topPlayer = players.find(p => p.position === 'top' && !p.isYou);
  const bottomPlayer = players.find(p => (p.position === 'bottom' || p.isYou));
  const leftPlayer = players.find(p => p.position === 'left' && !p.isYou);
  const rightPlayer = players.find(p => p.position === 'right' && !p.isYou);

  // Check if current player is blocked
  const currentPlayer = bottomPlayer;
  const isBlocked = currentPlayer?.isBlocked || false;
  const isMyTurn = canPlay;

  // Determine why discard button is disabled
  // Special case: If player has only 1 card, they can discard it even without drawing (e.g., after adding card to meld)
  // Normal case: if it's my turn AND I've drawn a card AND I have exactly 1 card selected
  const hasOnlyOneCard = hand.length === 1;
  const discardDisabled = !canPlay || (!hasDrawn && !hasOnlyOneCard) || selectedCards.length !== 1;
  const discardDisabledReason = !canPlay 
    ? 'Não é sua vez' 
    : (!hasDrawn && !hasOnlyOneCard)
      ? 'Você precisa comprar uma carta primeiro (do monte ou do descarte)' 
      : selectedCards.length === 0
        ? 'Selecione uma carta para descartar'
        : selectedCards.length > 1
          ? 'Selecione apenas uma carta'
          : '';
  
  // Debug log
  if (canPlay && hasDrawn) {
    console.log('Discard button state:', {
      canPlay,
      hasDrawn,
      selectedCardsLength: selectedCards.length,
      discardDisabled,
      selectedCards
    });
  }

  const actions = [
    {
      id: 'discard',
      label: `Descartar${selectedCards.length > 0 ? ` (${selectedCards.length}/1)` : ' (0/1)'}`,
      type: 'primary' as const,
      disabled: discardDisabled,
      title: discardDisabled ? discardDisabledReason : 'Descartar carta selecionada',
    },
    {
      id: 'knock',
      label: 'Bater!',
      danger: true,
      // Disable if: (not my turn AND blocked) OR (my turn AND hand too small AND cannot go out with layoff)
      // Special case: If player has only 1 card, they should discard it (which auto-goes out), not use "Bater!"
      // Allow if: not my turn AND not blocked (can try special scenarios)
      // Allow if: my turn AND (hand >= 2 OR can go out with layoff)
      // If hand.length === 1, disable "Bater!" because player should discard instead (which auto-goes out)
      disabled: (isBlocked && !isMyTurn) || (isMyTurn && (hand.length < 2 || (hand.length === 1 && !canGoOutByLayoff))),
    },
  ];

  const handleAction = (id: string) => {
    console.log('handleAction called:', id, 'discardDisabled:', discardDisabled, 'canPlay:', canPlay, 'hasDrawn:', hasDrawn, 'selectedCards:', selectedCards.length);
    if (id === 'discard') {
      console.log('Calling onDiscard');
      onDiscard();
    } else if (id === 'knock') {
      onKnock();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="bg-emerald-950/60 backdrop-blur border-b border-emerald-600/30 sticky top-0 z-50">
        <div className="px-3 py-2 md:px-6 md:py-3 lg:px-8 lg:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-white">Rodada {round}</h1>
              {canPlay && (
                <span className="bg-green-500 text-white text-[10px] md:text-xs lg:text-sm px-1.5 md:px-2 lg:px-3 py-0 md:py-0.5 rounded">Sua vez!</span>
              )}
              {/* Chat Button */}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="relative p-1.5 md:p-2 lg:p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors z-50"
                aria-label="Abrir chat"
                title="Abrir chat"
              >
                <MessageSquare size={18} className="md:w-5 md:h-5 lg:w-6 lg:h-6" />
                {messageCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] md:text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                    {messageCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-right">
                <p className="text-[10px] md:text-xs lg:text-sm text-emerald-300">Última ação</p>
                <p className="text-xs md:text-sm lg:text-base text-white font-medium">{lastAction || 'Jogo iniciado'}</p>
              </div>
              {onLeaveRoom && (
                <button
                  onClick={onLeaveRoom}
                  className="p-1.5 md:p-2 lg:p-2.5 text-emerald-300/70 hover:text-white hover:bg-emerald-800/50 rounded transition-colors"
                  aria-label="Sair da partida"
                  title="Sair da partida"
                >
                  <LogOut size={16} className="md:w-5 md:h-5 lg:w-6 lg:h-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Top Player - Leque colado no topo, avatar na frente */}
        {topPlayer && (
          <div className="absolute top-0 left-0 right-0 flex flex-col items-center z-10 pt-1 md:pt-2 lg:pt-3">
            <OpponentHand count={topPlayer.handCount || 0} position="top" />
            <div className="mt-1 md:mt-2 lg:mt-3">
              <PlayerAvatar player={topPlayer} position="top" />
            </div>
          </div>
        )}

        {/* Left Player - Movido para espaço vazio acima (retângulo amarelo) - mantendo formato vertical */}
        {leftPlayer && (
          <div className="absolute top-0 left-0 flex flex-col items-start z-10 pl-1 md:pl-2 lg:pl-4 pt-3 md:pt-4 lg:pt-6">
            <OpponentHand count={leftPlayer.handCount || 0} position="left" />
            <div className="ml-1 md:ml-2 lg:ml-3 mt-2 md:mt-3 lg:mt-4">
              <PlayerAvatar player={leftPlayer} position="left" />
            </div>
          </div>
        )}

        {/* Right Player - Movido para espaço vazio acima (canto superior direito) - mantendo formato vertical */}
        {rightPlayer && (
          <div className="absolute right-0 top-0 flex flex-col items-end z-10 pr-1 md:pr-2 lg:pr-4 pt-3 md:pt-4 lg:pt-6">
            <OpponentHand count={rightPlayer.handCount || 0} position="right" />
            <div className="mr-1 md:mr-2 lg:mr-3 mt-2 md:mt-3 lg:mt-4">
              <PlayerAvatar player={rightPlayer} position="right" />
            </div>
          </div>
        )}

        {/* Center Area - Deck and Discard - Posicionado abaixo do jogador do topo, entre os jogadores laterais */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 md:gap-6 lg:gap-8 z-20 pt-36 md:pt-44 lg:pt-52">
          <div className="grid grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            <DeckArea
              stockCount={stockCount}
              discardTop={discardTop}
              canPlay={canPlay && !hasDrawn}
              onBuyStock={onBuyStock}
              onBuyDiscard={onBuyDiscard}
            />
          </div>
        </div>

        {/* Melds Area - Área central para combinações baixadas */}
        <MeldsArea
          melds={melds}
          players={players}
          isMyTurn={canPlay}
          onAddCardToMeld={onAddCardToMeld}
          onCreateMeld={onCreateMeld}
          selectedCards={selectedCards}
        />

        {/* Bottom Player (You) - Botões um de cada lado do avatar, leque colado embaixo */}
        {bottomPlayer && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center z-50 pb-1">
            {/* Action Buttons e Avatar - Botões nas laterais, avatar no centro */}
            <div className="flex items-center gap-3 md:gap-4 lg:gap-6 mb-1 md:mb-2 lg:mb-3">
              {/* Botão Descartar - Esquerda */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Discard button clicked', {
                    disabled: actions[0].disabled,
                    canPlay,
                    hasDrawn,
                    selectedCardsLength: selectedCards.length,
                    discardDisabled,
                    discardDisabledReason
                  });
                  if (!actions[0].disabled) {
                    handleAction('discard');
                  } else {
                    alert(discardDisabledReason || 'Botão desabilitado');
                  }
                }}
                disabled={actions[0].disabled}
                title={actions[0].title}
                className={`px-4 md:px-6 lg:px-8 py-2 md:py-3 lg:py-4 rounded-lg font-semibold text-sm md:text-base lg:text-lg transition-colors relative z-50 ${
                  actions[0].disabled
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 cursor-pointer'
                }`}
              >
                Descartar
              </button>
              
              {/* Player Avatar - Centro */}
              <div>
                <PlayerAvatar player={bottomPlayer} position="bottom" />
              </div>
              
              {/* Botão Bater! - Direita */}
              <button
                onClick={() => handleAction('knock')}
                disabled={actions[1].disabled}
                className={`px-4 md:px-6 lg:px-8 py-2 md:py-3 lg:py-4 rounded-lg font-semibold text-sm md:text-base lg:text-lg transition-colors ${
                  actions[1].disabled
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                Bater!
              </button>
            </div>
            
            {/* Player Hand - Leque colado embaixo */}
            <div className="w-full px-2">
              <HandScroller
                cards={hand}
                selectedCards={selectedCards}
                selectedIndices={selectedIndices}
                onCardSelect={onCardSelect}
                selectable={canPlay}
                onReorder={onReorderHand}
                allowDragOut={canPlay}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <Chat 
        roomId={roomId} 
        isOpen={chatOpen}
        onToggle={setChatOpen}
        onMessageCountChange={setMessageCount}
      />
    </div>
  );
}
