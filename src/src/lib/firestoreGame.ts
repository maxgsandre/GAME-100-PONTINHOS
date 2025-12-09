import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import { db, getCurrentUserId, getCurrentUserData } from './firebase';
import { Card, generateDoubleDeck, shuffleDeck } from './deck';
import { GameRules, DEFAULT_RULES, Meld, canAddCardToMeld, GoOutScenario } from './rules';

export interface Room {
  id: string;
  code: string;
  ownerId: string;
  status: 'lobby' | 'playing' | 'roundEnd' | 'finished';
  createdAt: Timestamp;
  playerOrder: string[];
  turnIndex: number;
  round: number;
  discardTop: Card | null;
  rules: GameRules;
  lastAction?: string;
  winnerId?: string; // Winner of current round
  firstPassComplete?: boolean; // True when all players have played at least once in current round
  isPaused?: boolean; // True when someone is attempting to go out out of turn
  pausedBy?: string; // User ID of player who paused the game
  pausedAt?: Timestamp; // When the game was paused (for timer calculation)
  discardedBy?: string; // User ID of player who discarded the top card
}

export interface Player {
  id: string;
  name: string;
  photoURL?: string; // Google profile photo
  joinedAt: Timestamp;
  score: number;
  isReady: boolean;
  isBlocked?: boolean; // True if player tried to go out and failed (can only go out on their turn)
  hasDrawnThisTurn?: boolean; // True if player has drawn a card in current turn
}

export interface Hand {
  cards: Card[];
}

// Helper function to find eligible winner (player with < 100 points)
// If the player who went out has 100+ points, find the player with lowest score < 100
// If all players have 100+, return the player with lowest score
function findEligibleWinner(
  playerWhoWentOut: string,
  playerDocs: Array<{ id: string; data: () => Player }>,
  playerOrder: string[]
): string | null {
  // Get all players with their scores
  const playersWithScores = playerDocs
    .map((doc) => ({
      id: doc.id,
      score: doc.data().score || 0,
    }))
    .filter((p) => playerOrder.includes(p.id));

  if (playersWithScores.length === 0) return null;

  // Find the player who went out
  const wentOutPlayer = playersWithScores.find((p) => p.id === playerWhoWentOut);
  if (!wentOutPlayer) return playerWhoWentOut;

  // If player who went out has < 100 points, they win
  if (wentOutPlayer.score < 100) {
    return playerWhoWentOut;
  }

  // Player has 100+ points, find eligible winner (lowest score < 100)
  const eligiblePlayers = playersWithScores.filter((p) => p.score < 100);
  
  if (eligiblePlayers.length === 0) {
    // All players have 100+, return player with lowest score
    const lowestScore = Math.min(...playersWithScores.map((p) => p.score));
    const winner = playersWithScores.find((p) => p.score === lowestScore);
    return winner?.id || null;
  }

  // Return eligible player with lowest score
  const lowestScore = Math.min(...eligiblePlayers.map((p) => p.score));
  const winner = eligiblePlayers.find((p) => p.score === lowestScore);
  return winner?.id || null;
}

export interface DeckState {
  stock: Card[];
  discard: Card[];
}

export interface MeldDoc {
  id: string;
  ownerUid: string;
  cards: Card[];
  type: 'sequence' | 'set';
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: Timestamp;
}

// Create room
export const createRoom = async (): Promise<string> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  const roomRef = doc(collection(db, 'rooms'));
  const roomData: Omit<Room, 'id'> = {
    code: Math.floor(100000 + Math.random() * 900000).toString(),
    ownerId: userId,
    status: 'lobby',
    createdAt: serverTimestamp() as Timestamp,
    playerOrder: [userId],
    turnIndex: 0,
    round: 0,
    discardTop: null,
    rules: DEFAULT_RULES,
  };

  await setDoc(roomRef, roomData);

  // Create player document
  const playerRef = doc(roomRef, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: userData.name,
    photoURL: userData.photoURL || undefined,
    joinedAt: serverTimestamp() as Timestamp,
    score: 0,
    isReady: false,
  };

  await setDoc(playerRef, playerData);

  return roomRef.id;
};

// Join room
export const joinRoom = async (roomCode: string): Promise<string> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  // Find room by code
  const roomsRef = collection(db, 'rooms');
  const q = query(roomsRef, where('code', '==', roomCode));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Sala não encontrada');
  }

  const roomDoc = querySnapshot.docs[0];
  const roomData = roomDoc.data() as Room;

  if (roomData.status !== 'lobby') {
    throw new Error('Jogo já iniciado');
  }

  if (roomData.playerOrder.includes(userId)) {
    return roomDoc.id; // Already in room
  }

  if (roomData.playerOrder.length >= 4) {
    throw new Error('Sala cheia');
  }

  const roomId = roomDoc.id;
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: userData.name,
    photoURL: userData.photoURL || undefined,
    joinedAt: serverTimestamp() as Timestamp,
    score: 0,
    isReady: false,
  };

  // Use transaction to ensure atomicity
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const currentRoomDoc = await transaction.get(roomRef);
    
    if (!currentRoomDoc.exists()) {
      throw new Error('Sala não encontrada');
    }
    
    const currentRoomData = currentRoomDoc.data() as Room;
    
    // Double-check room is still in lobby and not full
    if (currentRoomData.status !== 'lobby') {
      throw new Error('Jogo já iniciado');
    }
    
    if (currentRoomData.playerOrder.includes(userId)) {
      return; // Already in room
    }
    
    if (currentRoomData.playerOrder.length >= 4) {
      throw new Error('Sala cheia');
    }
    
    // Add player to playerOrder
    transaction.update(roomRef, {
      playerOrder: [...currentRoomData.playerOrder, userId],
    });
    
    // Create player document
    transaction.set(playerRef, playerData);
  });

  return roomId;
};

