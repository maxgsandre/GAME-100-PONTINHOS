import { Card, parseCard, getRankValue, Rank, Suit } from './deck';

export interface GameRules {
  aceValue: number; // 11 or 15
  allowLayoff: boolean; // Allow adding cards to other players' melds
}

export const DEFAULT_RULES: GameRules = {
  aceValue: 15,
  allowLayoff: true, // Permitir adicionar cartas às combinações de outros jogadores
};

// Meld types
export type MeldType = 'sequence' | 'set';

export interface Meld {
  type: MeldType;
  cards: Card[];
}

// Check if cards form a valid sequence (3+ cards, same suit, consecutive ranks)
export const isValidSequence = (cards: Card[]): boolean => {
  if (cards.length < 3) return false;
  
  // Parse all cards first
  const parsed = cards.map(parseCard);
  const suit = parsed[0].suit;
  
  // All cards must be same suit
  if (!parsed.every(c => c.suit === suit)) return false;
  
  // Helper to verify consecutiveness given a rank-to-number mapper
  const isConsecutive = (ranks: Rank[], mapper: (r: Rank) => number) => {
    // Sort values to check consecutiveness (order of input doesn't matter)
    const sortedValues = [...ranks].map(mapper).sort((a, b) => a - b);
    // Remove duplicates for checking consecutiveness
    const uniqueValues = Array.from(new Set(sortedValues));
    for (let i = 1; i < uniqueValues.length; i++) {
      if (uniqueValues[i] !== uniqueValues[i - 1] + 1) return false;
    }
    return true;
  };

  // Get ranks from parsed cards (order doesn't matter, we'll sort the values)
  const ranks = parsed.map((c) => c.rank);

  // Ace as low (A,2,3...) OR Ace as high (Q,K,A)
  const aceHighMapper = (r: Rank) => (r === 'A' ? 14 : getRankValue(r));

  // Check both ace low and ace high sequences (order of cards doesn't matter)
  const validLow = isConsecutive(ranks, getRankValue);
  const validHigh = isConsecutive(ranks, aceHighMapper);

  return validLow || validHigh;
};

// Check if cards form a valid set/trinca (3+ cards, same rank, different suits)
// IMPORTANT: For sets, we allow duplicate suits (e.g., 4 Ases with 2 of same suit is valid)
// The rule is: same rank, and at least 3 cards with different suits OR at least 3 cards total
export const isValidSet = (cards: Card[]): boolean => {
  if (cards.length < 3) return false;
  
  const parsed = cards.map(parseCard);
  const rank = parsed[0].rank;
  
  // All cards must be same rank
  if (!parsed.every(c => c.rank === rank)) return false;
  
  // For sets: we need at least 3 cards with different suits
  // But we allow duplicates (e.g., 4 Ases: A♥, A♦, A♣, A♠ is valid, or A♥, A♦, A♣, A♥ is also valid)
  const uniqueSuits = new Set(parsed.map(c => c.suit));
  // At least 3 different suits OR at least 3 cards total (allowing duplicates)
  return uniqueSuits.size >= 3 || cards.length >= 3;
};

// Validate a meld (order of cards doesn't matter)
export const isValidMeld = (cards: Card[]): { valid: boolean; type?: MeldType } => {
  // Make a copy to avoid mutating the original array
  const cardsCopy = [...cards];
  
  // Try sequence first
  if (isValidSequence(cardsCopy)) {
    return { valid: true, type: 'sequence' };
  }
  
  // Then try set
  if (isValidSet(cardsCopy)) {
    return { valid: true, type: 'set' };
  }
  
  return { valid: false };
};

