import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import { db, getCurrentUserId, getCurrentUserData } from './firebase';
import { Card, generateDoubleDeck, shuffleDeck, parseCard, getRankValue } from './deck';
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

// Generate random 6-digit room code
export const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create a new room
export const createRoom = async (): Promise<{ roomId: string; code: string }> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  const code = generateRoomCode();
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;

  const roomData: Omit<Room, 'id'> = {
    code,
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

  // Create player doc with Google data
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: userData.name,
    photoURL: userData.photoURL || undefined,
    joinedAt: serverTimestamp() as Timestamp,
    score: 0,
    isReady: true,
  };

  await setDoc(playerRef, playerData);

  return { roomId, code };
};

// Join an existing room
export const joinRoom = async (code: string): Promise<string> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  // Find room by code
  const roomsRef = collection(db, 'rooms');
  const q = query(roomsRef, where('code', '==', code));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Sala não encontrada');
  }

  const roomDoc = querySnapshot.docs[0];
  const roomId = roomDoc.id;
  const roomData = roomDoc.data() as Room;

  if (roomData.status !== 'lobby') {
    throw new Error('A sala já está em jogo');
  }

  if (roomData.playerOrder.length >= 4) {
    throw new Error('Sala está cheia (máximo 4 jogadores)');
  }

  if (roomData.playerOrder.includes(userId)) {
    // Player already in room
    return roomId;
  }

  // Add player to room
  await updateDoc(roomDoc.ref, {
    playerOrder: [...roomData.playerOrder, userId],
  });

  // Create player doc with Google data
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: userData.name,
    photoURL: userData.photoURL || undefined,
    joinedAt: serverTimestamp() as Timestamp,
    score: 0,
    isReady: false,
  };

  await setDoc(playerRef, playerData);

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

    if (roomData.status !== 'lobby') {
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

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    if (deckData.stock.length === 0) {
      throw new Error('Monte vazio');
    }

    // Draw card
    const card = deckData.stock[deckData.stock.length - 1];
    const newStock = deckData.stock.slice(0, -1);

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
      stock: newStock,
    });

    // Mark that player has drawn this turn
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    transaction.update(playerRef, {
      hasDrawnThisTurn: true,
    });

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

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    if (!roomData.discardTop) {
      throw new Error('Descarte vazio');
    }

    // Get deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    if (deckData.discard.length === 0) {
      throw new Error('Descarte vazio');
    }

    // Take top card from discard
    const card = deckData.discard[deckData.discard.length - 1];
    const newDiscard = deckData.discard.slice(0, -1);
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

    // Mark that player has drawn this turn
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    transaction.update(playerRef, {
      hasDrawnThisTurn: true,
    });

    transaction.update(roomRef, {
      discardTop: newDiscardTop,
      lastAction: 'Comprou do descarte',
    });
  });
};

