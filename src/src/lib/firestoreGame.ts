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
} from 'firebase/firestore';
import { db, getCurrentUserId } from './firebase';
import { Card, generateDoubleDeck, shuffleDeck, parseCard, getRankValue } from './deck';
import { GameRules, DEFAULT_RULES, Meld, canAddCardToMeld } from './rules';

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
}

export interface Player {
  id: string;
  name: string;
  joinedAt: Timestamp;
  score: number;
  isReady: boolean;
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
export const createRoom = async (playerName: string): Promise<{ roomId: string; code: string }> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

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

  // Create player doc
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: playerName,
    joinedAt: serverTimestamp() as Timestamp,
    score: 0,
    isReady: true,
  };

  await setDoc(playerRef, playerData);

  return { roomId, code };
};

// Join an existing room
export const joinRoom = async (code: string, playerName: string): Promise<string> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

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

  // Create player doc
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  const playerData: Omit<Player, 'id'> = {
    name: playerName,
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

    // Update room
    transaction.update(roomRef, {
      status: 'playing',
      round: 1,
      turnIndex: 0,
      discardTop: firstDiscard,
      lastAction: 'Jogo iniciado',
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

    transaction.update(roomRef, {
      discardTop: newDiscardTop,
      lastAction: 'Comprou do descarte',
    });
  });
};

// Discard a card
export const discardCard = async (roomId: string, card: Card): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Remove from player's hand
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    if (!handData.cards.includes(card)) {
      throw new Error('Carta não está na sua mão');
    }

    const newHand = handData.cards.filter(c => c !== card);

    // Validar que após descartar, o jogador deve ter 9 cartas (ou menos se baixou combinações)
    // Mas nunca mais de 9 se não baixou combinações
    if (newHand.length > 9) {
      throw new Error('Após descartar, você deve ter no máximo 9 cartas. Baixe combinações primeiro.');
    }

    // Add to discard pile
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    transaction.update(handRef, {
      cards: newHand,
    });

    transaction.update(deckRef, {
      discard: [...deckData.discard, card],
    });

    // Move to next player
    const nextTurnIndex = (roomData.turnIndex + 1) % roomData.playerOrder.length;

    transaction.update(roomRef, {
      discardTop: card,
      turnIndex: nextTurnIndex,
      lastAction: 'Descartou uma carta',
    });
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

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Block laying down melds in first round
    if (roomData.round === 1) {
      throw new Error('Não é permitido baixar combinações na primeira rodada');
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

// Go out (bater) - lay down all cards and discard last one
export const goOut = async (roomId: string, melds: Meld[], discardCard: Card): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await transaction.get(roomRef);
    const roomData = roomDoc.data() as Room;

    // Verify it's player's turn
    const currentPlayerId = roomData.playerOrder[roomData.turnIndex];
    if (currentPlayerId !== userId) {
      throw new Error('Não é seu turno');
    }

    // Verify player has all cards
    const handRef = doc(db, 'rooms', roomId, 'hands', userId);
    const handDoc = await transaction.get(handRef);
    const handData = handDoc.data() as Hand;

    const allMeldCards = melds.flatMap(m => m.cards);
    const allCards = [...allMeldCards, discardCard];
    
    if (allCards.length !== handData.cards.length) {
      throw new Error('Você deve baixar todas as cartas da sua mão');
    }

    const hasAllCards = allCards.every(card => handData.cards.includes(card));
    if (!hasAllCards) {
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

    // Add discard card to pile
    const deckRef = doc(db, 'rooms', roomId, 'state', 'deck');
    const deckDoc = await transaction.get(deckRef);
    const deckData = deckDoc.data() as DeckState;

    transaction.update(deckRef, {
      discard: [...deckData.discard, discardCard],
    });

    // End round
    transaction.update(roomRef, {
      status: 'roundEnd',
      discardTop: discardCard,
      winnerId: userId,
      lastAction: 'Bateu!',
    });
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
export const sendChatMessage = async (roomId: string, text: string, playerName: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  if (!text.trim()) {
    throw new Error('Mensagem não pode estar vazia');
  }

  const chatRef = doc(collection(db, 'rooms', roomId, 'chat'));
  await setDoc(chatRef, {
    uid: userId,
    name: playerName,
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