// Start game (only owner can call)
export const startGame = async (roomId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    
    // ALL READS FIRST - Firestore requires all reads before any writes
    const roomDoc = await transaction.get(roomRef);

    if (!roomDoc.exists()) {
      throw new Error('Sala não encontrada');
    }

    const roomData = roomDoc.data() as Room;

    if (roomData.ownerId !== userId) {
      throw new Error('Apenas o dono pode iniciar o jogo');
    }

    if (roomData.playerOrder.length < 2) {
      throw new Error('Mínimo de 2 jogadores necessário');
    }

    // Allow starting from 'lobby' (first game) or 'roundEnd' (next round)
    if (roomData.status !== 'lobby' && roomData.status !== 'roundEnd') {
      throw new Error('Jogo já iniciado');
    }

    // Read all player documents individually (transaction.get() doesn't accept queries)
    const playerDocs: any[] = [];
    for (const playerId of roomData.playerOrder) {
      const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
      const playerDoc = await transaction.get(playerRef);
      if (playerDoc.exists()) {
        playerDocs.push(playerDoc);
      }
    }

    // Generate and shuffle deck
    const deck = shuffleDeck(generateDoubleDeck());

    // Deal 9 cards to each player
    const playerOrder = roomData.playerOrder;
    const hands: Record<string, Card[]> = {};

    playerOrder.forEach((playerId, index) => {
      hands[playerId] = deck.slice(index * 9, (index + 1) * 9);
    });

    // Remaining cards go to stock
    const stock = deck.slice(playerOrder.length * 9);
    
    // First card of stock goes to discard
    const firstDiscard = stock.pop()!;
    const discard = [firstDiscard];

    // Determine if this is a new round (increment round) or first game (round 1)
    const currentRound = roomData.round || 0;
    const newRound = currentRound + 1;

    // NOW ALL WRITES - After all reads are complete
    // Update room
    // Note: We don't set pausedBy here because it shouldn't exist at game start
    // If it exists from a previous round, we'll let it be overwritten naturally
    transaction.update(roomRef, {
      status: 'playing',
      round: newRound,
      turnIndex: 0,
      discardTop: firstDiscard,
      discardedBy: deleteField(), // No one discarded yet, it's the initial card
      lastAction: 'Jogo iniciado',
      firstPassComplete: false, // First pass not complete yet - reset for new round
      isPaused: false,
    });

      // Reset all player blocks and hasDrawnThisTurn for new round
      playerDocs.forEach((playerDoc) => {
        const playerData = playerDoc.data();
        if (playerDoc.ref) {
          const updates: any = { hasDrawnThisTurn: false };
          if (playerData && playerData.isBlocked) {
            updates.isBlocked = false;
          }
          transaction.update(playerDoc.ref, updates);
        }
      });

    // Create hands
    for (const playerId of playerOrder) {
      const handRef = doc(db, 'rooms', roomId, 'hands', playerId);
      transaction.set(handRef, { cards: hands[playerId] });
    }

    // Create deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    transaction.set(deckRef, { stock, discard });
  });
};

// Draw card from stock
export const drawFromStock = async (roomId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    if (roomData.isPaused && roomData.pausedBy !== userId) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn (unless paused by this player)
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId && !(roomData.isPaused && roomData.pausedBy === userId)) {
      throw new Error('Não é seu turno');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    if (deckData.stock.length === 0) {
      throw new Error('Monte vazio');
    }

    // Take top card from stock
    const card = deckData.stock.pop()!;

    // Add to player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    // Validar que não pode ter mais de 10 cartas após comprar
    if (handData.cards.length >= 10) {
      throw new Error('Você já tem 10 cartas. Descartar uma carta antes de comprar novamente.');
    }

    transaction.update(handRef, {
      cards: [...handData.cards, card],
    });

    transaction.update(deckRef, {
      stock: deckData.stock,
    });

    // Mark that player has drawn this turn (only if it's their turn, not during pause)
    if (currentPlayerId === userId) {
      const playerRef = doc(db, 'rooms', roomId, 'players', userId);
      transaction.update(playerRef, {
        hasDrawnThisTurn: true,
      });
    }

    transaction.update(roomRef, {
      lastAction: 'Comprou do monte',
    });
  });
};

// Draw card from discard pile
export const drawFromDiscard = async (roomId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    if (roomData.isPaused && roomData.pausedBy !== userId) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn OR player paused the game (trying to go out)
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    const isPausedByMe = roomData.isPaused && roomData.pausedBy === userId;
    
    if (currentPlayerId !== userId && !isPausedByMe) {
      throw new Error('Não é seu turno');
    }

    if (!roomData.discardTop) {
      throw new Error('Descarte vazio');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    // Fix inconsistent state: if discardTop exists but discard array is empty, sync them
    let discardArray = deckData.discard;
    if (discardArray.length === 0 && roomData.discardTop) {
      // State is inconsistent - add discardTop to array to fix it
      discardArray = [roomData.discardTop];
    }

    if (discardArray.length === 0) {
      throw new Error('Descarte vazio');
    }

    // Take top card from discard
    const card = discardArray[discardArray.length - 1];
    const newDiscard = discardArray.slice(0, -1);
    const newDiscardTop = newDiscard.length > 0 ? newDiscard[newDiscard.length - 1] : null;

    // Add to player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    // Validar que não pode ter mais de 10 cartas após comprar
    if (handData.cards.length >= 10) {
      throw new Error('Você já tem 10 cartas. Descartar uma carta antes de comprar novamente.');
    }

    transaction.update(handRef, {
      cards: [...handData.cards, card],
    });

    transaction.update(deckRef, {
      discard: newDiscard,
    });

    // Mark that player has drawn this turn (only if it's their turn, not during pause)
    if (currentPlayerId === userId) {
      const playerRef = doc(db, 'rooms', roomId, 'players', userId);
      transaction.update(playerRef, {
        hasDrawnThisTurn: true,
      });
    }

    transaction.update(roomRef, {
      discardTop: newDiscardTop,
      discardedBy: newDiscardTop ? roomData.discardedBy : deleteField(), // Keep previous discardedBy if there's still a card
      lastAction: 'Comprou do descarte',
    });
  });
};

