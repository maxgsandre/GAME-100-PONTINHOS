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
  pauseAndPickupDiscard,
  returnDiscardAndUnpause,
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
  const { alert, confirm } = useDialog();
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
  const [pauseRemainingMs, setPauseRemainingMs] = useState<number | null>(null);
  const [pickedUpDiscardCard, setPickedUpDiscardCard] = useState<Card | null>(null);
  const [pauseProgressByPlayer, setPauseProgressByPlayer] = useState<Record<string, number> | undefined>(undefined);
  const pauseStartRef = useRef<number | null>(null);
  const prevDiscardTopRef = useRef<Card | null>(null);

  // During pause, the player who paused has the turn
  const isMyTurn = room.isPaused && room.pausedBy === userId
    ? true
    : !room.isPaused && room.playerOrder[room.turnIndex] === userId;

  // Auto-clear blocking on mount (temporary for testing)
  useEffect(() => {
    if (userId) {
      const currentPlayer = players.find(p => p.id === userId);
      if (currentPlayer?.isBlocked) {
        // Clear blocking automatically
        import('../lib/firebase').then(({ db }) => {
          import('firebase/firestore').then(({ doc, updateDoc }) => {
            const playerRef = doc(db, 'rooms', room.id, 'players', userId);
            updateDoc(playerRef, { isBlocked: false }).catch(() => {
              // Silently fail if there's an error
            });
          });
        });
      }
    }
  }, [players, userId, room.id]);

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
    } else if (room.isPaused && room.pausedBy === userId) {
      // During pause, player has "drawn" the discard card
      setHasDrawn(true);
    } else {
      // If it's not my turn, reset hasDrawn
      setHasDrawn(false);
    }
  }, [players, isMyTurn, userId, room.isPaused, room.pausedBy]);

  // Track previous discardTop to know which card was picked up when pause starts
  useEffect(() => {
    if (!room.isPaused && room.discardTop) {
      prevDiscardTopRef.current = room.discardTop;
    }
  }, [room.discardTop, room.isPaused]);

  // Track pause timer (when someone is attempting to go out fora da vez)
  useEffect(() => {
    if (room.isPaused && room.pausedBy === userId) {
      // Store the discard card that was picked up (it was the discardTop before pause)
      if (prevDiscardTopRef.current) {
        setPickedUpDiscardCard(prevDiscardTopRef.current);
      }
      // Start timer immediately on pausing client to avoid waiting for Firestore timestamp sync
      const startMs = room.pauseStartedAt ?? Date.now();
      const pausedAtMs = room.pausedAt ? room.pausedAt.toMillis() : startMs;
      const startAligned = Math.min(pausedAtMs, startMs); // evita start no futuro (clock skew)
      pauseStartRef.current = startAligned;
      const deadline = startAligned + 40000;
      setPauseRemainingMs(Math.max(0, deadline - Date.now()));
    } else {
      setPickedUpDiscardCard(null);
      pauseStartRef.current = null;
    }
  }, [room.isPaused, room.pausedBy, room.pauseStartedAt, room.pausedAt, userId]);

  // Track pause timer for ALL players (so everyone can see the progress)
  useEffect(() => {
    if (!room.isPaused || !room.pausedBy) {
      setPauseRemainingMs(null);
      setPauseProgressByPlayer(undefined);
      pauseStartRef.current = null;
      return;
    }

    // Ensure we align local start time with pausedAt (shared fonte de verdade)
    if (room.pauseStartedAt) {
      pauseStartRef.current = room.pauseStartedAt;
    } else if (room.pausedAt) {
      pauseStartRef.current = room.pausedAt.toMillis();
    } else if (!pauseStartRef.current) {
      pauseStartRef.current = Date.now();
    }

    // Calculate remaining time based on pausedAt timestamp (fallback to now)
    const updateRemaining = () => {
      const startMsRaw =
        room.pauseStartedAt ??
        (room.pausedAt ? room.pausedAt.toMillis() : undefined) ??
        pauseStartRef.current ??
        Date.now();
      if (!pauseStartRef.current) {
        const aligned = Math.min(startMsRaw, Date.now());
        pauseStartRef.current = aligned;
      }
      const startMs = pauseStartRef.current!;
      const elapsed = Math.max(0, Date.now() - startMs);
      const remaining = Math.max(0, 40000 - elapsed);
      setPauseRemainingMs(remaining);
      const progress = Math.min(1, Math.max(0, 1 - remaining / 40000));
      setPauseProgressByPlayer({ [room.pausedBy!]: progress });
      
      // If timer expired and it's the player who paused, return the card
      if (remaining <= 0 && room.pausedBy === userId && pickedUpDiscardCard) {
        returnDiscardAndUnpause(room.id, pickedUpDiscardCard).catch((error) => {
          console.error('Error returning discard card:', error);
        });
        pauseStartRef.current = null;
      }
    };

    // Update immediately
    updateRemaining();

    // Update every 200ms
    const id = setInterval(updateRemaining, 200);
    return () => clearInterval(id);
  }, [room.isPaused, room.pausedBy, room.pausedAt, room.id, userId, pickedUpDiscardCard]);
  
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
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    if (!hand || (!isMyTurn && !isPausedByMe)) {
      prevHand.current = hand?.cards || [];
      return;
    }

    const currentHand = hand.cards;
    const prevHandCards = prevHand.current;

    // If hand increased by 1 card and we just drew (or are in pause), find the new card
    if (currentHand.length === prevHandCards.length + 1 && (hasDrawn || isPausedByMe)) {
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
  }, [hand?.cards, hasDrawn, isMyTurn, hand, selectedCards, room.isPaused, room.pausedBy, userId]);

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
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    // Se o jogo está pausado por qualquer jogador, bloquear compra do monte
    if (room.isPaused) {
      await showAlert('Compra do monte desativada enquanto alguém está tentando bater.');
      return;
    }
    // During pause, monte is disabled
    if (isPausedByMe) {
      await showAlert('Durante a tentativa de bater, você não pode comprar do monte. Use apenas a carta do descarte.' );
      return;
    }
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
    // Allow drawing during pause (but discard card is already picked up automatically)
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    if (!isMyTurn && !isPausedByMe) {
      return;
    }
    
    if (isMyTurn && (hasDrawn || actionInProgress)) {
      if (hasDrawn) {
        await showAlert('Você já comprou uma carta neste turno. Descartar uma carta primeiro.' );
      }
      return;
    }
    
    // During pause, discard card is already picked up, so just show message
    if (isPausedByMe) {
      await showAlert('A carta do descarte já foi pega automaticamente quando você pausou o jogo.' );
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
    // Allow discarding during pause (player has picked up discard card)
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    
    if (!isMyTurn && !isPausedByMe) {
      return;
    }
    
    // Player MUST draw first before being able to discard (or be in pause)
    // During pause, hasDrawn is already true (card was picked up automatically)
    if ((isMyTurn && !hasDrawn && !isPausedByMe) || selectedCards.length !== 1 || !hand || actionInProgress) {
      if (isMyTurn && !hasDrawn && !isPausedByMe) {
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
    
    // Allow during pause (card was already picked up)
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    // Player must draw first before laying down melds (or be in pause)
    if ((!isMyTurn && !isPausedByMe) || (!hasDrawn && !isPausedByMe) || cards.length < 3 || actionInProgress) {
      if (!hasDrawn && !isPausedByMe) {
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

    // "Bater!" button is only for pausing when it's NOT your turn
    // When it's your turn, you automatically go out by discarding the last card
    if (isMyTurn) {
      await showAlert('Na sua vez, você bate automaticamente ao descartar a última carta. Use o botão "Descartar".' );
      return;
    }

    // If game is already paused by this player, validate and try to go out
    if (room.isPaused && room.pausedBy === userId) {
      // Player is trying to go out during pause - validate scenario
      if (!room.discardTop) {
        await showAlert('Erro: carta do descarte não encontrada' );
        return;
      }

      // Check if player can go out with current hand (including picked up discard)
      const scenarioCheck = canGoOutWithScenarios(hand.cards, room.discardTop);
      if (!scenarioCheck.canGoOut || !scenarioCheck.scenario) {
        await showAlert(scenarioCheck.error || 'Não é possível bater com essas cartas' );
        return;
      }

      try {
        setActionInProgress(true);
        const result = await attemptGoOut(room.id, scenarioCheck.scenario);
        if (result.success) {
          setSelectedCards([]);
        } else {
          await showAlert(result.error || 'Não foi possível bater.' );
        }
      } catch (error: any) {
        await showAlert(error.message || 'Erro ao tentar bater' );
      } finally {
        setActionInProgress(false);
      }
      return;
    }

    // If not player's turn and game is not paused, pause and pickup discard
    if (!isMyTurn && !room.isPaused) {
      if (!room.discardTop) {
        await showAlert('Não há carta no descarte para pegar' );
        return;
      }

      try {
        setActionInProgress(true);
        // Start timer immediately on this client to evitar atraso de sync
        pauseStartRef.current = Date.now();
        setPauseRemainingMs(30000);
        // Pause game and automatically pickup discard card
        await pauseAndPickupDiscard(room.id);
        // Timer will start automatically via useEffect
        // Player now has 30 seconds to create melds and try to go out
      } catch (error: any) {
        await showAlert(error.message || 'Erro ao pausar jogo' );
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

    // During pause, show pausedBy player as having the turn
    const isTurn = room.isPaused && room.pausedBy === playerId
      ? true
      : !room.isPaused && index === room.turnIndex;
    
    return {
      id: playerId,
      name: player?.name || 'Jogador',
      score: player?.score || 0,
      photoURL: player?.photoURL,
      handCount,
      isYou,
      isTurn,
      position,
      isBlocked: player?.isBlocked || false,
    };
  });
  

  const playerNamesMap = players.reduce((acc, player) => {
    acc[player.id] = player.name;
    return acc;
  }, {} as Record<string, string>);

  // Dados do jogador da vez para regras de habilitação do botão Bater!
  const currentTurnPlayerId = room.playerOrder[room.turnIndex];
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);
  const currentTurnHasDrawn = currentTurnPlayer?.hasDrawnThisTurn ?? false;

  // pauseProgressByPlayer é mantido em estado (atualizado no useEffect do timer)

  const handleCardSelect = (card: Card, index?: number) => {
    // Allow card selection during pause (when player is trying to go out)
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    if ((!isMyTurn && !isPausedByMe) || !hand) {
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
    // Allow during pause (card was already picked up)
    const isPausedByMe = room.isPaused && room.pausedBy === userId;
    // Player must draw first before adding cards to melds (or be in pause)
    if ((!isMyTurn && !isPausedByMe) || (!hasDrawn && !isPausedByMe) || actionInProgress) {
      if (!hasDrawn && !isPausedByMe) {
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
        discardedBy={room.discardedBy}
        stockCount={deckState.stock.length}
        hand={hand.cards}
        selectedCards={selectedCards}
        selectedIndices={selectedCardIndices}
        melds={melds}
        playerNames={playerNamesMap}
        canPlay={isMyTurn && !actionInProgress}
        hasDrawn={hasDrawn}
        isPaused={room.isPaused}
        pausedBy={room.pausedBy}
        currentTurnHasDrawn={currentTurnHasDrawn}
        currentUserId={userId}
        rules={room.rules}
        roomId={room.id}
      pauseProgressByPlayer={undefined} // deixamos o anel do avatar desligado; usamos o contador no header
      pauseRemainingMs={pauseRemainingMs}
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
