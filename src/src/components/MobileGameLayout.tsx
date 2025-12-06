import { Card } from '../lib/deck';
import { DeckArea } from './DeckArea';
import { HandScroller } from './HandScroller';
import { MeldDoc } from '../lib/firestoreGame';
import { GameRules } from '../lib/rules';
import { LogOut, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Chat } from './Chat';

type Player = { 
  id: string;
  name: string; 
  score: number; 
  photoURL?: string;
  handCount?: number;
  isYou?: boolean; 
  isTurn?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

interface MobileGameLayoutProps {
  round: number;
  lastAction?: string;
  players: Player[];
  discardTop?: Card | null;
  stockCount: number;
  hand: Card[];
  selectedCards: Card[];
  melds: MeldDoc[];
  playerNames: Record<string, string>;
  canPlay: boolean;
  hasDrawn: boolean;
  rules?: GameRules;
  roomId: string;
  onBuyStock: () => void;
  onBuyDiscard: () => void;
  onCardSelect: (card: Card) => void;
  onDiscard: () => void;
  onMeld: () => void;
  onKnock: () => void;
  onReorderHand?: (newOrder: Card[]) => void;
  onLeaveRoom?: () => void;
}

// Component for opponent hand (fanned cards facing center)
function OpponentHand({ count, position }: { count: number; position: 'top' | 'bottom' | 'left' | 'right' }) {
  const cards = Array.from({ length: Math.min(count, 9) }, (_, i) => i);
  
  if (position === 'top' || position === 'bottom') {
    return (
      <div className={`flex justify-center items-center ${position === 'top' ? '' : ''}`}>
        {cards.map((_, i) => (
          <div
            key={i}
            className="w-8 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border-2 border-blue-400 shadow-lg"
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
            className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border-2 border-blue-400 shadow-lg"
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
  
  if (isVertical) {
    return (
      <div className={`flex flex-col items-center gap-1`}>
        {player.photoURL ? (
          <img
            src={player.photoURL}
            alt={player.name}
            className={`w-10 h-10 rounded-full object-cover border-2 ${isTurn ? 'border-green-400' : 'border-gray-400'}`}
          />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 ${isTurn ? 'border-green-400 bg-purple-500' : 'border-gray-400 bg-purple-600'}`}>
            {player.name[0].toUpperCase()}
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className={`text-xs font-semibold ${isTurn ? 'text-green-400' : 'text-white'}`}>
            {player.name}
          </span>
          <span className="text-[10px] text-gray-300">{player.score} pts</span>
        </div>
      </div>
    );
  } else {
    return (
      <div className={`flex ${position === 'top' ? 'flex-col items-center gap-1' : 'flex-col-reverse items-center gap-1'}`}>
        {player.photoURL ? (
          <img
            src={player.photoURL}
            alt={player.name}
            className={`w-10 h-10 rounded-full object-cover border-2 ${isTurn ? 'border-green-400' : 'border-gray-400'}`}
          />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 ${isTurn ? 'border-green-400 bg-purple-500' : 'border-gray-400 bg-purple-600'}`}>
            {player.name[0].toUpperCase()}
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className={`text-xs font-semibold ${isTurn ? 'text-green-400' : 'text-white'}`}>
            {player.name}
          </span>
          <span className="text-[10px] text-gray-300">{player.score} pts</span>
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
  canPlay,
  hasDrawn,
  roomId,
  onBuyStock,
  onBuyDiscard,
  onCardSelect,
  onDiscard,
  onKnock,
  onReorderHand,
  onLeaveRoom,
}: MobileGameLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  // Separate players by position
  const topPlayer = players.find(p => p.position === 'top' && !p.isYou);
  const bottomPlayer = players.find(p => (p.position === 'bottom' || p.isYou));
  const leftPlayer = players.find(p => p.position === 'left' && !p.isYou);
  const rightPlayer = players.find(p => p.position === 'right' && !p.isYou);

  const actions = [
    {
      id: 'discard',
      label: `Descartar${selectedCards.length > 0 ? ` (${selectedCards.length}/1)` : ' (0/1)'}`,
      type: 'primary' as const,
      disabled: !canPlay || !hasDrawn || selectedCards.length !== 1,
    },
    {
      id: 'knock',
      label: 'Bater!',
      danger: true,
      disabled: !canPlay || hand.length < 4,
    },
  ];

  const handleAction = (id: string) => {
    if (id === 'discard') {
      onDiscard();
    } else if (id === 'knock') {
      onKnock();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="bg-emerald-950/60 backdrop-blur border-b border-emerald-600/30 sticky top-0 z-50">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Rodada {round}</h1>
              {canPlay && (
                <span className="bg-green-500 text-white text-[10px] px-1.5 py-0 rounded">Sua vez!</span>
              )}
              {/* Chat Button */}
              <button
                onClick={() => setChatOpen(true)}
                className="relative p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
                aria-label="Abrir chat"
                title="Abrir chat"
              >
                <MessageSquare size={18} />
                {messageCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {messageCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] text-emerald-300">Última ação</p>
                <p className="text-xs text-white font-medium">{lastAction || 'Jogo iniciado'}</p>
              </div>
              {onLeaveRoom && (
                <button
                  onClick={onLeaveRoom}
                  className="p-1.5 text-emerald-300/70 hover:text-white hover:bg-emerald-800/50 rounded transition-colors"
                  aria-label="Sair da partida"
                  title="Sair da partida"
                >
                  <LogOut size={16} />
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
          <div className="absolute top-0 left-0 right-0 flex flex-col items-center z-10 pt-1">
            <OpponentHand count={topPlayer.handCount || 9} position="top" />
            <div className="mt-1">
              <PlayerAvatar player={topPlayer} position="top" />
            </div>
          </div>
        )}

        {/* Left Player - Movido para espaço vazio acima (retângulo amarelo) - mantendo formato vertical */}
        {leftPlayer && (
          <div className="absolute top-0 left-0 flex flex-col items-start z-10 pl-1 pt-3">
            <OpponentHand count={leftPlayer.handCount || 9} position="left" />
            <div className="ml-1 mt-2">
              <PlayerAvatar player={leftPlayer} position="left" />
            </div>
          </div>
        )}

        {/* Right Player - Movido para espaço vazio acima (canto superior direito) - mantendo formato vertical */}
        {rightPlayer && (
          <div className="absolute right-0 top-0 flex flex-col items-end z-10 pr-1 pt-3">
            <OpponentHand count={rightPlayer.handCount || 9} position="right" />
            <div className="mr-1 mt-2">
              <PlayerAvatar player={rightPlayer} position="right" />
            </div>
          </div>
        )}

        {/* Center Area - Deck and Discard - Posicionado abaixo do jogador do topo, entre os jogadores laterais */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-20 pt-36">
          <div className="grid grid-cols-2 gap-4">
            <DeckArea
              stockCount={stockCount}
              discardTop={discardTop}
              canPlay={canPlay && !hasDrawn}
              onBuyStock={onBuyStock}
              onBuyDiscard={onBuyDiscard}
            />
          </div>
        </div>

        {/* Bottom Player (You) - Botões um de cada lado do avatar, leque colado embaixo */}
        {bottomPlayer && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center z-10 pb-1">
            {/* Action Buttons e Avatar - Botões nas laterais, avatar no centro */}
            <div className="flex items-center gap-3 mb-1">
              {/* Botão Descartar - Esquerda */}
              <button
                onClick={() => handleAction('discard')}
                disabled={actions[0].disabled}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  actions[0].disabled
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
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
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
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
                onCardSelect={onCardSelect}
                selectable={canPlay}
                onReorder={onReorderHand}
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