// Pause game and pickup discard card (for going out out of turn)
export const pauseAndPickupDiscard = async (roomId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Verify it's NOT player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId === userId) {
      throw new Error('Na sua vez, você bate automaticamente ao descartar a última carta.');
    }

    // Check if game is already paused
    if (roomData.isPaused) {
      if (roomData.pausedBy === userId) {
        // Already paused by this player, just return (card already picked up)
        return;
      } else {
        throw new Error('Jogo já está pausado por outro jogador');
      }
    }

    if (!roomData.discardTop) {
      throw new Error('Não há carta no descarte para pegar');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    // Fix inconsistent state: if discardTop exists but discard array is empty, sync them
    let discardArray = deckData.discard;
    if (discardArray.length === 0 && roomData.discardTop) {
      // State is inconsistent - add discardTop to array to fix it
      discardArray = [roomData.discardTop];
    }

    if (discardArray.length === 0) {
      throw new Error('Descarte vazio');
    }

    // Take top card from discard
    const card = discardArray[discardArray.length - 1];
    const newDiscard = discardArray.slice(0, -1);
    const newDiscardTop = newDiscard.length > 0 ? newDiscard[newDiscard.length - 1] : null;

    // Add to player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    transaction.update(handRef, {
      cards: [...handData.cards, card],
    });

    transaction.update(deckRef, {
      discard: newDiscard,
    });

    // Pause the game
    transaction.update(roomRef, {
      isPaused: true,
      pausedBy: userId,
      pausedAt: serverTimestamp() as Timestamp,
      discardTop: newDiscardTop,
      discardedBy: newDiscardTop ? roomData.discardedBy : deleteField(), // Keep previous discardedBy if there's still a card
      lastAction: 'Pausou o jogo para tentar bater',
    });
  });
};

// Return discard card and unpause (when timer expires or player fails)
export const returnDiscardAndUnpause = async (roomId: string, discardCard: Card): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Verify it's paused by this player
    if (!roomData.isPaused || roomData.pausedBy !== userId) {
      throw new Error('Jogo não está pausado por você');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    // Remove card from player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    if (!handData.cards.includes(discardCard)) {
      throw new Error('Carta do descarte não está na sua mão');
    }

    const newHand = handData.cards.filter(c => c !== discardCard);

    transaction.update(handRef, {
      cards: newHand,
    });

    // Return card to discard
    transaction.update(deckRef, {
      discard: [...deckData.discard, discardCard],
    });

    // Unpause game
    transaction.update(roomRef, {
      isPaused: false,
      pausedBy: deleteField(),
      pausedAt: deleteField(),
      discardTop: discardCard,
      discardedBy: userId, // Player who returned the card is now the one who discarded it
      lastAction: 'Tempo esgotado - carta retornada',
    });
  });
};