// Discard a card
export const discardCard = async (roomId: string, card: Card, cardIndex?: number): Promise<void> => {
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

    // Verify player has drawn a card this turn
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    const playerDoc = await transaction.get(playerRef);
    const playerData = playerDoc.data() as Player;
    if (!playerData?.hasDrawnThisTurn) {
      throw new Error('Você precisa comprar uma carta primeiro (do monte ou do descarte)');
    }

    // Remove from player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    // Use provided index if available, otherwise find the first occurrence
    let indexToRemove: number;
    if (cardIndex !== undefined) {
      // Validate that the card at this index matches
      if (handData.cards[cardIndex] !== card) {
        throw new Error('Carta no índice especificado não corresponde');
      }
      indexToRemove = cardIndex;
    } else {
      // Find the first occurrence
      indexToRemove = handData.cards.findIndex(c => c === card);
      if (indexToRemove === -1) {
        throw new Error('Carta não está na sua mão');
      }
    }
    
    const newHand = [
      ...handData.cards.slice(0, indexToRemove),
      ...handData.cards.slice(indexToRemove + 1)
    ];

    // Validar que após descartar, o jogador deve ter 9 cartas (ou menos se baixou combinações)
    // Mas nunca mais de 9 se não baixou combinações
    if (newHand.length > 9) {
      throw new Error('Após descartar, você deve ter no máximo 9 cartas. Baixe combinações primeiro.');
    }

    // ALL READS MUST BE DONE BEFORE ANY WRITES
    // Read deck state
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    // Read all player documents that might need updates
    const allPlayerRefs: Array<{ ref: any; id: string }> = [];
    if (newHand.length === 0) {
      // If going out, need to read all players
      for (const playerId of roomData.playerOrder) {
        allPlayerRefs.push({
          ref: doc(db, 'rooms', roomId, 'players', playerId),
          id: playerId,
        });
      }
    } else {
      // If not going out, need to read current and next player
      const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;
      const nextPlayerId = roomData.playerOrder[nextTurnIndex];
      allPlayerRefs.push(
        { ref: doc(db, 'rooms', roomId, 'players', userId), id: userId },
        { ref: doc(db, 'rooms', roomId, 'players', nextPlayerId), id: nextPlayerId }
      );
    }
    
    // Read all player documents
    const playerDocs = await Promise.all(
      allPlayerRefs.map(({ ref }) => transaction.get(ref))
    );

    // NOW ALL WRITES - After all reads are complete
    transaction.update(handRef, {
      cards: newHand,
    });

    transaction.update(deckRef, {
      discard: [...deckData.discard, card],
    });

    // If player has no cards left after discarding, they go out (bater)
    if (newHand.length === 0) {
      // Reset hasDrawnThisTurn for current player (they finished their turn by going out)
      transaction.update(allPlayerRefs[0].ref, {
        hasDrawnThisTurn: false,
      });
      
      // Player goes out by discarding last card
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: card,
        winnerId: userId,
        lastAction: 'Bateu!',
        isPaused: false,
        pausedBy: deleteField(),
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
      // Move to next player
      const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;
      
      // Reset hasDrawnThisTurn for current player (they finished their turn)
      transaction.update(allPlayerRefs[0].ref, {
        hasDrawnThisTurn: false,
      });
      
      // Reset hasDrawnThisTurn for next player (starting their turn)
      transaction.update(allPlayerRefs[1].ref, {
        hasDrawnThisTurn: false,
      });
      
      // Check if first pass is complete (all players have played once)
      // When nextTurnIndex becomes 0, it means we've completed a full cycle
      const firstPassComplete = roomData.firstPassComplete || nextTurnIndex === 0;

      transaction.update(roomRef, {
        discardTop: card,
        turnIndex: nextTurnIndex,
        lastAction: 'Descartou uma carta',
        firstPassComplete: firstPassComplete,
      });
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
    if (roomData.isPaused && roomData.pausedBy !== userId) {
      throw new Error('Jogo pausado. Aguarde o jogador terminar de tentar bater.');
    }

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Block laying down melds until all players have played at least once in current round
    if (!roomData.firstPassComplete) {
      throw new Error('Não é permitido baixar combinações na primeira vez de cada jogador na rodada');
    }

    // Verify player has all cards
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    const allMeldCards = melds.flatMap(m => m.cards);
    const hasAllCards = allMeldCards.every(card => handData.cards.includes(card));

    if (!hasAllCards) {
      throw new Error('Você não tem todas essas cartas');
    }

    // Remove cards from hand
    const newHand = handData.cards.filter(card => !allMeldCards.includes(card));

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

    transaction.update(roomRef, {
      lastAction: 'Baixou combinações',
    });
  });
};

