import { useState, useEffect, useRef } from 'react';
import { Hand as HandComponent } from './Hand';
import { Stock } from './Stock';
import { Discard } from './Discard';
import { Melds } from './Melds';
import { Scoreboard } from './Scoreboard';
import { Chat } from './Chat';
import { MobileGameLayout } from './MobileGameLayout';
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
  reorderHand,
  leaveRoom,
  addCardToMeld,
} from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { Card } from '../lib/deck';
import { isValidMeld, Meld, calculateHandPoints, validateMultipleMelds, findAllMelds } from '../lib/rules';
import { ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TableProps {
  room: Room;
}

export function Table({ room }: TableProps) {
  const navigate = useNavigate();
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
      setSelectedCards([]); // Clear selection when turn changes
    }
  }, [room.turnIndex, isMyTurn]);

  // Auto-select newly drawn card
  const prevHand = useRef<Card[]>([]);
  useEffect(() => {
    if (!hand || !isMyTurn) {
      prevHand.current = hand?.cards || [];
      return;
    }

    const currentHand = hand.cards;
    const prevHandCards = prevHand.current;

    // If hand increased by 1 card and we just drew, find the new card
    if (currentHand.length === prevHandCards.length + 1 && hasDrawn) {
      // Find the card that's in current hand but not in previous hand
      const newCard = currentHand.find(card => !prevHandCards.includes(card));
      if (newCard && !selectedCards.includes(newCard)) {
        setSelectedCards([newCard]);
      }
    }

    prevHand.current = currentHand;
  }, [hand?.cards, hasDrawn, isMyTurn, hand, selectedCards]);

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

    // Block laying down melds until all players have played at least once
    if (!room.firstPassComplete) {
      alert('Não é permitido baixar combinações na primeira vez de cada jogador na rodada');
      return;
    }

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

  // Prepare players data for mobile layout
  const playersForMobile = room.playerOrder.map((playerId, index) => {
    const player = players.find(p => p.id === playerId);
    return {
      name: player?.name || 'Jogador',
      score: player?.score || 0,
      isYou: playerId === userId,
      isTurn: index === room.turnIndex,
    };
  });

  const playerNamesMap = players.reduce((acc, player) => {
    acc[player.id] = player.name;
    return acc;
  }, {} as Record<string, string>);

  const handleCardSelect = (card: Card) => {
    if (!isMyTurn) return;
    
    let newSelected: Card[];
    if (selectedCards.includes(card)) {
      newSelected = selectedCards.filter(c => c !== card);
    } else {
      newSelected = [...selectedCards, card];
    }
    setSelectedCards(newSelected);
  };

  const handleReorderHand = async (newOrder: Card[]) => {
    if (!hand) return;
    
    try {
      await reorderHand(room.id, newOrder);
    } catch (error: any) {
      console.error('Erro ao reordenar cartas:', error);
      // Não mostrar alerta para não interromper a experiência
    }
  };

  const handleLeaveRoom = async () => {
    if (!confirm('Tem certeza que deseja sair da partida?')) {
      return;
    }

    try {
      await leaveRoom(room.id);
      navigate('/');
    } catch (error: any) {
      console.error('Erro ao sair da sala:', error);
      alert(error.message || 'Erro ao sair da partida');
    }
  };

  const handleAddCardToMeld = async (meldId: string, card: Card) => {
    if (!isMyTurn || actionInProgress) return;

    try {
      setActionInProgress(true);
      await addCardToMeld(room.id, meldId, card);
    } catch (error: any) {
      alert(error.message || 'Erro ao adicionar carta à combinação');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden">
        <MobileGameLayout
          round={room.round}
          lastAction={room.lastAction}
          players={playersForMobile}
          discardTop={room.discardTop}
          stockCount={deckState.stock.length}
          hand={hand.cards}
          selectedCards={selectedCards}
          melds={melds}
          playerNames={playerNamesMap}
          canPlay={isMyTurn && !actionInProgress}
          hasDrawn={hasDrawn}
          rules={room.rules}
          onBuyStock={handleDrawStock}
          onBuyDiscard={handleDrawDiscard}
          onCardSelect={handleCardSelect}
          onDiscard={() => handleDiscard()}
          onMeld={handleLayDownMelds}
          onKnock={handleGoOut}
          onReorderHand={handleReorderHand}
          onLeaveRoom={handleLeaveRoom}
        />
        <Chat roomId={room.id} />
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block min-h-screen bg-gradient-to-br from-green-600 to-blue-600 p-4">
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
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-600">Última ação:</p>
                <p className="text-sm">{room.lastAction || 'Nenhuma'}</p>
              </div>
              <button
                onClick={handleLeaveRoom}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                aria-label="Sair da partida"
                title="Sair da partida"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
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
              <Melds
                melds={melds}
                players={players}
                hand={hand?.cards || []}
                isMyTurn={isMyTurn}
                onAddCardToMeld={handleAddCardToMeld}
              />
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

        {/* Chat */}
        <Chat roomId={room.id} />
        </div>
      </div>
    </>
  );
}