// Discard a card
export const discardCard = async (roomId: string, card: Card, _cardIndex?: number): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    const isPausedByMe = roomData.isPaused && roomData.pausedBy === userId;
    if (roomData.isPaused && !isPausedByMe) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn OR player paused the game (trying to go out)
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId && !isPausedByMe) {
      throw new Error('Não é seu turno');
    }

    // Get player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    if (!handDoc.exists()) {
      throw new Error('Mão não encontrada');
    }
    const handData = handDoc.data() as Hand;

    // Get deck state (needed to push the discarded card)
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    if (!deckDoc.exists()) {
      throw new Error('Estado do baralho não encontrado');
    }
    const deckData = deckDoc.data() as DeckState;

    // Verify player has the card
    if (!handData.cards.includes(card)) {
      throw new Error('Você não tem essa carta');
    }

    // Remove card from hand
    const newHand = handData.cards.filter(c => c !== card);

    // Read all player documents for updates
    const allPlayerRefs: Array<{ ref: any; id: string }> = [];
    for (const playerId of roomData.playerOrder) {
      allPlayerRefs.push({ ref: doc(db, 'rooms', roomId, 'players', playerId), id: playerId });
    }
    const playerDocs = await Promise.all(allPlayerRefs.map(({ ref }) => transaction.get(ref)));

    // Find current player index in playerOrder
    const currentPlayerIndex = roomData.playerOrder.indexOf(userId);

    transaction.update(handRef, {
      cards: newHand,
    });

    // Push discarded card to the discard pile
    transaction.update(deckRef, {
      discard: [...deckData.discard, card],
    });

    // If player has no cards left after discarding, they go out (bater)
    if (newHand.length === 0) {
      // Reset hasDrawnThisTurn for current player (they finished their turn by going out)
      if (currentPlayerIndex >= 0 && currentPlayerIndex < allPlayerRefs.length) {
        transaction.update(allPlayerRefs[currentPlayerIndex].ref, {
          hasDrawnThisTurn: false,
        });
      }
      
      // Find eligible winner (player with < 100 points)
      const eligibleWinner = findEligibleWinner(
        userId,
        playerDocs.map((doc, idx) => ({ id: allPlayerRefs[idx].id, data: () => doc.data() as Player })),
        roomData.playerOrder
      );
      
      // Player goes out by discarding last card
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: card,
        discardedBy: userId,
        winnerId: eligibleWinner || userId,
        lastAction: 'Bateu!',
        isPaused: false,
        pausedBy: deleteField(),
        pausedAt: deleteField(),
      });
      
      // Reset all player blocks and hasDrawnThisTurn for next round
      playerDocs.forEach((playerDoc, index) => {
        if (playerDoc.exists()) {
          const playerData = playerDoc.data() as Player;
          const updates: any = { hasDrawnThisTurn: false };
          if (playerData && playerData.isBlocked) {
            updates.isBlocked = false;
          }
          transaction.update(allPlayerRefs[index].ref, updates);
        }
      });
    } else {
      // If paused by this player, check if they can go out now
      if (isPausedByMe) {
        // Check if player can go out with current hand
        const { canGoOutWithScenarios } = await import('./rules');
        const scenarioCheck = canGoOutWithScenarios(newHand, roomData.discardTop);
        
        if (scenarioCheck.canGoOut && scenarioCheck.scenario) {
          // Player can go out! Use the scenario
          const allMeldCards = scenarioCheck.scenario.melds.flatMap(m => m.cards);
          const discardCardForGoOut = scenarioCheck.scenario.discardCard || null;
          
          // Verify all cards are used
          const allCards = discardCardForGoOut ? [...allMeldCards, discardCardForGoOut] : allMeldCards;
          if (allCards.length !== newHand.length) {
            // Not all cards used, just discard normally
            const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;
            const firstPassComplete = roomData.firstPassComplete || nextTurnIndex === 0;
            
            // Reset hasDrawnThisTurn for current player (they finished their turn)
            if (currentPlayerIndex >= 0 && currentPlayerIndex < allPlayerRefs.length) {
              transaction.update(allPlayerRefs[currentPlayerIndex].ref, {
                hasDrawnThisTurn: false,
              });
            }
            
            // Reset hasDrawnThisTurn for next player (starting their turn)
            if (nextTurnIndex >= 0 && nextTurnIndex < allPlayerRefs.length) {
              transaction.update(allPlayerRefs[nextTurnIndex].ref, {
                hasDrawnThisTurn: false,
              });
            }
            
            transaction.update(roomRef, {
              discardTop: card,
              discardedBy: userId,
              turnIndex: nextTurnIndex,
              lastAction: 'Descartou uma carta',
              firstPassComplete: firstPassComplete,
              isPaused: false,
              pausedBy: deleteField(),
              pausedAt: deleteField(),
            });
          } else {
            // All cards used - player goes out!
            // This will be handled by a separate goOut call
            // For now, just discard and let the UI handle going out
            throw new Error('Você pode bater! Use o botão "Bater!" novamente.');
          }
        } else {
          // Cannot go out, just discard normally and unpause
          const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;
          const firstPassComplete = roomData.firstPassComplete || nextTurnIndex === 0;
          
          // Reset hasDrawnThisTurn for current player (they finished their turn)
          if (currentPlayerIndex >= 0 && currentPlayerIndex < allPlayerRefs.length) {
            transaction.update(allPlayerRefs[currentPlayerIndex].ref, {
              hasDrawnThisTurn: false,
            });
          }
          
          // Reset hasDrawnThisTurn for next player (starting their turn)
          if (nextTurnIndex >= 0 && nextTurnIndex < allPlayerRefs.length) {
            transaction.update(allPlayerRefs[nextTurnIndex].ref, {
              hasDrawnThisTurn: false,
            });
          }
          
          transaction.update(roomRef, {
            discardTop: card,
            discardedBy: userId,
            turnIndex: nextTurnIndex,
            lastAction: 'Descartou uma carta',
            firstPassComplete: firstPassComplete,
            isPaused: false,
            pausedBy: deleteField(),
            pausedAt: deleteField(),
          });
        }
      } else {
        // Normal turn - move to next player
        const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;
        
        // Reset hasDrawnThisTurn for current player (they finished their turn)
        if (currentPlayerIndex >= 0 && currentPlayerIndex < allPlayerRefs.length) {
          transaction.update(allPlayerRefs[currentPlayerIndex].ref, {
            hasDrawnThisTurn: false,
          });
        }
        
        // Reset hasDrawnThisTurn for next player (starting their turn)
        if (nextTurnIndex >= 0 && nextTurnIndex < allPlayerRefs.length) {
          transaction.update(allPlayerRefs[nextTurnIndex].ref, {
            hasDrawnThisTurn: false,
          });
        }
        
        // Check if first pass is complete (all players have played once)
        // When nextTurnIndex becomes 0, it means we've completed a full cycle
        const firstPassComplete = roomData.firstPassComplete || nextTurnIndex === 0;

        transaction.update(roomRef, {
          discardTop: card,
          discardedBy: userId,
          turnIndex: nextTurnIndex,
          lastAction: 'Descartou uma carta',
          firstPassComplete: firstPassComplete,
        });
      }
    }
  });
};