// Attempt to go out (bater) - can be called out of turn
// Returns true if successful, false if failed (player gets blocked)
export const attemptGoOut = async (
  roomId: string,
  scenario: GoOutScenario
): Promise<{ success: boolean; error?: string }> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  try {
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, 'rooms', roomId);
      const roomDoc = await transaction.get(roomRef);
      const roomData = roomDoc.data() as Room;

      // Get player's hand
      const handRef = doc(db, 'rooms', roomId, 'hands', userId);
      const handDoc = await transaction.get(handRef);
      if (!handDoc.exists()) {
        throw new Error('Mão não encontrada');
      }
      const handData = handDoc.data() as Hand;

      // Get player doc
      const playerRef = doc(db, 'rooms', roomId, 'players', userId);
      const playerDoc = await transaction.get(playerRef);
      const playerData = playerDoc.data() as Player;

      // Check if player is blocked and it's not their turn
      const isMyTurn = roomData.playerOrder[roomData.turnIndex] === userId;
      if (playerData.isBlocked && !isMyTurn) {
        throw new Error('Você está bloqueado. Só pode bater na sua vez.');
      }

      // If not player's turn, pause the game
      if (!isMyTurn && !roomData.isPaused) {
        transaction.update(roomRef, {
          isPaused: true,
          pausedBy: userId,
        });
      }

      // Validate scenario
      let finalHand = [...handData.cards];
      let discardCard: Card | null = null;

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

      // Add discard card to pile (if any)
      if (discardCard) {
        const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
        const deckDoc = await transaction.get(deckRef);
        const deckData = deckDoc.data() as DeckState;

        transaction.update(deckRef, {
          discard: [...deckData.discard, discardCard],
        });
      }

      // End round
      transaction.update(roomRef, {
        status: 'roundEnd',
        discardTop: discardCard || roomData.discardTop,
        winnerId: userId,
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

    return { success: true };
  } catch (error: any) {
    // If validation failed, block the player
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, 'rooms', roomId);
      const roomDoc = await transaction.get(roomRef);
      const roomData = roomDoc.data() as Room;

      // Check if it's not player's turn - if so, block them
      const isMyTurn = roomData.playerOrder[roomData.turnIndex] === userId;
      if (!isMyTurn) {
        const playerRef = doc(db, 'rooms', roomId, 'players', userId);
        transaction.update(playerRef, {
          isBlocked: true,
        });
      }

      // Unpause game if it was paused by this player
      if (roomData.isPaused && roomData.pausedBy === userId) {
        transaction.update(roomRef, {
          isPaused: false,
          pausedBy: deleteField(),
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

    // End round
    transaction.update(roomRef, {
      status: 'roundEnd',
      discardTop: discardCard || roomData.discardTop,
      winnerId: userId,
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
    // First, do all reads
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    
    if (!roomDoc.exists()) {
      return; // Room doesn't exist, nothing to do
    }

    const roomData = roomDoc.data() as Room;

    // Read hand doc to check if it exists
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);

    // Now do all writes
    // Remove player from playerOrder
    const newPlayerOrder = roomData.playerOrder.filter(id => id !== userId);
    
    // If player was the owner and there are other players, transfer ownership
    let newOwnerId = roomData.ownerId;
    if (roomData.ownerId === userId && newPlayerOrder.length > 0) {
      newOwnerId = newPlayerOrder[0];
    }

    // Update room
    transaction.update(roomRef, {
      playerOrder: newPlayerOrder,
      ownerId: newOwnerId,
    });

    // Delete player doc
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    transaction.delete(playerRef);

    // Delete player's hand if exists
    if (handDoc.exists()) {
      transaction.delete(handRef);
    }
  });
};

// Add card to existing meld (layoff)
export const addCardToMeld = async (roomId: string, meldId: string, card: Card): Promise<void> => {
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

    // Verify rules allow layoff
    if (!roomData.rules.allowLayoff) {
      throw new Error('Adicionar cartas às combinações não está permitido');
    }

    // Get player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    if (!handData.cards.includes(card)) {
      throw new Error('Carta não está na sua mão');
    }

    // Get meld
    const meldRef = doc(db, 'rooms', roomId, 'melds', meldId);
    const meldDoc = await transaction.get(meldRef);
    
    if (!meldDoc.exists()) {
      throw new Error('Combinação não encontrada');
    }

    const meldData = meldDoc.data() as MeldDoc;
    
    // Validate card can be added
    const meld: Meld = {
      type: meldData.type,
      cards: meldData.cards,
    };
    
    if (!canAddCardToMeld(card, meld)) {
      throw new Error('Esta carta não pode ser adicionada a esta combinação');
    }

    // Remove card from hand
    const newHand = handData.cards.filter(c => c !== card);

    // Add card to meld
    const updatedMeldCards = [...meldData.cards, card];
    
    // Sort meld cards if it's a sequence
    if (meldData.type === 'sequence') {
      updatedMeldCards.sort((a, b) => {
        const cardA = parseCard(a);
        const cardB = parseCard(b);
        return getRankValue(cardA.rank) - getRankValue(cardB.rank);
      });
    }

    transaction.update(handRef, {
      cards: newHand,
    });

    transaction.update(meldRef, {
      cards: updatedMeldCards,
    });

    transaction.update(roomRef, {
      lastAction: 'Adicionou carta a uma combinação',
    });
  });
};