// Find the best valid meld from selected cards, allowing expansion
// This function finds a base meld (at least 3 cards) and includes all cards that can expand it
export const findExpandableMeld = (cards: Card[]): { valid: boolean; type?: MeldType; cards: Card[] } => {
  if (cards.length < 3) {
    return { valid: false, cards: [] };
  }

  // Try to find a base sequence (at least 3 cards)
  const bySuit: Record<Suit, Card[]> = { H: [], D: [], C: [], S: [] };
  cards.forEach(card => {
    const { suit } = parseCard(card);
    bySuit[suit].push(card);
  });

  // Try sequences first
  for (const suit in bySuit) {
    const suitCards = bySuit[suit as Suit];
    if (suitCards.length < 3) continue;
    
    // Sort by rank value
    const sorted = suitCards.sort((a, b) => {
      const rankA = getRankValue(parseCard(a).rank);
      const rankB = getRankValue(parseCard(b).rank);
      return rankA - rankB;
    });
    
    // Try to find a base sequence of 3+ cards
    for (let start = 0; start <= sorted.length - 3; start++) {
      for (let end = start + 3; end <= sorted.length; end++) {
        const baseSequence = sorted.slice(start, end);
        if (isValidSequence(baseSequence)) {
          // Found a valid base sequence, check if all remaining cards in this suit can be added
          const remaining = sorted.filter((_, idx) => idx < start || idx >= end);
          const canAddAll = remaining.every(card => {
            return isValidSequence([...baseSequence, card]);
          });
          
          if (canAddAll || remaining.length === 0) {
            // All cards in this suit form a valid expanded sequence
            return { valid: true, type: 'sequence', cards: suitCards };
          }
        }
      }
    }
  }

  // Try sets (same rank)
  const byRank: Record<Rank, Card[]> = {
    'A': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [],
    'T': [], 'J': [], 'Q': [], 'K': []
  };
  
  cards.forEach(card => {
    const { rank } = parseCard(card);
    byRank[rank].push(card);
  });

  for (const rank in byRank) {
    const rankCards = byRank[rank as Rank];
    if (rankCards.length >= 3) {
      // All cards of the same rank can form a set (even if some suits are duplicated)
      if (isValidSet(rankCards)) {
        return { valid: true, type: 'set', cards: rankCards };
      }
    }
  }

  return { valid: false, cards: [] };
};

// Calculate points for a card
export const getCardPoints = (card: Card, rules: GameRules = DEFAULT_RULES): number => {
  const { rank } = parseCard(card);
  
  if (rank === 'A') return rules.aceValue;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  if (rank === 'T') return 10;
  
  return parseInt(rank);
};

// Calculate total points for a hand
export const calculateHandPoints = (cards: Card[], rules: GameRules = DEFAULT_RULES): number => {
  return cards.reduce((total, card) => total + getCardPoints(card, rules), 0);
};

// Group cards by potential melds (helper for UI)
export const suggestMelds = (cards: Card[]): Meld[] => {
  const melds: Meld[] = [];
  const used = new Set<Card>();
  
  // Try to find sequences
  const bySuit: Record<Suit, Card[]> = { H: [], D: [], C: [], S: [] };
  cards.forEach(card => {
    const { suit } = parseCard(card);
    bySuit[suit].push(card);
  });

  for (const suit in bySuit) {
    const suitCards = bySuit[suit as Suit];
    if (suitCards.length < 3) continue;
    
    // Sort by rank
    const sorted = suitCards.sort((a, b) => {
      const rankA = getRankValue(parseCard(a).rank);
      const rankB = getRankValue(parseCard(b).rank);
      return rankA - rankB;
    });
    
    // Find consecutive sequences
    let sequence: Card[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prevRank = getRankValue(parseCard(sorted[i - 1]).rank);
      const currRank = getRankValue(parseCard(sorted[i]).rank);
      
      if (currRank === prevRank + 1 || (parseCard(sorted[i]).rank === 'A' && parseCard(sorted[i - 1]).rank === 'K')) {
        sequence.push(sorted[i]);
      } else {
        if (sequence.length >= 3 && isValidSequence(sequence)) {
          melds.push({ type: 'sequence', cards: [...sequence] });
          sequence.forEach(c => used.add(c));
        }
        sequence = [sorted[i]];
      }
    }
    
    if (sequence.length >= 3 && isValidSequence(sequence)) {
      melds.push({ type: 'sequence', cards: [...sequence] });
      sequence.forEach(c => used.add(c));
    }
  }
  
  // Try to find sets (same rank, different suits)
  const byRank: Record<Rank, Card[]> = {
    'A': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [],
    'T': [], 'J': [], 'Q': [], 'K': []
  };
  
  cards.filter(c => !used.has(c)).forEach(card => {
    const { rank } = parseCard(card);
    byRank[rank].push(card);
  });

  for (const rank in byRank) {
    const rankCards = byRank[rank as Rank];
    if (rankCards.length >= 3 && isValidSet(rankCards)) {
      melds.push({ type: 'set', cards: rankCards });
    }
  }
  
  return melds;
};

