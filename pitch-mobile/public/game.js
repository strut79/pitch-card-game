export const PLAYER_COUNT = 4;
export const CARDS_DEALT = 7;
export const FINAL_HAND_SIZE = 6;
export const WIDOW_SIZE = 7;
export const WINNING_SCORE = 21;

// --- Card Data and Logic ---
export const suits = ["Clubs", "Diamonds", "Hearts", "Spades"];
export const values = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "Jack",
  "Queen",
  "King",
  "Ace",
];
export const cardSymbols = {
  Clubs: "♣️",
  Diamonds: "♦️",
  Hearts: "♥️",
  Spades: "♠️",
};

export const getSuitColor = (suit) =>
  suit === "Diamonds" || suit === "Hearts" ? "red" : "black";

export const isTrumpCard = (card, trumpSuit) => {
  if (!card || !trumpSuit) return false;
  const isTrumpSuit = card.suit === trumpSuit;
  const isOffJack =
    card.value === "Jack" &&
    card.suit !== trumpSuit &&
    card.suit &&
    getSuitColor(card.suit) === getSuitColor(trumpSuit);
  return isTrumpSuit || isOffJack || card.value === "Joker";
};

export const isProtectedCard = (card, trumpSuit) => {
  if (!card || !trumpSuit) return false;
  return (
    isTrumpCard(card, trumpSuit) &&
    (card.value === "Jack" || card.value === "Joker")
  );
};

export const getEffectiveSuit = (card, trumpSuit) => {
  return isTrumpCard(card, trumpSuit) ? trumpSuit : card.suit;
};

export const getCardRank = (card, trumpSuit) => {
  if (!card) return -1;
  const isJoker = card.value === "Joker";
  const isTrump = isTrumpCard(card, trumpSuit);
  const trumpRanks = {
    Ace: 18,
    King: 17,
    Queen: 16,
    Jack: 15,
    "Off-Jack": 14,
    "High-Joker": 13,
    "Low-Joker": 12,
    10: 11,
    9: 10,
    8: 9,
    7: 8,
    6: 7,
    5: 6,
    4: 5,
    3: 4,
    2: 3,
  };
  const standardRanks = {
    Ace: 14,
    King: 13,
    Queen: 12,
    Jack: 11,
    10: 10,
    9: 9,
    8: 8,
    7: 7,
    6: 6,
    5: 5,
    4: 4,
    3: 3,
    2: 2,
  };
  if (isJoker)
    return card.color === "red"
      ? trumpRanks["High-Joker"]
      : trumpRanks["Low-Joker"];
  if (isTrump) {
    if (card.suit === trumpSuit) return trumpRanks[card.value] || 0;
    if (card.value === "Jack") return trumpRanks["Off-Jack"];
  }
  return standardRanks[card.value] || 0;
};

export const getCardPointValue = (card) => {
  if (!card) return 0;
  switch (card.value) {
    case "Ace":
      return 4;
    case "King":
      return 3;
    case "Queen":
      return 2;
    case "Jack":
      return 1;
    case "10":
      return 10;
    default:
      return 0;
  }
};

export const createDeck = () => {
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        id: `${value}-${suit}`,
        value,
        suit,
        color: getSuitColor(suit),
      });
    }
  }
  deck.push({ id: "Joker-red", value: "Joker", suit: null, color: "red" });
  deck.push({ id: "Joker-black", value: "Joker", suit: null, color: "black" });
  return shuffle(deck);
};

export const shuffle = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

export const dealCards = (gameData) => {
  const deck = createDeck();
  gameData.players.forEach((player) => {
    player.hand = [];
    player.originalHand = [];
  });

  for (let i = 0; i < CARDS_DEALT * PLAYER_COUNT; i++) {
    const playerIndex = (gameData.dealerIndex + 1 + i) % PLAYER_COUNT;
    const card = deck.pop();
    card.originalOwner = gameData.players[playerIndex].id;
    gameData.players[playerIndex].hand.push(card);
    gameData.players[playerIndex].originalHand.push(card);
  }

  gameData.widow = deck.splice(0, WIDOW_SIZE);
  gameData.deck = deck;
};

export const createNewGame = (user) => {
  const players = [
    {
      id: user.uid,
      name: user.displayName || "Player 1",
      isOnline: true,
      team: null,
    },
  ];

  return {
    players,
    deck: [],
    widow: [],
    teams: [
      {
        id: "team1",
        players: [],
        score: 0,
        roundPoints: 0,
        cardsWon: [],
        pointCards: [],
      },
      {
        id: "team2",
        players: [],
        score: 0,
        roundPoints: 0,
        cardsWon: [],
        pointCards: [],
      },
    ],
    phase: "lobby",
    hostId: user.uid,
    turnIndex: 0,
    dealerIndex: -1,
    highBid: 0,
    highBidderIndex: -1,
    bidsMade: 0,
    trumpSuit: null,
    currentTrick: [],
    trickLeadPlayerIndex: -1,
    tricksPlayed: 0,
  };
};