// Lay down melds
export const layDownMelds = async (roomId: string, melds: Meld[]): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    const isPausedByMe = roomData.isPaused && roomData.pausedBy === userId;
    if (roomData.isPaused && !isPausedByMe) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn OR player paused the game (trying to go out)
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId && !isPausedByMe) {
      throw new Error('Não é seu turno');
    }

    // Block laying down melds until all players have played at least once in current round
    // UNLESS player is trying to go out during pause
    if (!roomData.firstPassComplete && !isPausedByMe) {
      throw new Error('Não é permitido baixar combinações na primeira vez de cada jogador na rodada');
    }

    // Verify player has all cards
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    const allMeldCards = melds.flatMap(m => m.cards);
    
    // Count how many times each card appears in melds
    const meldCardCounts = new Map<string, number>();
    for (const card of allMeldCards) {
      const key = card; // Use card string as key
      meldCardCounts.set(key, (meldCardCounts.get(key) || 0) + 1);
    }
    
    // Count how many times each card appears in hand
    const handCardCounts = new Map<string, number>();
    for (const card of handData.cards) {
      const key = card;
      handCardCounts.set(key, (handCardCounts.get(key) || 0) + 1);
    }
    
    // Verify player has enough of each card
    for (const [card, neededCount] of meldCardCounts.entries()) {
      const availableCount = handCardCounts.get(card) || 0;
      if (availableCount < neededCount) {
        throw new Error('Você não tem todas essas cartas');
      }
    }

    // Remove cards from hand - remove only the specific cards used, maintaining order
    const newHand: Card[] = [];
    const usedCounts = new Map<string, number>();
    
    for (const card of handData.cards) {
      const key = card;
      const needed = meldCardCounts.get(key) || 0;
      const used = usedCounts.get(key) || 0;
      
      if (used < needed) {
        // This card is used in a meld, skip it
        usedCounts.set(key, used + 1);
      } else {
        // This card is not used (or we've already used all needed), keep it
        newHand.push(card);
      }
    }

    transaction.update(handRef, {
      cards: newHand,
    });

    // Create meld documents
    for (const meld of melds) {
      const meldRef = doc(collection(db, 'rooms', roomId, 'melds'));
      transaction.set(meldRef, {
        ownerUid: userId,
        cards: meld.cards,
        type: meld.type,
      });
    }

    // If player has no cards left after laying down melds, they go out (bater)
    if (newHand.length === 0) {
      // Read all player documents to find eligible winner
      const allPlayerRefs: Array<{ ref: any; id: string }> = [];
      for (const playerId of roomData.playerOrder) {
        allPlayerRefs.push({ ref: doc(db, 'rooms', roomId, 'players', playerId), id: playerId });
      }
      const playerDocs = await Promise.all(allPlayerRefs.map(({ ref }) => transaction.get(ref)));
      
      // Find eligible winner (player with < 100 points)
      const eligibleWinner = findEligibleWinner(
        userId,
        playerDocs.map((doc, idx) => ({ id: allPlayerRefs[idx].id, data: () => doc.data() as Player })),
        roomData.playerOrder
      );
      
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: roomData.discardTop, // No new discard, use existing
        winnerId: eligibleWinner || userId,
        lastAction: 'Bateu!',
        isPaused: false,
        pausedBy: deleteField(),
        pausedAt: deleteField(),
      });

      playerDocs.forEach((playerDoc, index) => {
        if (playerDoc.exists()) {
          const playerData = playerDoc.data() as Player;
          const updates: any = { hasDrawnThisTurn: false };
          if (playerData && playerData.isBlocked) {
            updates.isBlocked = false;
          }
          transaction.update(allPlayerRefs[index].ref, updates);
        }
      });
    } else {
      transaction.update(roomRef, {
        lastAction: 'Baixou combinações',
      });
    }
  });
};

// Add card to existing meld (layoff)
export const addCardToMeld = async (roomId: string, meldId: string, card: Card): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    // Read room data
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    if (!roomDoc.exists()) {
      throw new Error('Sala não encontrada');
    }
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    const isPausedByMe = roomData.isPaused && roomData.pausedBy === userId;
    if (roomData.isPaused && !isPausedByMe) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn OR player paused the game (trying to go out)
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId && !isPausedByMe) {
      throw new Error('Não é seu turno');
    }

    // Read hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    if (!handDoc.exists()) {
      throw new Error('Mão não encontrada');
    }
    const handData = handDoc.data() as Hand;

    // Verify player has the card
    const cardIndex = handData.cards.indexOf(card);
    if (cardIndex === -1) {
      throw new Error('Você não tem essa carta');
    }

    // Read meld
    const meldRef = doc(db, 'rooms', roomId, 'melds', meldId);
    const meldDoc = await transaction.get(meldRef);
    if (!meldDoc.exists()) {
      throw new Error('Combinação não encontrada');
    }
    const meldData = meldDoc.data() as MeldDoc;

    // Verify card can be added to meld using rules validation
    const existingMeld: Meld = {
      cards: meldData.cards,
      type: meldData.type,
    };
    
    if (!canAddCardToMeld(card, existingMeld)) {
      throw new Error('Essa carta não pode ser adicionada a essa combinação');
    }

    // Remove card from hand
    const newHand = [...handData.cards];
    newHand.splice(cardIndex, 1);

    transaction.update(handRef, {
      cards: newHand,
    });

    // Add card to meld
    transaction.update(meldRef, {
      cards: [...meldData.cards, card],
    });

    // Update last action
    transaction.update(roomRef, {
      lastAction: 'Adicionou carta à combinação',
    });

    // If player has no cards left after adding to meld, they go out (bater)
    if (newHand.length === 0) {
      // Read all player documents to find eligible winner
      const allPlayerRefs: Array<{ ref: any; id: string }> = [];
      for (const playerId of roomData.playerOrder) {
        allPlayerRefs.push({ ref: doc(db, 'rooms', roomId, 'players', playerId), id: playerId });
      }
      const playerDocs = await Promise.all(allPlayerRefs.map(({ ref }) => transaction.get(ref)));
      
      // Find eligible winner (player with < 100 points)
      const eligibleWinner = findEligibleWinner(
        userId,
        playerDocs.map((doc, idx) => ({ id: allPlayerRefs[idx].id, data: () => doc.data() as Player })),
        roomData.playerOrder
      );
      
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: roomData.discardTop,
        winnerId: eligibleWinner || userId,
        lastAction: 'Bateu!',
        isPaused: false,
        pausedBy: deleteField(),
        pausedAt: deleteField(),
      });

      playerDocs.forEach((playerDoc, index) => {
        if (playerDoc.exists()) {
          const playerData = playerDoc.data() as Player;
          const updates: any = { hasDrawnThisTurn: false };
          if (playerData && playerData.isBlocked) {
            updates.isBlocked = false;
          }
          transaction.update(allPlayerRefs[index].ref, updates);
        }
      });
    }
  });
};