// Check if player can go out (has valid melds for all cards except one to discard)
export const canGoOut = (cards: Card[], melds: Meld[]): boolean => {
  // Player needs to have at least one card to discard
  if (cards.length === 0) return false;
  
  // Calculate total cards in melds
  const meldedCards = melds.reduce((total, meld) => total + meld.cards.length, 0);
  
  // Player can go out if they have melds covering all cards except 1
  return meldedCards === cards.length - 1;
};

// Check if player can go out by adding cards to existing melds (layoff)
export const canGoOutWithLayoff = (hand: Card[], existingMelds: Meld[]): boolean => {
  if (hand.length === 0) return false;
  
  // If player has only 1 card, they can go out by discarding it (after adding all others to melds)
  if (hand.length === 1) return true;
  
  // Try to see if we can add cards to existing melds and have exactly 1 card left
  // For each card in hand, check if it can be added to any existing meld
  const cardsThatCanBeAdded: Card[] = [];
  
  for (const card of hand) {
    for (const meld of existingMelds) {
      if (canAddCardToMeld(card, meld)) {
        cardsThatCanBeAdded.push(card);
        break; // Card can be added to at least one meld
      }
    }
  }
  
  // If we can add (hand.length - 1) cards to melds, we can go out (1 card left to discard)
  return cardsThatCanBeAdded.length >= hand.length - 1;
};

// Validate multiple melds don't overlap and cover all cards
export const validateMultipleMelds = (cards: Card[], melds: Meld[]): { valid: boolean; error?: string } => {
  if (melds.length === 0) {
    return { valid: false, error: 'Nenhuma combinação fornecida' };
  }

  // Check all melds are valid
  for (const meld of melds) {
    const validation = isValidMeld(meld.cards);
    if (!validation.valid) {
      return { valid: false, error: 'Uma ou mais combinações são inválidas' };
    }
  }

  // Check for overlapping cards - count occurrences
  const allMeldCards: Card[] = [];
  for (const meld of melds) {
    for (const card of meld.cards) {
      allMeldCards.push(card);
    }
  }
  
  // Count how many times each card appears in melds vs in hand
  const meldCardCounts = new Map<string, number>();
  for (const card of allMeldCards) {
    const key = card;
    meldCardCounts.set(key, (meldCardCounts.get(key) || 0) + 1);
  }
  
  const handCardCounts = new Map<string, number>();
  for (const card of cards) {
    const key = card;
    handCardCounts.set(key, (handCardCounts.get(key) || 0) + 1);
  }
  
  // Check if hand has enough of each card
  for (const [card, neededCount] of meldCardCounts.entries()) {
    const availableCount = handCardCounts.get(card) || 0;
    if (availableCount < neededCount) {
      return { valid: false, error: 'Carta não está na sua mão ou não há cartas suficientes' };
    }
  }

  return { valid: true };
};

// Find all possible melds from a set of cards (helper for UI)
export const findAllMelds = (cards: Card[]): Meld[] => {
  const allMelds: Meld[] = [];

  // Try sequences first (they're usually longer)
  const bySuit: Record<Suit, Card[]> = { H: [], D: [], C: [], S: [] };
  cards.forEach(card => {
    const { suit } = parseCard(card);
    bySuit[suit].push(card);
  });

  for (const suit in bySuit) {
    const suitCards = bySuit[suit as Suit];
    if (suitCards.length < 3) continue;
    
    const sorted = suitCards.sort((a, b) => {
      const rankA = getRankValue(parseCard(a).rank);
      const rankB = getRankValue(parseCard(b).rank);
      return rankA - rankB;
    });
    
    // Find all possible sequences
    for (let start = 0; start < sorted.length - 2; start++) {
      for (let end = start + 3; end <= sorted.length; end++) {
        const sequence = sorted.slice(start, end);
        if (isValidSequence(sequence)) {
          allMelds.push({ type: 'sequence', cards: [...sequence] });
        }
      }
    }
  }

  // Try sets
  const byRank: Record<Rank, Card[]> = {
    'A': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [],
    'T': [], 'J': [], 'Q': [], 'K': []
  };
  
  cards.forEach(card => {
    const { rank } = parseCard(card);
    byRank[rank].push(card);
  });

  for (const rank in byRank) {
    const rankCards = byRank[rank as Rank];
    if (rankCards.length >= 3) {
      // Generate all combinations of 3+ cards
      for (let i = 3; i <= rankCards.length; i++) {
        // For sets, we allow duplicate suits (e.g., 4 Ases with 2 of same suit)
        if (isValidSet(rankCards)) {
          allMelds.push({ type: 'set', cards: [...rankCards] });
          break; // Only add the full set once
        }
      }
    }
  }

  return allMelds;
};

