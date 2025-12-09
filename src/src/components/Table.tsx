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
import { isValidMeld, Meld, validateMultipleMelds, findAllMelds, canGoOutWithScenarios, findExpandableMeld } from '../lib/rules';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';

interface TableProps {
  room: Room;
}

export function Table({ room }: TableProps) {
  const navigate = useNavigate();
  const userId = useAppStore(state => state.userId);
  const { alert } = useDialog();
  const showAlert = async (err: any) => {
    const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err) || 'Algo deu errado';
    await alert(msg);
  };

  const [players, setPlayers] = useState<Player[]>([]);
  const [hand, setHand] = useState<Hand | null>(null);
  const [opponentHands, setOpponentHands] = useState<Record<string, Hand>>({});
  const [deckState, setDeckState] = useState<DeckState | null>(null);
  const [melds, setMelds] = useState<MeldDoc[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [pauseDeadline, setPauseDeadline] = useState<number | null>(null);
  const [pauseRemainingMs, setPauseRemainingMs] = useState<number | null>(null);

  const isMyTurn = room.playerOrder[room.turnIndex] === userId;

  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers(room.id, setPlayers);
    const unsubscribeHand = userId ? subscribeToHand(room.id, userId, setHand) : () => {};
    const unsubscribeDeck = subscribeToDeckState(room.id, setDeckState);
    const unsubscribeMelds = subscribeToMelds(room.id, setMelds);

    // Subscribe to all opponent hands to show real card count
    const opponentUnsubscribes = room.playerOrder
      .filter(playerId => playerId !== userId)
      .map(playerId => {
        return subscribeToHand(room.id, playerId, (hand) => {
          setOpponentHands(prev => ({ ...prev, [playerId]: hand }));
        });
      });

    return () => {
      unsubscribePlayers();
      unsubscribeHand();
      unsubscribeDeck();
      unsubscribeMelds();
      opponentUnsubscribes.forEach(unsub => unsub());
    };
  }, [room.id, room.playerOrder, userId]);

  // Track previous turn index to detect turn changes
  const prevTurnIndex = useRef<number>(room.turnIndex);
  
  // Sync hasDrawn with Firestore player data
  useEffect(() => {
    if (isMyTurn) {
      const currentPlayer = players.find(p => p.id === userId);
      const hasDrawnFromFirestore = currentPlayer?.hasDrawnThisTurn || false;
      setHasDrawn(hasDrawnFromFirestore);
    } else {
      // If it's not my turn, reset hasDrawn
      setHasDrawn(false);
    }
  }, [players, isMyTurn, userId]);

  // Track pause timer (when someone is attempting to go out fora da vez)
  useEffect(() => {
    if (room.isPaused && room.pausedBy) {
      const deadline = Date.now() + 30000;
      setPauseDeadline(deadline);
    } else {
      setPauseDeadline(null);
      setPauseRemainingMs(null);
    }
  }, [room.isPaused, room.pausedBy]);

  useEffect(() => {
    if (!pauseDeadline) return;
    const id = setInterval(() => {
      const remaining = pauseDeadline - Date.now();
      setPauseRemainingMs(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [pauseDeadline]);
  
  // Reset hasDrawn when turn changes (only when it becomes my turn, not when it's already my turn)
  useEffect(() => {
    // Only reset if turnIndex actually changed AND it's now my turn
    if (isMyTurn && prevTurnIndex.current !== room.turnIndex) {
      setSelectedCards([]); // Clear selection when turn changes
      setSelectedCardIndices([]); // Clear selected indices when turn changes
      prevTurnIndex.current = room.turnIndex;
    } else if (!isMyTurn) {
      // If it's not my turn anymore, update the ref
      prevTurnIndex.current = room.turnIndex;
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
      const newCardIndex = currentHand.findIndex(card => !prevHandCards.includes(card));
      if (newCardIndex !== -1) {
        const newCard = currentHand[newCardIndex];
        if (!selectedCards.includes(newCard)) {
          setSelectedCards([newCard]);
          setSelectedCardIndices([newCardIndex]);
        }
      }
    }

    prevHand.current = currentHand;
  }, [hand?.cards, hasDrawn, isMyTurn, hand, selectedCards]);

  // Auto-select last card if player has 1 card AND has drawn (can go out by discarding)
  // IMPORTANT: This must be before any conditional returns to follow React hooks rules
  // Player must draw first before being able to discard
  useEffect(() => {
    if (hand && hand.cards.length === 1 && hasDrawn && isMyTurn) {
      const lastCard = hand.cards[0];
      // Always select the last card - this allows the player to discard and automatically go out
      if (selectedCards.length !== 1 || !selectedCards.includes(lastCard)) {
        setSelectedCards([lastCard]);
        setSelectedCardIndices([0]);
      }
    }
  }, [hand?.cards.length, hasDrawn, isMyTurn]);

  const handleDrawStock = async () => {
    if (!isMyTurn || hasDrawn || actionInProgress) {
      if (hasDrawn) {
        await showAlert('Você já comprou uma carta neste turno. Descartar uma carta primeiro.' );
      }
      return;
    }

    try {
      setActionInProgress(true);
      await drawFromStock(room.id);
      // IMPORTANT: Set hasDrawn to true AFTER successfully drawing
      setHasDrawn(true);
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao comprar do monte' );
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDrawDiscard = async () => {
    if (!isMyTurn || hasDrawn || actionInProgress) {
      if (hasDrawn) {
        await showAlert('Você já comprou uma carta neste turno. Descartar uma carta primeiro.' );
      }
      return;
    }

    try {
      setActionInProgress(true);
      await drawFromDiscard(room.id);
      // IMPORTANT: Set hasDrawn to true AFTER successfully drawing
      setHasDrawn(true);
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao comprar do descarte' );
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDiscard = async () => {
    // Player MUST draw first before being able to discard
    if (!isMyTurn || !hasDrawn || selectedCards.length !== 1 || !hand || actionInProgress) {
      if (!hasDrawn) {
        await showAlert('Você precisa comprar uma carta primeiro (do monte ou do descarte)' );
      }
      return;
    }

    try {
      setActionInProgress(true);
      // Use the specific index of the selected card
      const selectedIndex = selectedCardIndices[0];
      const cardToDiscard = selectedIndex !== undefined 
        ? hand.cards[selectedIndex] 
        : selectedCards[0];
      
      if (!cardToDiscard) {
        throw new Error('Carta não encontrada');
      }
      
      await discardCard(room.id, cardToDiscard, selectedIndex);
      setSelectedCards([]);
      setSelectedCardIndices([]);
      setHasDrawn(false); // Reset after discarding - ready for next turn
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao descartar' );
    } finally {
      setActionInProgress(false);
    }
  };

  const handleLayDownMelds = async (cardsToLay?: Card[]) => {
    const cards = cardsToLay || selectedCards;
    
    // Player must draw first before laying down melds
    if (!isMyTurn || !hasDrawn || cards.length < 3 || actionInProgress) {
      if (!hasDrawn) {
        await showAlert('Você precisa comprar uma carta primeiro (do monte ou do descarte)' );
      } else if (cards.length < 3) {
        await showAlert('Selecione pelo menos 3 cartas para criar uma combinação' );
      }
      return;
    }

    // Try to find an expandable meld (allows trinca + cards that fit)
    const expandableMeld = findExpandableMeld(cards);
    
    if (!expandableMeld.valid) {
      await showAlert('As cartas selecionadas não formam uma combinação válida. Você precisa de pelo menos uma trinca (3 cartas) e as cartas extras devem se encaixar na mesma combinação.' );
      return;
    }

    // Verify that all selected cards are included in the expandable meld
    // This ensures we're using all selected cards
    const expandableCardSet = new Set(expandableMeld.cards);
    const allSelectedIncluded = cards.every(card => expandableCardSet.has(card));
    
    if (!allSelectedIncluded) {
      await showAlert('Todas as cartas selecionadas devem fazer parte da mesma combinação.' );
      return;
    }

    try {
      setActionInProgress(true);
      const meldToLay: Meld = {
        type: expandableMeld.type!,
        cards: expandableMeld.cards, // Use the expanded meld cards
      };
      await layDownMelds(room.id, [meldToLay]);
      setSelectedCards([]);
      setSelectedCardIndices([]);
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao baixar combinações' );
    } finally {
      setActionInProgress(false);
    }
  };

  const handleGoOut = async () => {
    if (!hand || actionInProgress) return;

    const currentPlayer = players.find(p => p.id === userId);
    const isBlocked = currentPlayer?.isBlocked || false;

    // "Bater!" button is only for pausing when it's NOT your turn
    // When it's your turn, you automatically go out by discarding the last card
    if (isMyTurn) {
      await showAlert('Na sua vez, você bate automaticamente ao descartar a última carta. Use o botão "Descartar".' );
      return;
    }

    // If not player's turn and they're blocked, don't allow
    if (isBlocked) {
      await showAlert('Você está bloqueado. Só pode bater na sua vez.' );
      return;
    }

    // If not player's turn, try special scenarios (pause and attempt to go out)
    if (!isMyTurn) {
      // Check if player can go out with special scenarios
      const scenarioCheck = canGoOutWithScenarios(hand.cards, room.discardTop);
      if (!scenarioCheck.canGoOut || !scenarioCheck.scenario) {
        await showAlert(scenarioCheck.error || 'Não é possível bater com essas cartas fora da sua vez' );
        return;
      }

      try {
        setActionInProgress(true);
        const result = await attemptGoOut(room.id, scenarioCheck.scenario);
        if (result.success) {
          setSelectedCards([]);
        } else {
          await showAlert(result.error || 'Não foi possível bater. Você foi bloqueado.' );
        }
      } catch (error: any) {
        await showAlert(error.message || 'Erro ao tentar bater' );
      } finally {
        setActionInProgress(false);
      }
      return;
    }

    // Normal turn - player's turn
    // Need at least 4 cards: 3 for a meld + 1 to discard (or special scenarios)
    if (hand.cards.length < 2) {
      await showAlert('Você precisa ter pelo menos 2 cartas' );
      return;
    }

    // Check special scenarios first (if player has 2 or 3 cards)
    if (hand.cards.length === 2 || hand.cards.length === 3) {
      const scenarioCheck = canGoOutWithScenarios(hand.cards, room.discardTop);
      if (scenarioCheck.canGoOut && scenarioCheck.scenario) {
        try {
          setActionInProgress(true);
          await goOut(room.id, scenarioCheck.scenario.melds, scenarioCheck.scenario.discardCard || null, scenarioCheck.scenario);
          setSelectedCards([]);
        } catch (error: any) {
          await showAlert(error.message || 'Erro ao bater' );
        } finally {
          setActionInProgress(false);
        }
        return;
      }
    }

    // Normal scenario: Player selects all cards except one to discard
    if (selectedCards.length === 0) {
      await showAlert('Selecione as cartas que formam suas combinações e deixe UMA carta para descartar' );
      return;
    }

    // The cards NOT selected will be the discard card
    const remainingCards = hand.cards.filter(c => !selectedCards.includes(c));
    if (remainingCards.length !== 1) {
      await showAlert('Você deve deixar exatamente UMA carta para descartar' );
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
        await showAlert('As cartas selecionadas não formam combinações válidas. Tente selecionar cartas que formem sequências ou trincas.' );
        return;
      }
    }

    // Validate the melds
    const validation = validateMultipleMelds(selectedCards, meldsToLay);
    if (!validation.valid) {
      await showAlert(validation.error || 'Combinações inválidas' );
      return;
    }

    try {
      setActionInProgress(true);
      await goOut(room.id, meldsToLay, discardCardValue);
      setSelectedCards([]);
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao bater' );
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
    
    // Get real hand count for opponents
    const opponentHand = opponentHands[playerId];
    const handCount = isYou 
      ? hand?.cards.length || 0
      : opponentHand?.cards.length || 0;

    return {
      id: playerId,
      name: player?.name || 'Jogador',
      score: player?.score || 0,
      photoURL: player?.photoURL,
      handCount,
      isYou,
      isTurn: index === room.turnIndex,
      position,
      isBlocked: player?.isBlocked || false,
    };
  });
  

  const playerNamesMap = players.reduce((acc, player) => {
    acc[player.id] = player.name;
    return acc;
  }, {} as Record<string, string>);

  // Mapa de progresso de pausa por jogador (0..1)
  const pauseProgressByPlayer = (() => {
    if (!room.isPaused || !room.pausedBy || !pauseDeadline || pauseRemainingMs === null) return undefined;
    const total = 30000;
    const progress = Math.min(1, Math.max(0, 1 - pauseRemainingMs / total));
    return { [room.pausedBy]: progress };
  })();

  const handleCardSelect = (card: Card, index?: number) => {
    if (!isMyTurn || !hand) {
      return;
    }
    
    // Use the provided index or find the first occurrence
    const cardIndex = index !== undefined ? index : hand.cards.findIndex(c => c === card);
    if (cardIndex === -1) {
      return;
    }
    
    // Check if this specific card at this index is already selected
    const isSelected = selectedCardIndices.includes(cardIndex);
    
    if (isSelected) {
      // Deselecting this specific card instance
      const indexPos = selectedCardIndices.indexOf(cardIndex);
      if (indexPos === -1) return; // Should not happen, but safety check
      
      setSelectedCards([
        ...selectedCards.slice(0, indexPos),
        ...selectedCards.slice(indexPos + 1)
      ]);
      setSelectedCardIndices([
        ...selectedCardIndices.slice(0, indexPos),
        ...selectedCardIndices.slice(indexPos + 1)
      ]);
    } else {
      // Seleção múltipla sempre permitida; só limpa se quiser descartar usando botão
      const selectedCard = hand.cards[cardIndex];
      setSelectedCards([...selectedCards, selectedCard]);
      setSelectedCardIndices([...selectedCardIndices, cardIndex]);
    }
  };

  const handleReorderHand = async (newOrder: Card[]) => {
    if (!hand) return;
    
    try {
      await reorderHand(room.id, newOrder);
      
      // Update selected card indices based on new order
      // Map old indices to new positions
      const oldCards = hand.cards;
      const newIndices: number[] = [];
      const newSelectedCards: Card[] = [];
      
      selectedCardIndices.forEach((oldIndex) => {
        const card = oldCards[oldIndex];
        const newIndex = newOrder.findIndex((c, idx) => {
          // Find the same card at the same relative position
          // Count how many times this card appears before oldIndex in old order
          const occurrencesBeforeOld = oldCards.slice(0, oldIndex).filter(c => c === card).length;
          // Count how many times this card appears before newIndex in new order
          const occurrencesBeforeNew = newOrder.slice(0, idx).filter(c => c === card).length;
          return c === card && occurrencesBeforeNew === occurrencesBeforeOld;
        });
        
        if (newIndex !== -1) {
          newIndices.push(newIndex);
          newSelectedCards.push(card);
        }
      });
      
      setSelectedCardIndices(newIndices);
      setSelectedCards(newSelectedCards);
    } catch (error: any) {
      console.error('Erro ao reordenar cartas:', error);
      // Não mostrar alerta para não interromper a experiência
    }
  };

  const handleLeaveRoom = async () => {
    const confirmed = await confirm({
      title: 'Confirmar saída',
      message: 'Tem certeza que deseja sair da partida?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    
    if (!confirmed) {
      return;
    }

    try {
      await leaveRoom(room.id);
      navigate('/');
    } catch (error: any) {
      console.error('Erro ao sair da sala:', error);
      await showAlert(error.message || 'Erro ao sair da partida' );
    }
  };

  const handleAddCardToMeld = async (meldId: string, card: Card) => {
    // Player must draw first before adding cards to melds
    if (!isMyTurn || !hasDrawn || actionInProgress) {
      if (!hasDrawn) {
        await showAlert('Você precisa comprar uma carta primeiro (do monte ou do descarte)' );
      }
      return;
    }

    try {
      setActionInProgress(true);
      await addCardToMeld(room.id, meldId, card);
      
      // After adding card to meld, if hand has only 1 card left and player has drawn,
      // automatically select that card so they can discard and go out
      // Note: hand will be updated via subscription, so we check in a useEffect
      setSelectedCards([]);
      setSelectedCardIndices([]);
    } catch (error: any) {
      await showAlert(error.message || 'Erro ao adicionar carta à combinação' );
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
        selectedIndices={selectedCardIndices}
        melds={melds}
        playerNames={playerNamesMap}
        canPlay={isMyTurn && !actionInProgress}
        hasDrawn={hasDrawn}
        rules={room.rules}
        roomId={room.id}
        pauseProgressByPlayer={pauseProgressByPlayer}
        onBuyStock={handleDrawStock}
        onBuyDiscard={handleDrawDiscard}
        onCardSelect={handleCardSelect}
        onDiscard={() => handleDiscard()}
        onMeld={handleLayDownMelds}
        onKnock={handleGoOut}
        onReorderHand={handleReorderHand}
        onLeaveRoom={handleLeaveRoom}
        onAddCardToMeld={handleAddCardToMeld}
        onCreateMeld={handleLayDownMelds}
      />
    </>
  );
}