// Attempt to go out (bater) - can be called out of turn during pause
// This validates and completes the go out action
export const attemptGoOut = async (
  roomId: string,
  scenario: GoOutScenario
): Promise<{ success: boolean; error?: string }> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  try {
    await runTransaction(db, async (transaction) => {
      // ALL READS FIRST - Firestore requires all reads before any writes
      const roomRef = doc(db, 'rooms', roomId);
      const roomDoc = await transaction.get(roomRef);
      const roomData = roomDoc.data() as Room;
      
      const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
      const deckDoc = await transaction.get(deckRef);
      const deckData = deckDoc.data() as DeckState;

      // Get player's hand
      const handRef = doc(db, 'rooms', roomId, 'hands', userId);
      const handDoc = await transaction.get(handRef);
      if (!handDoc.exists()) {
        throw new Error('Mão não encontrada');
      }
      const handData = handDoc.data() as Hand;

      // Get player doc (not used but kept for consistency)
      const playerRef = doc(db, 'rooms', roomId, 'players', userId);
      await transaction.get(playerRef);

      // Read all player documents (needed for resetting blocks later)
      const allPlayerRefs: Array<{ ref: any; id: string }> = [];
      const allPlayerDocs: any[] = [];
      for (const playerId of roomData.playerOrder) {
        const pRef = doc(db, 'rooms', roomId, 'players', playerId);
        allPlayerRefs.push({ ref: pRef, id: playerId });
        const pDoc = await transaction.get(pRef);
        if (pDoc.exists()) {
          allPlayerDocs.push(pDoc);
        }
      }

      // Verify game is paused by this player
      const isMyTurn = roomData.playerOrder[roomData.turnIndex] === userId;
      if (!isMyTurn && (!roomData.isPaused || roomData.pausedBy !== userId)) {
        throw new Error('Você precisa pausar o jogo primeiro clicando em "Bater!"');
      }

      // Validate scenario
      let finalHand = [...handData.cards];
      let discardCard: Card | null = null;
      let discardTopCard: Card | null = null;

      if (scenario.type === 'scenario1') {
        // Scenario 1: 2 cards + discard forms set, no discard needed
        // The discardTop card is used in the meld
        if (!roomData.discardTop) {
          throw new Error('Cenário 1 requer uma carta no descarte');
        }
        // Verify all cards are in hand or discard
        const allCards = [...scenario.melds[0].cards];
        const discardCardInMeld = allCards.find(c => c === roomData.discardTop);
        if (!discardCardInMeld) {
          throw new Error('Carta do descarte deve fazer parte da combinação');
        }
        // Remove discard card from meld cards to check hand
        const handCardsNeeded = allCards.filter(c => c !== roomData.discardTop);
        if (!handCardsNeeded.every(c => finalHand.includes(c))) {
          throw new Error('Você não tem todas as cartas necessárias');
        }
        // Remove hand cards
        finalHand = finalHand.filter(c => !handCardsNeeded.includes(c));
        discardCard = null; // No discard in scenario 1
      } else if (scenario.type === 'scenario2') {
        // Scenario 2: 2 cards + random + discard forms set, random becomes discard
        if (!roomData.discardTop || !scenario.discardCard) {
          throw new Error('Cenário 2 requer carta no descarte e carta aleatória');
        }
        const allCards = [...scenario.melds[0].cards];
        const discardCardInMeld = allCards.find(c => c === roomData.discardTop);
        if (!discardCardInMeld) {
          throw new Error('Carta do descarte deve fazer parte da combinação');
        }
        // Remove discard card from meld cards to check hand
        const handCardsNeeded = allCards.filter(c => c !== roomData.discardTop);
        if (!handCardsNeeded.every(c => finalHand.includes(c))) {
          throw new Error('Você não tem todas as cartas necessárias');
        }
        // Remove hand cards (except random card which becomes discard)
        finalHand = finalHand.filter(c => !handCardsNeeded.includes(c));
        discardCard = scenario.discardCard || null; // Random card becomes discard
      } else if (scenario.type === 'pickupDiscard') {
        // Off-turn pickup from discard to go out
        // The discard card should already be in hand (picked up when pause started)
        discardTopCard = roomData.discardTop;
        if (!discardTopCard) {
          throw new Error('Sem carta no descarte para usar ao bater');
        }

        // Verify the discard card is in hand (it was picked up when pause started)
        if (!finalHand.includes(discardTopCard)) {
          throw new Error('Carta do descarte deve estar na sua mão');
        }

        const allMeldCards = scenario.melds.flatMap(m => m.cards);
        // Certificar que a carta do descarte está sendo usada
        if (!allMeldCards.includes(discardTopCard)) {
          throw new Error('Carta do descarte deve ser usada para bater');
        }

        // Verificar multiconjunto
        const temp = [...finalHand];
        for (const c of allMeldCards) {
          const idx = temp.indexOf(c);
          if (idx === -1) throw new Error('Você não tem todas essas cartas');
          temp.splice(idx, 1);
        }

        discardCard = scenario.discardCard || null;

        // Se houver carta de descarte, ela deve estar na mão remanescente
        if (discardCard) {
          const idx = temp.indexOf(discardCard);
          if (idx === -1) {
            throw new Error('Carta de descarte não encontrada na mão');
          }
          temp.splice(idx, 1);
        }

        finalHand = temp;
      } else {
        // Normal scenario or scenario 3
        if (!scenario.discardCard) {
          throw new Error('Carta de descarte é necessária');
        }
        const allMeldCards = scenario.melds.flatMap(m => m.cards);
        const allCards = [...allMeldCards, scenario.discardCard];
        
        if (allCards.length !== handData.cards.length) {
          throw new Error('Você deve baixar todas as cartas da sua mão');
        }

        if (!allCards.every(card => handData.cards.includes(card))) {
          throw new Error('Você não tem todas essas cartas');
        }

        finalHand = [];
        discardCard = scenario.discardCard || null;
      }

      // If we get here, validation passed - player can go out
      // Clear hand
      transaction.update(handRef, {
        cards: [],
      });

      // Create meld documents
      for (const meld of scenario.melds) {
        const meldRef = doc(collection(db, 'rooms', roomId, 'melds'));
        transaction.set(meldRef, {
          ownerUid: userId,
          cards: meld.cards,
          type: meld.type,
        });
      }

      // Update deck state (for pickupDiscard scenario or adding discard card)
      if (scenario.type === 'pickupDiscard') {
        // Card was already removed from discard when pause started
        // Just add discard card if any
        if (discardCard) {
          transaction.update(deckRef, { 
            discard: [...deckData.discard, discardCard],
          });
        }
      } else if (discardCard) {
        // Add discard card to pile
        transaction.update(deckRef, {
          discard: [...deckData.discard, discardCard],
        });
      }

      // Find eligible winner (player with < 100 points)
      const eligibleWinner = findEligibleWinner(
        userId,
        allPlayerDocs.map((doc, idx) => ({ id: allPlayerRefs[idx].id, data: () => doc.data() as Player })),
        roomData.playerOrder
      );
      
      // End round
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: discardCard || roomData.discardTop,
        winnerId: eligibleWinner || userId,
        lastAction: 'Bateu!',
        isPaused: false,
        pausedBy: deleteField(),
      });

      // Reset all player blocks for next round (using already-read docs)
      allPlayerDocs.forEach((playerDoc, index) => {
        if (playerDoc.exists()) {
          const pData = playerDoc.data();
          if (pData && pData.isBlocked) {
            transaction.update(allPlayerRefs[index].ref, { isBlocked: false });
          }
        }
      });
    });

    return { success: true };
  } catch (error: any) {
    // If validation failed, just unpause the game (temporarily removed blocking)
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, 'rooms', roomId);
      const roomDoc = await transaction.get(roomRef);
      const roomData = roomDoc.data() as Room;

      // Unpause game if it was paused by this player
      if (roomData.isPaused && roomData.pausedBy === userId) {
        transaction.update(roomRef, {
          isPaused: false,
          pausedBy: deleteField(),
          pausedAt: deleteField(),
        });
      }
    });

    return { success: false, error: error.message || 'Não foi possível bater' };
  }
};

