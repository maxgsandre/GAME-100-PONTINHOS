import { Card, parseCard, getRankValue, Rank, Suit } from './deck';

export interface GameRules {
  aceValue: number; // 11 or 15
  allowLayoff: boolean; // Allow adding cards to other players' melds
}

export const DEFAULT_RULES: GameRules = {
  aceValue: 15,
  allowLayoff: false,
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
  
  const parsed = cards.map(parseCard);
  const suit = parsed[0].suit;
  
  // All cards must be same suit
  if (!parsed.every(c => c.suit === suit)) return false;
  
  // Sort by rank value
  const sorted = [...parsed].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
  
  // Check if consecutive (handle Ace as 1 or 14)
  for (let i = 1; i < sorted.length; i++) {
    const prevValue = getRankValue(sorted[i - 1].rank);
    const currValue = getRankValue(sorted[i].rank);
    
    // Check if consecutive
    if (currValue !== prevValue + 1) {
      // Special case: Ace can be high (Q, K, A)
      if (sorted[i].rank === 'A' && sorted[i - 1].rank === 'K') {
        continue;
      }
      return false;
    }
  }
  
  return true;
};

// Check if cards form a valid set/trinca (3+ cards, same rank, different suits)
export const isValidSet = (cards: Card[]): boolean => {
  if (cards.length < 3) return false;
  
  const parsed = cards.map(parseCard);
  const rank = parsed[0].rank;
  
  // All cards must be same rank
  if (!parsed.every(c => c.rank === rank)) return false;
  
  // All cards must have different suits
  const suits = new Set(parsed.map(c => c.suit));
  if (suits.size !== parsed.length) return false;
  
  return true;
};

// Validate a meld
export const isValidMeld = (cards: Card[]): { valid: boolean; type?: MeldType } => {
  if (isValidSequence(cards)) {
    return { valid: true, type: 'sequence' };
  }
  
  if (isValidSet(cards)) {
    return { valid: true, type: 'set' };
  }
  
  return { valid: false };
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

  // Check for overlapping cards
  const allMeldCards: Card[] = [];
  for (const meld of melds) {
    for (const card of meld.cards) {
      if (allMeldCards.includes(card)) {
        return { valid: false, error: 'Cartas duplicadas entre combinações' };
      }
      allMeldCards.push(card);
    }
  }

  // Check all meld cards are in hand
  for (const card of allMeldCards) {
    if (!cards.includes(card)) {
      return { valid: false, error: 'Carta não está na sua mão' };
    }
  }

  return { valid: true };
};

// Find all possible melds from a set of cards (helper for UI)
export const findAllMelds = (cards: Card[]): Meld[] => {
  const allMelds: Meld[] = [];
  const used = new Set<Card>();

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
        // Simple: just check if all suits are different
        const suits = new Set(rankCards.map(c => parseCard(c).suit));
        if (suits.size === rankCards.length && isValidSet(rankCards)) {
          allMelds.push({ type: 'set', cards: [...rankCards] });
        }
      }
    }
  }

  return allMelds;
};
