import { Card } from '../lib/deck';
import { ActionFab } from './ActionFab';
import { ScoreboardCard } from './ScoreboardCard';
import { DeckArea } from './DeckArea';
import { HandScroller } from './HandScroller';
import { MeldDoc } from '../lib/firestoreGame';
import { getCardDisplay } from '../lib/deck';
import { calculateHandPoints } from '../lib/rules';
import { GameRules } from '../lib/rules';
import { LogOut } from 'lucide-react';

type Player = { name: string; score: number; isYou?: boolean; isTurn?: boolean };

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
  onBuyStock: () => void;
  onBuyDiscard: () => void;
  onCardSelect: (card: Card) => void;
  onDiscard: () => void;
  onMeld: () => void;
  onKnock: () => void;
  onReorderHand?: (newOrder: Card[]) => void;
  onLeaveRoom?: () => void;
}

export function MobileGameLayout({
  round,
  lastAction,
  players,
  discardTop,
  stockCount,
  hand,
  selectedCards,
  melds,
  playerNames,
  canPlay,
  hasDrawn,
  rules,
  onBuyStock,
  onBuyDiscard,
  onCardSelect,
  onDiscard,
  onMeld,
  onKnock,
  onReorderHand,
  onLeaveRoom,
}: MobileGameLayoutProps) {
  const actions = [
    {
      id: 'discard',
      label: `Descartar${selectedCards.length > 0 ? ` (${selectedCards.length}/1)` : ' (0/1)'}`,
      type: 'primary' as const,
      disabled: !canPlay || !hasDrawn || selectedCards.length !== 1,
    },
    {
      id: 'meld',
      label: `Baixar Combinação${selectedCards.length >= 3 ? ` (${selectedCards.length})` : ' (0)'}`,
      disabled: !canPlay || selectedCards.length < 3,
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
    } else if (id === 'meld') {
      onMeld();
    } else if (id === 'knock') {
      onKnock();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 flex flex-col overflow-x-hidden">
      <header className="bg-emerald-950/60 backdrop-blur border-b border-emerald-600/30 sticky top-0 z-50">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Rodada {round}</h1>
              {canPlay && (
                <span className="bg-green-500 text-white text-[10px] px-1.5 py-0 rounded">Sua vez!</span>
              )}
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

      <main className="flex-1 px-3 py-3 space-y-3">
        <ScoreboardCard players={players} />

        <div className="grid grid-cols-2 gap-3">
          <DeckArea
            stockCount={stockCount}
            discardTop={discardTop}
            canPlay={canPlay && !hasDrawn}
            onBuyStock={onBuyStock}
            onBuyDiscard={onBuyDiscard}
          />
        </div>

        {melds.length > 0 && (
          <div className="bg-emerald-900/40 backdrop-blur border-emerald-600/30 rounded-lg p-3">
            <h3 className="text-sm font-bold text-white mb-2">Combinações Baixadas</h3>
            <div className="space-y-2">
              {melds.map((meld) => (
                <div key={meld.id} className="border border-emerald-600/30 rounded-lg p-2 bg-emerald-800/20">
                  <p className="text-xs text-emerald-200 mb-1">
                    {playerNames[meld.ownerUid] || 'Jogador'} - {meld.type === 'sequence' ? 'Sequência' : 'Trinca'}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {meld.cards.map((card, index) => (
                      <span
                        key={`${card}-${index}`}
                        className="text-xs px-2 py-1 bg-emerald-700/30 rounded text-white border border-emerald-500/30"
                      >
                        {getCardDisplay(card)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-emerald-900/40 backdrop-blur border-emerald-600/30 rounded-lg p-3 space-y-2">
          <h3 className="text-sm font-bold text-white mb-2">Ações</h3>
          <ActionFab
            disabled={!canPlay}
            actions={actions}
            onAction={handleAction}
          />
          <p className="text-[10px] text-emerald-200 text-center">
            {!hasDrawn && canPlay
              ? '1. Compre uma carta (monte ou descarte)'
              : hasDrawn && canPlay
              ? '2. Baixe combinações ou descarte'
              : 'Aguarde sua vez'}
          </p>
        </div>

        <div className="bg-emerald-900/40 backdrop-blur border-emerald-600/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">
              Sua Mão <span className="text-emerald-300">({hand.length})</span>
            </h3>
            <div>
              <span className="text-xs text-emerald-300">Pontos: </span>
              <span className="text-xl font-bold text-yellow-400">
                {calculateHandPoints(hand, rules)}
              </span>
            </div>
          </div>
          <HandScroller
            cards={hand}
            selectedCards={selectedCards}
            onCardSelect={onCardSelect}
            selectable={canPlay}
            onReorder={onReorderHand}
          />
        </div>
      </main>
    </div>
  );
}