// Go out (bater) - lay down all cards and discard last one (normal turn)
export const goOut = async (
  roomId: string,
  melds: Meld[],
  discardCard: Card | null = null,
  scenario?: GoOutScenario
): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    if (roomData.isPaused && roomData.pausedBy !== userId) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Verify player has all cards
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    // Handle special scenarios
    if (scenario) {
      if (scenario.type === 'scenario1') {
        // No discard needed
        const allMeldCards = scenario.melds.flatMap(m => m.cards);
        const handCardsNeeded = allMeldCards.filter(c => c !== roomData.discardTop);
        if (!handCardsNeeded.every(c => handData.cards.includes(c))) {
          throw new Error('Você não tem todas as cartas necessárias');
        }
      } else if (scenario.type === 'scenario2') {
        // Random card becomes discard
        const allMeldCards = scenario.melds.flatMap(m => m.cards);
        const handCardsNeeded = allMeldCards.filter(c => c !== roomData.discardTop);
        if (!handCardsNeeded.every(c => handData.cards.includes(c))) {
          throw new Error('Você não tem todas as cartas necessárias');
        }
        discardCard = scenario.discardCard || null;
      }
    }

    const allMeldCards = melds.flatMap(m => m.cards);
    const allCards = discardCard ? [...allMeldCards, discardCard] : allMeldCards;
    
    if (allCards.length !== handData.cards.length && scenario?.type !== 'scenario1') {
      throw new Error('Você deve baixar todas as cartas da sua mão');
    }

    const hasAllCards = allCards.every(card => handData.cards.includes(card));
    if (!hasAllCards && scenario?.type !== 'scenario1') {
      throw new Error('Você não tem todas essas cartas');
    }

    // Clear hand
    transaction.update(handRef, {
      cards: [],
    });

    // Create meld documents
    for (const meld of melds) {
      const meldRef = doc(collection(db, 'rooms', roomId, 'melds'));
      transaction.set(meldRef, {
        ownerUid: userId,
        cards: meld.cards,
        type: meld.type,
      });
    }

    // Add discard card to pile (if any)
    if (discardCard) {
      const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
      const deckDoc = await transaction.get(deckRef);
      const deckData = deckDoc.data() as DeckState;

      transaction.update(deckRef, {
        discard: [...deckData.discard, discardCard],
      });
    }

    // Read all player documents to find eligible winner
    const allPlayerRefs: Array<{ ref: any; id: string }> = [];
    const allPlayerDocs: any[] = [];
    for (const playerId of roomData.playerOrder) {
      const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
      allPlayerRefs.push({ ref: playerRef, id: playerId });
      const playerDoc = await transaction.get(playerRef);
      if (playerDoc.exists()) {
        allPlayerDocs.push(playerDoc);
      }
    }
    
    // Find eligible winner (player with < 100 points)
    const eligibleWinner = findEligibleWinner(
      userId,
      allPlayerDocs.map((doc, idx) => ({ id: allPlayerRefs[idx].id, data: () => doc.data() as Player })),
      roomData.playerOrder
    );

    // End round
    transaction.update(roomRef, {
      status: 'roundEnd',
      discardTop: discardCard || roomData.discardTop,
      winnerId: eligibleWinner || userId,
      lastAction: 'Bateu!',
      isPaused: false,
      pausedBy: deleteField(),
    });

    // Reset all player blocks for next round
    for (const playerId of roomData.playerOrder) {
      const playerRef = doc(db, 'rooms', roomId, 'players', playerId);
      const playerDoc = await transaction.get(playerRef);
      if (playerDoc.exists()) {
        const playerData = playerDoc.data();
        if (playerData && playerData.isBlocked) {
          transaction.update(playerRef, { isBlocked: false });
        }
      }
    }
  });
};

