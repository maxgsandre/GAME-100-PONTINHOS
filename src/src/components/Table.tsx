import { useState, useEffect } from 'react';
import { Hand as HandComponent } from './Hand';
import { Stock } from './Stock';
import { Discard } from './Discard';
import { Melds } from './Melds';
import { Scoreboard } from './Scoreboard';
import { Chat } from './Chat';
import {
  Room,
  Player,
  Hand,
  DeckState,
  MeldDoc,
  subscribeToPlayers,
  subscribeToHand,
  subscribeToDeckState,
  subscribeToMelds,
  drawFromStock,
  drawFromDiscard,
  discardCard,
  layDownMelds,
  goOut,
} from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { Card } from '../lib/deck';
import { isValidMeld, Meld, canGoOut, calculateHandPoints, validateMultipleMelds, findAllMelds } from '../lib/rules';
import { ArrowDown } from 'lucide-react';

interface TableProps {
  room: Room;
}

export function Table({ room }: TableProps) {
  const userId = useAppStore(state => state.userId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hand, setHand] = useState<Hand | null>(null);
  const [deckState, setDeckState] = useState<DeckState | null>(null);
  const [melds, setMelds] = useState<MeldDoc[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const isMyTurn = room.playerOrder[room.turnIndex] === userId;

  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers(room.id, setPlayers);
    const unsubscribeHand = userId ? subscribeToHand(room.id, userId, setHand) : () => {};
    const unsubscribeDeck = subscribeToDeckState(room.id, setDeckState);
    const unsubscribeMelds = subscribeToMelds(room.id, setMelds);

    return () => {
      unsubscribePlayers();
      unsubscribeHand();
      unsubscribeDeck();
      unsubscribeMelds();
    };
  }, [room.id, userId]);

  // Reset hasDrawn when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setHasDrawn(false);
    }
  }, [room.turnIndex, isMyTurn]);

  const handleDrawStock = async () => {
    if (!isMyTurn || hasDrawn || actionInProgress) return;

    try {
      setActionInProgress(true);
      await drawFromStock(room.id);
      setHasDrawn(true);
    } catch (error: any) {
      alert(error.message || 'Erro ao comprar do monte');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDrawDiscard = async () => {
    if (!isMyTurn || hasDrawn || actionInProgress) return;

    try {
      setActionInProgress(true);
      await drawFromDiscard(room.id);
      setHasDrawn(true);
    } catch (error: any) {
      alert(error.message || 'Erro ao comprar do descarte');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDiscard = async () => {
    if (!isMyTurn || !hasDrawn || selectedCards.length !== 1 || actionInProgress) return;

    try {
      setActionInProgress(true);
      await discardCard(room.id, selectedCards[0]);
      setSelectedCards([]);
      setHasDrawn(false);
    } catch (error: any) {
      alert(error.message || 'Erro ao descartar');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleLayDownMelds = async () => {
    if (!isMyTurn || selectedCards.length < 3 || actionInProgress) return;

    // Group selected cards into melds
    const meld = isValidMeld(selectedCards);
    if (!meld.valid) {
      alert('As cartas selecionadas não formam uma combinação válida');
      return;
    }

    try {
      setActionInProgress(true);
      const meldToLay: Meld = {
        type: meld.type!,
        cards: selectedCards,
      };
      await layDownMelds(room.id, [meldToLay]);
      setSelectedCards([]);
    } catch (error: any) {
      alert(error.message || 'Erro ao baixar combinações');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleGoOut = async () => {
    if (!isMyTurn || !hand || actionInProgress) return;

    // Need at least 4 cards: 3 for a meld + 1 to discard
    if (hand.cards.length < 4) {
      alert('Você precisa ter pelo menos 4 cartas (3 para combinação + 1 para descartar)');
      return;
    }

    // Player selects all cards except one to discard
    if (selectedCards.length === 0) {
      alert('Selecione as cartas que formam suas combinações e deixe UMA carta para descartar');
      return;
    }

    // The cards NOT selected will be the discard card
    const remainingCards = hand.cards.filter(c => !selectedCards.includes(c));
    if (remainingCards.length !== 1) {
      alert('Você deve deixar exatamente UMA carta para descartar');
      return;
    }

    const discardCardValue = remainingCards[0];

    // Try to find valid melds from selected cards
    // First, try if all selected cards form a single meld
    const singleMeld = isValidMeld(selectedCards);
    let meldsToLay: Meld[] = [];

    if (singleMeld.valid) {
      // Single meld works
      meldsToLay = [{
        type: singleMeld.type!,
        cards: selectedCards,
      }];
    } else {
      // Try to find multiple melds
      // Use a simple approach: find all possible melds and try combinations
      const allPossibleMelds = findAllMelds(selectedCards);
      
      // Try to find a combination of melds that uses all selected cards
      // This is a simplified approach - in a full implementation, you'd use a more sophisticated algorithm
      const used = new Set<Card>();
      const foundMelds: Meld[] = [];

      // Sort melds by length (prefer longer ones)
      const sortedMelds = allPossibleMelds.sort((a, b) => b.cards.length - a.cards.length);

      for (const meld of sortedMelds) {
        // Check if this meld uses only unused cards
        const usesUnusedCards = meld.cards.every(card => !used.has(card));
        if (usesUnusedCards) {
          foundMelds.push(meld);
          meld.cards.forEach(card => used.add(card));
        }
      }

      // Check if we used all selected cards
      if (used.size === selectedCards.length) {
        meldsToLay = foundMelds;
      } else {
        // Fallback: try to validate as single meld or show error
        alert('As cartas selecionadas não formam combinações válidas. Tente selecionar cartas que formem sequências ou trincas.');
        return;
      }
    }

    // Validate the melds
    const validation = validateMultipleMelds(selectedCards, meldsToLay);
    if (!validation.valid) {
      alert(validation.error || 'Combinações inválidas');
      return;
    }

    try {
      setActionInProgress(true);
      await goOut(room.id, meldsToLay, discardCardValue);
      setSelectedCards([]);
    } catch (error: any) {
      alert(error.message || 'Erro ao bater');
    } finally {
      setActionInProgress(false);
    }
  };

  if (!hand || !deckState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  const currentPlayer = players.find(p => p.id === room.playerOrder[room.turnIndex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-blue-600 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-gray-700">Rodada {room.round}</h2>
              <p className="text-sm text-gray-600">
                {isMyTurn ? '🟢 Sua vez!' : `Vez de ${currentPlayer?.name || 'outro jogador'}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Última ação:</p>
              <p className="text-sm">{room.lastAction || 'Nenhuma'}</p>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: Scoreboard */}
          <div>
            <Scoreboard
              players={players}
              playerOrder={room.playerOrder}
              currentTurnIndex={room.turnIndex}
              currentUserId={userId}
            />
          </div>

          {/* Center: Deck and Melds */}
          <div className="space-y-4">
            {/* Deck */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-center gap-8 items-center">
                <Stock
                  count={deckState.stock.length}
                  onDraw={handleDrawStock}
                  disabled={!isMyTurn || hasDrawn || actionInProgress}
                />
                <Discard
                  topCard={room.discardTop}
                  onDraw={handleDrawDiscard}
                  disabled={!isMyTurn || hasDrawn || actionInProgress}
                />
              </div>
            </div>

            {/* Melds */}
            {melds.length > 0 && (
              <Melds melds={melds} players={players} />
            )}
          </div>

          {/* Right: Actions */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="mb-3 text-gray-700">Ações</h3>
            <div className="space-y-2">
              <button
                onClick={handleDiscard}
                disabled={!isMyTurn || !hasDrawn || selectedCards.length !== 1 || actionInProgress}
                className={`
                  w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2
                  ${isMyTurn && hasDrawn && selectedCards.length === 1 && !actionInProgress
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <ArrowDown size={16} />
                Descartar ({selectedCards.length}/1)
              </button>

              <button
                onClick={handleLayDownMelds}
                disabled={!isMyTurn || selectedCards.length < 3 || actionInProgress}
                className={`
                  w-full py-2 px-4 rounded-lg
                  ${isMyTurn && selectedCards.length >= 3 && !actionInProgress
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                Baixar Combinação ({selectedCards.length})
              </button>

              <button
                onClick={handleGoOut}
                disabled={!isMyTurn || hand.cards.length < 4 || actionInProgress}
                className={`
                  w-full py-2 px-4 rounded-lg
                  ${isMyTurn && hand.cards.length >= 4 && !actionInProgress
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                Bater!
              </button>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  {!hasDrawn && isMyTurn
                    ? '1. Compre uma carta (monte ou descarte)'
                    : hasDrawn && isMyTurn
                    ? '2. Baixe combinações ou descarte'
                    : 'Aguarde sua vez'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hand */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-gray-700">Sua Mão ({hand.cards.length} cartas)</h3>
            <p className="text-sm text-gray-600">
              Pontos: {calculateHandPoints(hand.cards, room.rules)}
            </p>
          </div>
          <HandComponent
            cards={hand.cards}
            onCardSelect={setSelectedCards}
            selectable={isMyTurn}
          />
        </div>
      </div>

      {/* Chat */}
      <Chat roomId={room.id} />
    </div>
  );
}