// Check if a card can be added to an existing meld (layoff)
export const canAddCardToMeld = (card: Card, meld: Meld): boolean => {
  const { rank: cardRank, suit: cardSuit } = parseCard(card);
  const meldCards = meld.cards.map(parseCard);

  if (meld.type === 'sequence') {
    // For sequences: card must be same suit and IMMEDIATELY consecutive (no gaps)
    // Check if can be added at the beginning or end ONLY
    const sorted = [...meldCards].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
    
    // All cards must be same suit
    if (sorted[0].suit !== cardSuit) return false;
    
    const firstRank = getRankValue(sorted[0].rank);
    const lastRank = getRankValue(sorted[sorted.length - 1].rank);
    const cardRankValue = getRankValue(cardRank);
    
    // Check if can be added at the beginning (immediately before first card)
    if (cardRankValue === firstRank - 1) return true;
    
    // Check if can be added at the end (immediately after last card)
    if (cardRankValue === lastRank + 1) return true;
    
    // Special case: Ace can be high (Q, K, A) or low (A, 2, 3)
    // If sequence ends with K, can add A
    if (cardRank === 'A' && sorted[sorted.length - 1].rank === 'K') return true;
    // If sequence starts with A, can add 2 (A is value 1, 2 is value 2)
    if (sorted[0].rank === 'A' && cardRankValue === 2) return true;
    
    // Cannot add if there's a gap (e.g., sequence is A♦ 2♦ 3♦, cannot add 5♦ without 4♦)
    return false;
  } else {
    // For sets/trincas: card must have same rank (can be same suit, that's allowed)
    // All cards of the same rank can be added, regardless of suit
    return meldCards[0].rank === cardRank;
  }
};

// Check if player can go out with special scenarios (for going out out of turn)
export interface GoOutScenario {
  type: 'normal' | 'scenario1' | 'scenario2' | 'scenario3' | 'pickupDiscard';
  melds: Meld[];
  discardCard?: Card; // Card to discard (undefined for scenario 1)
  randomCard?: Card; // Random card that becomes discard (scenario 2)
  usesDiscardTop?: boolean; // True if scenario uses the discard top card
}