// Leave room
export const leaveRoom = async (roomId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Remove player from playerOrder
    const newPlayerOrder = roomData.playerOrder.filter(id => id !== userId);

    // If player was owner and there are other players, transfer ownership
    if (roomData.ownerId === userId && newPlayerOrder.length > 0) {
      transaction.update(roomRef, {
        ownerId: newPlayerOrder[0],
        playerOrder: newPlayerOrder,
      });
    } else if (newPlayerOrder.length === 0) {
      // If no players left, delete room
      transaction.delete(roomRef);
    } else {
      transaction.update(roomRef, {
        playerOrder: newPlayerOrder,
      });
    }

    // Delete player document
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    transaction.delete(playerRef);

    // Delete player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    transaction.delete(handRef);
  });
};

// Subscribe to room updates
export const subscribeToRoom = (roomId: string, callback: (room: Room) => void): (() => void) => {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Room);
    }
  });
};

// Subscribe to players in a room
export const subscribeToPlayers = (roomId: string, callback: (players: Player[]) => void): (() => void) => {
  const playersRef = collection(db, 'rooms', roomId, 'players');
  return onSnapshot(playersRef, (snapshot) => {
    const players: Player[] = [];
    snapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() } as Player);
    });
    callback(players);
  });
};

// Subscribe to player's hand
export const subscribeToHand = (roomId: string, playerId: string, callback: (hand: Hand) => void): (() => void) => {
  const handRef = doc(db, 'rooms', roomId, 'hands', playerId);
  return onSnapshot(handRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as Hand);
    }
  });
};

// Subscribe to deck state
export const subscribeToDeckState = (roomId: string, callback: (deckState: DeckState) => void): (() => void) => {
  const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
  return onSnapshot(deckRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as DeckState);
    }
  });
};

// Subscribe to melds
export const subscribeToMelds = (roomId: string, callback: (melds: MeldDoc[]) => void): (() => void) => {
  const meldsRef = collection(db, 'rooms', roomId, 'melds');
  return onSnapshot(meldsRef, (snapshot) => {
    const melds: MeldDoc[] = [];
    snapshot.forEach((doc) => {
      melds.push({ id: doc.id, ...doc.data() } as MeldDoc);
    });
    callback(melds);
  });
};

// Reorder hand cards
export const reorderHand = async (roomId: string, newOrder: Card[]): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    // Read room data
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    if (!roomDoc.exists()) {
      throw new Error('Sala não encontrada');
    }
    const roomData = roomDoc.data() as Room;

    // Check if game is paused
    const isPausedByMe = roomData.isPaused && roomData.pausedBy === userId;
    if (roomData.isPaused && !isPausedByMe) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Read hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    if (!handDoc.exists()) {
      throw new Error('Mão não encontrada');
    }
    const handData = handDoc.data() as Hand;

    // Verify new order has same cards (same count and same cards)
    if (newOrder.length !== handData.cards.length) {
      throw new Error('Número de cartas não corresponde');
    }

    // Count cards in both arrays
    const handCardCounts = new Map<string, number>();
    const newOrderCardCounts = new Map<string, number>();
    
    for (const card of handData.cards) {
      handCardCounts.set(card, (handCardCounts.get(card) || 0) + 1);
    }
    
    for (const card of newOrder) {
      newOrderCardCounts.set(card, (newOrderCardCounts.get(card) || 0) + 1);
    }

    // Verify counts match
    for (const [card, count] of handCardCounts.entries()) {
      if (newOrderCardCounts.get(card) !== count) {
        throw new Error('As cartas não correspondem');
      }
    }

    // Update hand with new order
    transaction.update(handRef, {
      cards: newOrder,
    });
  });
};

// Chat functions
export const sendChatMessage = async (roomId: string, text: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  await addDoc(messagesRef, {
    uid: userId,
    name: userData.name,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
};

export const subscribeToChat = (roomId: string, callback: (messages: ChatMessage[]) => void): (() => void) => {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
    });
    callback(messages);
  });
};