// Reorder cards in hand
export const reorderHand = async (roomId: string, newCardOrder: Card[]): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    // Verify all cards are present
    if (newCardOrder.length !== handData.cards.length) {
      throw new Error('Número de cartas não corresponde');
    }

    const hasAllCards = newCardOrder.every(card => handData.cards.includes(card));
    if (!hasAllCards) {
      throw new Error('Cartas inválidas');
    }

    // Update hand with new order
    transaction.update(handRef, {
      cards: newCardOrder,
    });
  });
};

// Subscribe to room updates
export const subscribeToRoom = (roomId: string, callback: (room: Room) => void) => {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Room);
    }
  });
};

// Subscribe to players
export const subscribeToPlayers = (roomId: string, callback: (players: Player[]) => void) => {
  const playersRef = collection(db, 'rooms', roomId, 'players');
  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
    callback(players);
  });
};

// Subscribe to player's hand
export const subscribeToHand = (roomId: string, playerId: string, callback: (hand: Hand) => void) => {
  const handRef = doc(db, 'rooms', roomId, 'hands', playerId);
  return onSnapshot(handRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Hand);
    }
  });
};

// Subscribe to melds
export const subscribeToMelds = (roomId: string, callback: (melds: MeldDoc[]) => void) => {
  const meldsRef = collection(db, 'rooms', roomId, 'melds');
  return onSnapshot(meldsRef, (snapshot) => {
    const melds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeldDoc));
    callback(melds);
  });
};

// Subscribe to deck state
export const subscribeToDeckState = (roomId: string, callback: (deck: DeckState) => void) => {
  const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
  return onSnapshot(deckRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as DeckState);
    }
  });
};

// Chat interfaces and functions
export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: Timestamp;
}

// Send a chat message
export const sendChatMessage = async (roomId: string, text: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const userData = getCurrentUserData();
  if (!userData) throw new Error('User data not available');

  if (!text.trim()) {
    throw new Error('Mensagem não pode estar vazia');
  }

  const chatRef = doc(collection(db, 'rooms', roomId, 'chat'));
  await setDoc(chatRef, {
    uid: userId,
    name: userData.name,
    text: text.trim(),
    createdAt: serverTimestamp() as Timestamp,
  });
};

// Subscribe to chat messages
export const subscribeToChat = (roomId: string, callback: (messages: ChatMessage[]) => void) => {
  const chatRef = collection(db, 'rooms', roomId, 'chat');
  const q = query(chatRef);
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage))
      .sort((a, b) => {
        // Sort by timestamp
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      });
    callback(messages);
  });
};
