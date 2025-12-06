import { useState, useEffect, useRef } from 'react';
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
  attemptGoOut,
  reorderHand,
  leaveRoom,
  addCardToMeld,
} from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { Card } from '../lib/deck';
import { isValidMeld, Meld, validateMultipleMelds, findAllMelds, canGoOutWithScenarios } from '../lib/rules';
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
    if (!hand || actionInProgress) return;

    const currentPlayer = players.find(p => p.id === userId);
    const isBlocked = currentPlayer?.isBlocked || false;

    // If not player's turn and they're blocked, don't allow
    if (!isMyTurn && isBlocked) {
      alert('Você está bloqueado. Só pode bater na sua vez.');
      return;
    }

    // If not player's turn, try special scenarios
    if (!isMyTurn) {
      // Check if player can go out with special scenarios
      const scenarioCheck = canGoOutWithScenarios(hand.cards, room.discardTop, melds);
      if (!scenarioCheck.canGoOut || !scenarioCheck.scenario) {
        alert(scenarioCheck.error || 'Não é possível bater com essas cartas fora da sua vez');
        return;
      }

      try {
        setActionInProgress(true);
        const result = await attemptGoOut(room.id, scenarioCheck.scenario, melds);
        if (result.success) {
          setSelectedCards([]);
        } else {
          alert(result.error || 'Não foi possível bater. Você foi bloqueado.');
        }
      } catch (error: any) {
        alert(error.message || 'Erro ao tentar bater');
      } finally {
        setActionInProgress(false);
      }
      return;
    }

    // Normal turn - player's turn
    // Need at least 4 cards: 3 for a meld + 1 to discard (or special scenarios)
    if (hand.cards.length < 2) {
      alert('Você precisa ter pelo menos 2 cartas');
      return;
    }

    // Check special scenarios first (if player has 2 or 3 cards)
    if (hand.cards.length === 2 || hand.cards.length === 3) {
      const scenarioCheck = canGoOutWithScenarios(hand.cards, room.discardTop, melds);
      if (scenarioCheck.canGoOut && scenarioCheck.scenario) {
        try {
          setActionInProgress(true);
          await goOut(room.id, scenarioCheck.scenario.melds, scenarioCheck.scenario.discardCard || null, scenarioCheck.scenario);
          setSelectedCards([]);
        } catch (error: any) {
          alert(error.message || 'Erro ao bater');
        } finally {
          setActionInProgress(false);
        }
        return;
      }
    }

    // Normal scenario: Player selects all cards except one to discard
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

  // Prepare players data for mobile layout with positions
  // Determine positions: current user is always bottom, others are distributed
  const myIndex = room.playerOrder.findIndex(id => id === userId);
  const totalPlayers = room.playerOrder.length;
  
  if (myIndex === -1) {
    console.error('Current user not found in playerOrder');
  }
  
  const playersForMobile = room.playerOrder.map((playerId, index) => {
    const player = players.find(p => p.id === playerId);
    const isYou = playerId === userId;
    
    // Determine position based on player order relative to current user
    let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    if (isYou) {
      position = 'bottom';
    } else {
      const relativeIndex = (index - myIndex + totalPlayers) % totalPlayers;
      // Skip relativeIndex 0 (that's the current user)
      if (relativeIndex === 0) {
        position = 'bottom'; // Fallback, should not happen
      } else if (totalPlayers === 2) {
        // With 2 players: opponent goes to top
        position = 'top';
      } else if (totalPlayers === 3) {
        // With 3 players: distribute to top and left
        if (relativeIndex === 1) position = 'top';
        else if (relativeIndex === 2) position = 'left';
      } else if (totalPlayers === 4) {
        // With 4 players: distribute to top, left, and right
        if (relativeIndex === 1) position = 'top';
        else if (relativeIndex === 2) position = 'left';
        else if (relativeIndex === 3) position = 'right';
      }
    }
    
    return {
      id: playerId,
      name: player?.name || 'Jogador',
      score: player?.score || 0,
      photoURL: player?.photoURL,
      handCount: isYou ? hand?.cards.length : 9, // For opponents, show default count (we don't have access to their hands)
      isYou,
      isTurn: index === room.turnIndex,
      position,
      isBlocked: player?.isBlocked || false,
    };
  });
  
  // Debug: log player positions
  if (totalPlayers === 4) {
    console.log('🔍 4 Players - Positions:', playersForMobile.map(p => `${p.name} (${p.position})`));
  }

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
      {/* Unified Layout - Mobile and Desktop */}
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
        roomId={room.id}
        onBuyStock={handleDrawStock}
        onBuyDiscard={handleDrawDiscard}
        onCardSelect={handleCardSelect}
        onDiscard={() => handleDiscard()}
        onMeld={handleLayDownMelds}
        onKnock={handleGoOut}
        onReorderHand={handleReorderHand}
        onLeaveRoom={handleLeaveRoom}
        onAddCardToMeld={handleAddCardToMeld}
      />
    </>
  );
}