export const canGoOutWithScenarios = (
  hand: Card[],
  discardTop: Card | null
): { canGoOut: boolean; scenario?: GoOutScenario; error?: string } => {
  if (hand.length === 0) {
    return { canGoOut: false, error: 'Mão vazia' };
  }

  // Scenario 1: 2 cards of same rank + discarded card forms set (no discard needed)
  if (hand.length === 2 && discardTop) {
    const handParsed = hand.map(parseCard);
    const discardParsed = parseCard(discardTop);
    
    // Check if 2 hand cards have same rank
    if (handParsed[0].rank === handParsed[1].rank) {
      // Check if discard card has same rank (forms trinca)
      if (discardParsed.rank === handParsed[0].rank) {
        const setCards = [...hand, discardTop];
        if (isValidSet(setCards)) {
          return {
            canGoOut: true,
            scenario: {
              type: 'scenario1',
              melds: [{ type: 'set', cards: setCards }],
            },
          };
        }
      }
    }
  }

  // Scenario 2: 2 cards of same rank + 1 random card + discarded card forms set (random becomes discard)
  if (hand.length === 3 && discardTop) {
    const handParsed = hand.map(parseCard);
    const discardParsed = parseCard(discardTop);
    
    // Find 2 cards with same rank
    for (let i = 0; i < handParsed.length; i++) {
      for (let j = i + 1; j < handParsed.length; j++) {
        if (handParsed[i].rank === handParsed[j].rank) {
          // Check if discard has same rank
          if (discardParsed.rank === handParsed[i].rank) {
            // The third card (not i or j) becomes the discard
            const randomCard = hand.find((_, idx) => idx !== i && idx !== j)!;
            const setCards = [hand[i], hand[j], discardTop];
            if (isValidSet(setCards)) {
              return {
                canGoOut: true,
                scenario: {
                  type: 'scenario2',
                  melds: [{ type: 'set', cards: setCards }],
                  discardCard: randomCard,
                  randomCard,
                },
              };
            }
          }
        }
      }
    }
  }

  // Scenario 3: 1 card in hand (all others in melds) - can only go out if drawn card completes a meld
  // This scenario is handled differently - it requires the player to have drawn a card
  // and that card can be added to an existing meld. This is checked in the attemptGoOut function.

  // Normal scenario: Try to find valid melds for all cards except one
  if (hand.length >= 4) {
    // Try all combinations: select all cards except one, try to form melds
    for (let discardIdx = 0; discardIdx < hand.length; discardIdx++) {
      const discardCard = hand[discardIdx];
      const cardsForMelds = hand.filter((_, idx) => idx !== discardIdx);
      
      // Try to find valid melds
      const allPossibleMelds = findAllMelds(cardsForMelds);
      
      // Try to find a combination that uses all cards
      const used = new Set<Card>();
      const foundMelds: Meld[] = [];
      
      const sortedMelds = allPossibleMelds.sort((a, b) => b.cards.length - a.cards.length);
      
      for (const meld of sortedMelds) {
        if (meld.cards.every(card => !used.has(card))) {
          foundMelds.push(meld);
          meld.cards.forEach(card => used.add(card));
        }
      }
      
      // Check if we used all cards
      if (used.size === cardsForMelds.length) {
        const validation = validateMultipleMelds(cardsForMelds, foundMelds);
        if (validation.valid) {
          return {
            canGoOut: true,
            scenario: {
              type: 'normal',
              melds: foundMelds,
              discardCard,
            },
          };
        }
      }
    }
  }

  // Also check if all cards can form melds (0 cards to discard - only valid in scenario 1, but check here too)
  if (hand.length >= 3) {
    const allPossibleMelds = findAllMelds(hand);
    const used = new Set<Card>();
    const foundMelds: Meld[] = [];
    const sortedMelds = allPossibleMelds.sort((a, b) => b.cards.length - a.cards.length);
    for (const meld of sortedMelds) {
      if (meld.cards.every(card => !used.has(card))) {
        foundMelds.push(meld);
        meld.cards.forEach(card => used.add(card));
      }
    }
    if (used.size === hand.length) {
      const validation = validateMultipleMelds(hand, foundMelds);
      if (validation.valid) {
        return {
          canGoOut: true,
          scenario: {
            type: 'normal',
            melds: foundMelds,
          },
        };
      }
    }
  }

  // Off-turn: pickup discardTop to go out (must use discardTop in melds)
  if (discardTop) {
    const merged = [...hand, discardTop];
    for (let discardIdx = -1; discardIdx < merged.length; discardIdx++) {
      const discardCard = discardIdx >= 0 ? merged[discardIdx] : null;
      const cardsForMelds = merged.filter((_, idx) => idx !== discardIdx);
      if (!cardsForMelds.includes(discardTop)) continue;

      const allMelds = findAllMelds(cardsForMelds);
      const used = new Set<Card>();
      const found: Meld[] = [];
      const sorted = allMelds.sort((a, b) => b.cards.length - a.cards.length);
      for (const meld of sorted) {
        if (meld.cards.every(c => !used.has(c))) {
          found.push(meld);
          meld.cards.forEach(c => used.add(c));
        }
      }
      if (used.size === cardsForMelds.length) {
        const validation = validateMultipleMelds(cardsForMelds, found);
        if (validation.valid) {
          return {
            canGoOut: true,
            scenario: {
              type: 'pickupDiscard',
              melds: found,
              discardCard: discardCard || undefined,
              usesDiscardTop: true,
            },
          };
        }
      }
    }
  }

  return { canGoOut: false, error: 'Não foi possível bater com essas cartas' };
};
