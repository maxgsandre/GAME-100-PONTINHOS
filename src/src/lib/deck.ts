// Card representation: 2-character string
// First char: rank (A,2-9,T=10,J,Q,K)
// Second char: suit (H=♥ Hearts, D=♦ Diamonds, C=♣ Clubs, S=♠ Spades)

export type Card = string; // e.g., "AH", "TD", "9C", "KS"
export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K';

export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

export const SUIT_COLORS: Record<Suit, 'red' | 'black'> = {
  H: 'red',
  D: 'red',
  C: 'black',
  S: 'black',
};

// Generate a single deck (52 cards)
export const generateSingleDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
};

// Generate double deck (104 cards for the game)
export const generateDoubleDeck = (): Card[] => {
  return [...generateSingleDeck(), ...generateSingleDeck()];
};

// Fisher-Yates shuffle algorithm
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Parse card
export const parseCard = (card: Card): { rank: Rank; suit: Suit } => {
  return {
    rank: card[0] as Rank,
    suit: card[1] as Suit,
  };
};

// Get card display value
export const getCardDisplay = (card: Card): string => {
  const { rank, suit } = parseCard(card);
  const rankDisplay = rank === 'T' ? '10' : rank;
  return `${rankDisplay}${SUIT_SYMBOLS[suit]}`;
};

// Get card color
export const getCardColor = (card: Card): 'red' | 'black' => {
  const { suit } = parseCard(card);
  return SUIT_COLORS[suit];
};

// Get rank value for sorting
export const getRankValue = (rank: Rank): number => {
  const values: Record<Rank, number> = {
    'A': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    'T': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
  };
  return values[rank];
};

// Sort cards in hand (by suit, then rank)
export const sortCards = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => {
    const { rank: rankA, suit: suitA } = parseCard(a);
    const { rank: rankB, suit: suitB } = parseCard(b);
    
    // Sort by suit first
    if (suitA !== suitB) {
      return SUITS.indexOf(suitA) - SUITS.indexOf(suitB);
    }
    
    // Then by rank
    return getRankValue(rankA) - getRankValue(rankB);
  });
};
