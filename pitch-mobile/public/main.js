// --- IMPORTS ---
// Import auth and db INSTANCES from our local file
import { auth, db } from "./firebase.js";

// Import auth METHODS from the Firebase CDN
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Import Firestore METHODS from the Firebase CDN
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Import our other local modules
import {
  createGame as fbCreateGame,
  onGameUpdate as fbOnGameUpdate,
  updateGame as fbUpdateGame,
} from "./firestore.js";

import {
  PLAYER_COUNT,
  CARDS_DEALT,
  FINAL_HAND_SIZE,
  WIDOW_SIZE,
  WINNING_SCORE,
  suits,
  isTrumpCard,
  isProtectedCard,
  getEffectiveSuit,
  getSuitColor,
  getCardRank,
  getCardPointValue,
  createDeck,
  createNewGame,
  dealCards,
} from "./game.js";

import {
  initUI,
  showMessage,
  hideMessage,
  displayActionMessage,
  clearAllActionMessages,
  renderHand,
  renderWidow,
  renderPlayerBids,
  renderPlayerStatus,
  renderTrick,
  renderBidButtons,
  renderTrumpSelection,
  displayTrickWinner,
  displayRoundResults,
  updatePointDrawers,
  updateUI,
  showGameOver,
  hideGameOver,
  isRoundSummaryVisible,
  showAuthContainer,
  hideAuthContainer,
  showLobby,
  hideLobby,
  showGame,
  hideGame,
  hideRoundSummary,
} from "./ui.js";
import { initLobby, renderLobby } from "./lobby.js";

// --- LOCAL TEST TOGGLE ---
const USE_FIREBASE = true;
console.log("main.js executed");

// --- MOCK FUNCTIONS (for local testing) ---
let mockGameData = {};
let mockGameUpdateCallback = () => {};
const mockCreateGame = async (gameData) => {
  console.log("MOCK: createGame");
  mockGameData = { ...gameData };
  mockGameData.id = "local-game";
  return "local-game";
};
const mockOnGameUpdate = (gameId, callback) => {
  console.log("MOCK: onGameUpdate (storing callback)");
  mockGameUpdateCallback = callback;
  setTimeout(() => mockGameUpdateCallback(mockGameData), 0);
  return () => {
    mockGameUpdateCallback = () => {};
  };
};
const mockUpdateGame = async (gameId, partialGameData) => {
  console.log("MOCK: updateGame (merging data and triggering callback)");
  mockGameData = { ...mockGameData, ...partialGameData };
  setTimeout(() => mockGameUpdateCallback(mockGameData), 0);
};
const mockLogin = async (handler) => {
  console.log("MOCK: login");
  const mockUser = {
    uid: "local-user-uid",
    displayName: "Local Player",
  };
  handler(mockUser);
};

// --- REAL FUNCTIONS (to be used based on toggle) ---
const realCreateGame = fbCreateGame;
const realOnGameUpdate = fbOnGameUpdate;
const realUpdateGame = fbUpdateGame;

const handleGoogleLogin = async () => {
  if (USE_FIREBASE) {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      showMessage("Error logging in with Google. Please try again.", 3000);
      console.error("Google sign-in error", error);
    }
  } else {
    mockLogin(handleAuthChange);
  }
};
const handleAnonymousLogin = async () => {
  if (USE_FIREBASE) {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      showMessage("Error signing in as guest. Please try again.", 3000);
      console.error("Anonymous sign-in error", error);
    }
  } else {
    mockLogin(handleAuthChange);
  }
};

// --- DYNAMICALLY SET FUNCTIONS ---
const createGame = USE_FIREBASE ? realCreateGame : mockCreateGame;
const onGameUpdate = USE_FIREBASE ? realOnGameUpdate : mockOnGameUpdate;
const updateGame = USE_FIREBASE ? realUpdateGame : mockUpdateGame;

// --- Game State ---
let gameData = {}; // Holds the entire game state
let oldPhase = ""; // Track previous phase
let isMakingMove = false; // Prevents multiple actions at once
let selectedDiscards = []; // Cards the player has selected to discard
let uiHelpers;
let currentUser = null;
let gameId = null;
let unsubscribeFromGame = () => {}; // To store the onSnapshot unsub function

// --- Auth ---
// FIX: Made handleAuthChange async to support awaiting createGame
async function handleAuthChange(user) {
  console.log("handleAuthChange called");
  if (user) {
    console.log("User is logged in:", user);
    currentUser = user;
    hideAuthContainer();
    const urlParams = new URLSearchParams(window.location.search);
    const urlGameId = urlParams.get("game");
    console.log("urlGameId:", urlGameId);

    if (urlGameId && USE_FIREBASE) {
      console.log("Joining game...");
      joinGame(urlGameId); // This flow is fine
    } else {
      console.log("No game in URL, creating/showing lobby.");
      const newLobbyData = createNewGame(currentUser);
      
      if (USE_FIREBASE) {
        // --- FIX: This is the new, robust flow ---
        try {
          // 1. Create the game in Firestore *immediately*
          console.log("Creating new game in Firestore...");
          const newGameId = await createGame(newLobbyData);
          gameId = newGameId; // Set module-level gameId
          
          // 2. Update the URL (so refresh works)
          window.history.replaceState(null, null, `?game=${newGameId}`);
          
          // 3. Show lobby and init with the *real* gameId
          showLobby();
          initLobby(newGameId, currentUser, createNewGame, createGame, updateGame);
          
          // 4. Subscribe to the new game
          unsubscribeFromGame = onGameUpdate(newGameId, handleStateChanges);
          
          // 5. Render the lobby (will be quickly replaced by the first snapshot)
          renderLobby(newLobbyData, currentUser);

        } catch (error) {
            console.error("Failed to create game:", error);
            showMessage("Error creating game. Please refresh.", 5000);
        }
        // --- End of FIX ---
      } else {
        // This is the local mode, which was working
        mockGameData = newLobbyData;
        gameId = "local-game";
        initLobby(gameId, currentUser, createNewGame, createGame, updateGame);
        unsubscribeFromGame = mockOnGameUpdate(gameId, handleStateChanges);
      }
    }
  } else {
    console.log("User is not logged in.");
    currentUser = null;
    showAuthContainer();
    hideLobby();
    hideGame();
    hideGameOver();
  }
}

// --- Game Logic: Core ---

const joinGame = async (id) => {
  if (!USE_FIREBASE) return; 

  gameId = id;

  const gameRef = doc(db, "games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    console.error("Game not found!");
    window.history.replaceState(null, null, window.location.pathname);
    const newLobbyData = createNewGame(currentUser);
    showLobby();
    initLobby(null, currentUser, createNewGame, createGame, updateGame);
    renderLobby(newLobbyData, currentUser);
    return;
  }
  const existingGameData = gameSnap.data();

  const playerExists = existingGameData.players.some(
    (p) => p.id === currentUser.uid
  );
  if (!playerExists && existingGameData.phase === "lobby") {
    const newPlayer = {
      id: currentUser.uid,
      name:
        currentUser.displayName ||
        "Player " + (existingGameData.players.length + 1),
      isOnline: true,
      team: null,
    };
    existingGameData.players.push(newPlayer);
    await updateGame(gameId, { players: existingGameData.players });
  }

  initLobby(gameId, currentUser, createNewGame, createGame, updateGame);
  unsubscribeFromGame = onGameUpdate(gameId, handleStateChanges);
};

// This is for the "Reset All" button. It performs a real signOut.
const resetGame = async () => {
  console.log("Resetting game (signing out)...");
  if (unsubscribeFromGame) unsubscribeFromGame();
  
  await signOut(auth);
  
  gameData = {};
  oldPhase = "";
  isMakingMove = false;
  selectedDiscards = [];
  gameId = null;
};

// This is the logic for the "Play Again" button
const handlePlayAgain = () => {
    if (gameData.hostId !== currentUser.uid) {
        showMessage("Waiting for host to start a new game...");
        return;
    }
    
    console.log("Host is resetting game to lobby...");

    // Just reset the game object to a clean lobby state.
    const players = gameData.players.map(p => ({
        id: p.id,
        name: p.name,
        isOnline: p.id === currentUser.uid,
        isAI: p.isAI,
        team: null
    }));

    const resetData = {
        phase: "lobby",
        players: players,
        hostId: gameData.hostId, // Keep the same host
        teams: [
            { id: "team1", players: [], score: 0, roundPoints: 0, cardsWon: [], pointCards: [], cardValue: 0 },
            { id: "team2", players: [], score: 0, roundPoints: 0, cardsWon: [], pointCards: [], cardValue: 0 }
        ],
        deck: [],
        widow: [],
        turnIndex: 0,
        dealerIndex: -1,
        highBid: 0,
        highBidderIndex: -1,
        bidsMade: 0,
        trumpSuit: null,
        currentTrick: [],
        trickLeadPlayerIndex: -1,
        tricksPlayed: 0,
        lastRoundResults: null
    };
    
    hideGameOver();
    hideRoundSummary();
    
    updateGame(gameId, resetData);
};

const startNewRound = () => {
  if (gameData.hostId !== currentUser.uid) return;
  hideRoundSummary();

  const newDealerIndex = (gameData.dealerIndex + 1) % PLAYER_COUNT;

  gameData.players.forEach((player) => {
    player.bid = 0;
    player.hasBid = false;
  });

  dealCards(gameData);

  gameData.teams.forEach((team) => {
    team.roundPoints = 0;
    team.cardsWon = [];
    team.pointCards = [];
    team.cardValue = 0;
  });

  gameData.phase = "bidding";
  gameData.dealerIndex = newDealerIndex;
  gameData.turnIndex = (newDealerIndex + 1) % PLAYER_COUNT;
  gameData.highBid = 0;
  gameData.highBidderIndex = -1;
  gameData.bidsMade = 0;
  gameData.trumpSuit = null;
  gameData.currentTrick = [];
  gameData.tricksPlayed = 0;
  gameData.lastRoundResults = null;

  updateGame(gameId, gameData);
};

const checkTrickWinner = () => {
  const trick = gameData.currentTrick;
  if (!trick || trick.length < PLAYER_COUNT) return;

  const leadCard = trick[0];
  const trumpSuit = gameData.trumpSuit;
  const leadSuit = getEffectiveSuit(leadCard, trumpSuit);

  let winningCard = leadCard;
  let winningPlayerIndex = gameData.trickLeadPlayerIndex;

  for (let i = 1; i < trick.length; i++) {
    const currentCard = trick[i];
    const winningSuit = getEffectiveSuit(winningCard, trumpSuit);
    const currentSuit = getEffectiveSuit(currentCard, trumpSuit);

    if (winningSuit === trumpSuit) {
      if (
        currentSuit === trumpSuit &&
        getCardRank(currentCard, trumpSuit) >
          getCardRank(winningCard, trumpSuit)
      ) {
        winningCard = currentCard;
        winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
      }
    } else {
      if (currentSuit === trumpSuit) {
        winningCard = currentCard;
        winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
      } else if (
        currentSuit === leadSuit &&
        getCardRank(currentCard, trumpSuit) >
          getCardRank(winningCard, trumpSuit)
      ) {
        winningCard = currentCard;
        winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
      }
    }
  }

  const winner = gameData.players[winningPlayerIndex];
  displayTrickWinner(winner.name);

  const winnerTeam = gameData.teams.find((t) => t.players.includes(winner.id));

  setTimeout(() => {
    if (winnerTeam) {
      winnerTeam.cardsWon.push(...trick);

      let roundPointsWonThisTrick = 0;
      let cardValueWonThisTrick = 0;
      const trumpSuit = gameData.trumpSuit;

      trick.forEach((card) => {
        cardValueWonThisTrick += getCardPointValue(card);

        const isJack = card.value === "Jack" && card.suit === trumpSuit;
        const isOffJack =
          card.value === "Jack" &&
          card.suit !== trumpSuit &&
          getSuitColor(card.suit) === getSuitColor(trumpSuit);
        const isJoker = card.value === "Joker";

        if (isJack || isOffJack || isJoker) {
          if (!winnerTeam.pointCards.some((pc) => pc.id === card.id)) {
            winnerTeam.pointCards.push(card);
            roundPointsWonThisTrick++;
          }
        }
      });

      winnerTeam.roundPoints += roundPointsWonThisTrick;
      winnerTeam.cardValue += cardValueWonThisTrick;
    }

    gameData.currentTrick = [];
    gameData.turnIndex = winningPlayerIndex;
    gameData.tricksPlayed++;

    if (gameData.tricksPlayed === FINAL_HAND_SIZE) {
      gameData.phase = "scoring";
    }
    updateGame(gameId, gameData);
  }, 2000);
};

const calculateTeamPoints = () => {
  const { trumpSuit, teams, highBid, players, highBidderIndex } = gameData;
  const bidder = players[highBidderIndex];
  const biddingTeam = teams.find((t) => t.players.includes(bidder.id));
  const otherTeam = teams.find((t) => !t.players.includes(bidder.id));

  teams.forEach((t) => {
    t.pointCards.forEach((c) => {
      c.isHigh = false;
      c.isLow = false;
    });
  });

  const cardValueTotals = {
    [biddingTeam.id]: biddingTeam.cardValue,
    [otherTeam.id]: otherTeam.cardValue,
  };

  const allCardsPlayed = [...teams[0].cardsWon, ...teams[1].cardsWon];
  const allTrumpsPlayed = allCardsPlayed
    .filter((c) => isTrumpCard(c, trumpSuit))
    .sort((a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit));

  let highTrump, lowTrump;
  if (allTrumpsPlayed.length > 0) {
    highTrump = allTrumpsPlayed[allTrumpsPlayed.length - 1];
    lowTrump = allTrumpsPlayed[0];
  }

  const pointCardDefinitions = [
    { name: "High", card: highTrump },
    { name: "Low", card: lowTrump },
  ];

  pointCardDefinitions.forEach(({ name, card }) => {
    if (!card) return;

    let teamToAward;
    if (name === "Low") {
      const playerWhoPlayedLow = players.find((p) => p.id === card.player);
      teamToAward = playerWhoPlayedLow
        ? teams.find((t) => t.players.includes(playerWhoPlayedLow.id))
        : null;
    } else {
      teamToAward = biddingTeam.cardsWon.some((c) => c.id === card.id)
        ? biddingTeam
        : otherTeam.cardsWon.some((c) => c.id === card.id)
        ? otherTeam
        : null;
    }

    if (teamToAward) {
      teamToAward.roundPoints++;
      let cardInArray = teamToAward.pointCards.find((c) => c.id === card.id);
      if (cardInArray) {
        if (name === "High") cardInArray.isHigh = true;
        if (name === "Low") cardInArray.isLow = true;
      } else {
        const cardForDisplay = { ...card };
        if (name === "High") cardForDisplay.isHigh = true;
        if (name === "Low") cardForDisplay.isLow = true;
        teamToAward.pointCards.push(cardForDisplay);
      }
    }
  });

  if (cardValueTotals[biddingTeam.id] > cardValueTotals[otherTeam.id]) {
    biddingTeam.roundPoints++;
  } else if (cardValueTotals[otherTeam.id] > cardValueTotals[biddingTeam.id]) {
    otherTeam.roundPoints++;
  }

  if (biddingTeam.roundPoints < highBid) {
    biddingTeam.roundPoints = -highBid;
  }

  return {
    team1: {
      total: teams[0].roundPoints,
      pointCards: teams[0].pointCards,
      cardValue: cardValueTotals[teams[0].id] || 0,
    },
    team2: {
      total: teams[1].roundPoints,
      pointCards: teams[1].pointCards,
      cardValue: cardValueTotals[teams[1].id] || 0,
    },
  };
};

// --- Game Logic: Actions ---
const handleBid = (bidValue) => {
  if (isMakingMove) return;
  isMakingMove = true;
  const player = gameData.players[gameData.turnIndex];
  player.hasBid = true;
  player.bid = bidValue;
  gameData.bidsMade++;
  if (bidValue !== "pass" && bidValue > gameData.highBid) {
    gameData.highBid = bidValue;
    gameData.highBidderIndex = gameData.turnIndex;
  }
  gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
  updateGame(gameId, gameData).finally(() => {
    isMakingMove = false;
  });
};

const handleTrumpSelection = (suit) => {
  if (isMakingMove) return;
  isMakingMove = true;
  gameData.trumpSuit = suit;

  gameData.phase = "discarding";
  gameData.turnIndex = 0; 
  gameData.discardsMade = 0;
  gameData.players.forEach((p) => (p.hasDiscarded = false));
  updateGame(gameId, gameData).finally(() => {
    isMakingMove = false;
  });
};

const toggleDiscardSelection = (card) => {
  if (isProtectedCard(card, gameData.trumpSuit)) {
    showMessage(
      `<span classtext-red-400">Cannot discard protected cards.</span>`,
      2000
    );
    return;
  }
  const index = selectedDiscards.findIndex((c) => c.id === card.id);
  if (index > -1) {
    selectedDiscards.splice(index, 1);
  } else {
    selectedDiscards.push(card);
  }

  updateUI(
    gameData,
    selectedDiscards,
    handleCardClick,
    uiHelpers.createCardElement,
    handleBid,
    currentUser
  );
};

const handleDiscard = () => {
  if (isMakingMove) return;
  const player = gameData.players[gameData.turnIndex];
  if (!player || player.id !== currentUser.uid) return;

  isMakingMove = true;

  const isBidder = gameData.players[gameData.highBidderIndex].id === player.id;
  const minDiscards = isBidder
    ? player.hand.length - FINAL_HAND_SIZE
    : CARDS_DEALT - FINAL_HAND_SIZE;

  if (selectedDiscards.length < minDiscards) {
    showMessage(
      `You must select at least ${minDiscards} cards to discard.`,
      2000
    );
    isMakingMove = false;
    return;
  }

  player.hand = player.hand.filter(
    (card) => !selectedDiscards.some((d) => d.id === card.id)
  );

  const cardsToDraw = Math.max(0, FINAL_HAND_SIZE - player.hand.length);
  if (cardsToDraw > 0 && gameData.deck.length > 0) {
    const newCards = gameData.deck.splice(0, cardsToDraw);
    newCards.forEach((c) => (c.originalOwner = player.id));
    player.hand.push(...newCards);
  }

  selectedDiscards = [];
  gameData.discardsMade++;
  gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;

  updateGame(gameId, {
    players: gameData.players,
    deck: gameData.deck,
    turnIndex: gameData.turnIndex,
    discardsMade: gameData.discardsMade,
  }).finally(() => {
    isMakingMove = false;
  });
};

const handleCardPlay = (card) => {
  if (isMakingMove) return;

  const player = gameData.players[gameData.turnIndex];
  if (player.id !== currentUser.uid) return;

  isMakingMove = true;

  const leadCard =
    gameData.currentTrick.length > 0 ? gameData.currentTrick[0] : null;
  const leadSuit = leadCard
    ? getEffectiveSuit(leadCard, gameData.trumpSuit)
    : null;
  if (leadSuit) {
    const playedSuit = getEffectiveSuit(card, gameData.trumpSuit);
    if (
      playedSuit !== leadSuit &&
      player.hand.some(
        (c) => getEffectiveSuit(c, gameData.trumpSuit) === leadSuit
      )
    ) {
      showMessage(`You must follow suit (${leadSuit})`, 2000);
      isMakingMove = false;
      return;
    }
  }

  player.hand = player.hand.filter((c) => c.id !== card.id);
  card.player = player.id;
  gameData.currentTrick.push(card);
  if (gameData.currentTrick.length === 1) {
    gameData.trickLeadPlayerIndex = gameData.turnIndex;
  }
  gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
  updateGame(gameId, gameData).finally(() => {
    isMakingMove = false;
  });
};

const handleCardClick = (card) => {
  if (gameData.phase === "playing") {
    handleCardPlay(card);
  } else if (gameData.phase === "discarding") {
    toggleDiscardSelection(card);
  }
};

const aiAction = () => {
  const player = gameData.players[gameData.turnIndex];
  if (!player || !player.isAI) return;

  setTimeout(() => {
    if (gameData.phase === "bidding") {
      const evaluateHandForSuit = (hand, trumpSuit) => {
        let score = 0;
        hand.forEach((card) => {
          if (isTrumpCard(card, trumpSuit)) {
            if (card.value === "Joker") score += 4;
            else if (card.value === "Jack") score += 3.5;
            else if (card.value === "Ace" || card.value === "King") score += 2;
            else if (card.value === "2" || card.value === "3") score += 0.5;
            else score += 1;
          }
        });
        hand.forEach((card) => {
          if (card.value === "Ace" && !isTrumpCard(card, trumpSuit)) {
            score += 1.5;
          }
        });
        return score;
      };

      let bestSuit = null;
      let maxScore = 0;
      suits.forEach((suit) => {
        const score = evaluateHandForSuit(player.hand, suit);
        if (score > maxScore) {
          maxScore = score;
          bestSuit = suit;
        }
      });

      let determinedBid = "pass";
      if (maxScore > 12) determinedBid = 6;
      else if (maxScore > 10) determinedBid = 5;
      else if (maxScore > 8) determinedBid = 4;

      const minBid = 4;
      const minAllowed = gameData.highBid > 0 ? gameData.highBid + 1 : minBid;
      if (determinedBid !== "pass" && determinedBid < minAllowed) {
        determinedBid = "pass";
      }

      handleBid(determinedBid);
    } else if (gameData.phase === "trumpSelection") {
      const evaluateHandForSuit = (hand, trumpSuit) => {
        let score = 0;
        hand.forEach((card) => {
          if (isTrumpCard(card, trumpSuit)) {
            if (card.value === "Joker") score += 4;
            else if (card.value === "Jack") score += 3.5;
            else if (card.value === "Ace" || card.value === "King") score += 2;
            else if (card.value === "2" || card.value === "3") score += 0.5;
            else score += 1;
          }
        });
        hand.forEach((card) => {
          if (card.value === "Ace" && !isTrumpCard(card, trumpSuit)) {
            score += 1.5;
          }
        });
        return score;
      };

      let bestSuit = "Spades";
      let maxScore = -1;
      suits.forEach((suit) => {
        const score = evaluateHandForSuit(player.hand, suit);
        if (score > maxScore) {
          maxScore = score;
          bestSuit = suit;
        }
      });

      handleTrumpSelection(bestSuit);
    } else if (gameData.phase === "discarding") {
      const aiPlayer = player;
      const trumpSuit = gameData.trumpSuit;
      const isBidder =
        gameData.players[gameData.highBidderIndex].id === aiPlayer.id;
      const numberToDiscard = isBidder
        ? aiPlayer.hand.length - FINAL_HAND_SIZE
        : CARDS_DEALT - FINAL_HAND_SIZE;

      const sortedHand = [...aiPlayer.hand].sort((a, b) => {
        const aValue =
          (isTrumpCard(a, trumpSuit) ? 100 : 0) +
          getCardRank(a, trumpSuit) +
          (a.value === "Ace" && !isTrumpCard(a, trumpSuit) ? 15 : 0);
        const bValue =
          (isTrumpCard(b, trumpSuit) ? 100 : 0) +
          getCardRank(b, trumpSuit) +
          (b.value === "Ace" && !isTrumpCard(b, trumpSuit) ? 15 : 0);
        return aValue - bValue;
      });

      let toDiscard = [];
      for (const card of sortedHand) {
        if (
          toDiscard.length < numberToDiscard &&
          !isProtectedCard(card, trumpSuit)
        ) {
          toDiscard.push(card);
        }
      }

      if (toDiscard.length < numberToDiscard) {
        for (const card of sortedHand) {
          if (
            toDiscard.length < numberToDiscard &&
            !toDiscard.some((c) => c.id === card.id)
          ) {
            toDiscard.push(card);
          }
        }
      }

      aiPlayer.hand = aiPlayer.hand.filter(
        (c) => !toDiscard.some((d) => d.id === c.id)
      );

      const cardsToDraw = Math.max(0, FINAL_HAND_SIZE - aiPlayer.hand.length);
      if (cardsToDraw > 0 && gameData.deck.length > 0) {
        const newCards = gameData.deck.splice(0, cardsToDraw);
        newCards.forEach((c) => (c.originalOwner = aiPlayer.id));
        aiPlayer.hand.push(...newCards);
      }

      gameData.discardsMade++;
      gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;

      updateGame(gameId, {
        players: gameData.players,
        deck: gameData.deck,
        turnIndex: gameData.turnIndex,
        discardsMade: gameData.discardsMade,
      });
    } else if (gameData.phase === "playing") {
      const trumpSuit = gameData.trumpSuit;
      const leadCard =
        gameData.currentTrick.length > 0 ? gameData.currentTrick[0] : null;
      const leadSuit = leadCard ? getEffectiveSuit(leadCard, trumpSuit) : null;

      let legalPlays = player.hand;
      if (leadSuit) {
        const followingSuit = player.hand.filter(
          (c) => getEffectiveSuit(c, trumpSuit) === leadSuit
        );
        if (followingSuit.length > 0) legalPlays = followingSuit;
      }

      if (legalPlays.length === 0) {
        legalPlays = player.hand;
      }

      let cardToPlay;
      if (!leadCard) {
        const sortedPlays = [...legalPlays].sort((a, b) => {
          const aValue =
            (isTrumpCard(a, trumpSuit) ? 100 : 0) + getCardRank(a, trumpSuit);
          const bValue =
            (isTrumpCard(b, trumpSuit) ? 100 : 0) + getCardRank(b, trumpSuit);
          return bValue - aValue;
        });
        cardToPlay = sortedPlays[0];
      } else {
        const winningCardInTrick = gameData.currentTrick.reduce(
          (best, current) => {
            const effectiveBestSuit = getEffectiveSuit(best, trumpSuit);
            const effectiveCurrentSuit = getEffectiveSuit(current, trumpSuit);
            if (effectiveCurrentSuit === effectiveBestSuit) {
              return getCardRank(current, trumpSuit) >
                getCardRank(best, trumpSuit)
                ? current
                : best;
            }
            return effectiveCurrentSuit === trumpSuit ? current : best;
          },
          gameData.currentTrick[0]
        );

        const winningRank = getCardRank(winningCardInTrick, trumpSuit);
        const canWinCards = legalPlays.filter(
          (c) =>
            (getEffectiveSuit(c, trumpSuit) ===
              getEffectiveSuit(winningCardInTrick, trumpSuit) &&
              getCardRank(c, trumpSuit) > winningRank) ||
            (getEffectiveSuit(c, trumpSuit) === trumpSuit &&
              getEffectiveSuit(winningCardInTrick, trumpSuit) !== trumpSuit)
        );

        if (canWinCards.length > 0) {
          cardToPlay = canWinCards.sort(
            (a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit)
          )[0];
        } else {
          cardToPlay = legalPlays.sort(
            (a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit)
          )[0];
        }
      }

      if (!cardToPlay) {
        console.error(`AI Error: No card chosen. Legal plays:`, legalPlays);
        cardToPlay = legalPlays[0];
      }

      const cardIndex = player.hand.findIndex((c) => c.id === cardToPlay.id);
      player.hand.splice(cardIndex, 1);

      cardToPlay.player = player.id;
      gameData.currentTrick.push(cardToPlay);
      if (gameData.currentTrick.length === 1) {
        gameData.trickLeadPlayerIndex = gameData.turnIndex;
      }
      gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
      updateGame(gameId, gameData);
    }
  }, 1000 + Math.random() * 500);
};

// --- State Machine ---
const handleStateChanges = (newGameData) => {
  console.log(
    `handleStateChanges: oldPhase=${oldPhase}, newPhase=${newGameData.phase}`
  );
  gameData = newGameData;

  if (!gameData || !gameData.phase) {
    return;
  }

  // --- UI Switching ---
  if (gameData.phase === "lobby") {
    if (oldPhase !== "lobby") {
      console.log("State Change: Entering Lobby");
      hideGame();
      hideGameOver();
      hideRoundSummary();
      showLobby();
    }
    renderLobby(gameData, currentUser);
  } else if (oldPhase === "lobby" && gameData.phase !== "lobby") {
    console.log("State Change: Exiting Lobby, Entering Game");
    hideLobby();
    showGame();
    if (!uiHelpers) {
      uiHelpers = initUI(
        handleCardClick,
        handleBid,
        handleTrumpSelection,
        handleDiscard,
        startNewRound,
        currentUser
      );
    }
  }

  // --- In-Game UI Updates ---
  if (gameData.phase !== "lobby") {
    if (!uiHelpers) {
      uiHelpers = initUI(
        handleCardClick,
        handleBid,
        handleTrumpSelection,
        handleDiscard,
        startNewRound,
        currentUser
      );
    }

    updateUI(
      gameData,
      selectedDiscards,
      handleCardClick,
      uiHelpers.createCardElement,
      handleBid,
      currentUser
    );
    updatePointDrawers(gameData, uiHelpers.createCardElement, currentUser);
  }

  const currentPlayer = gameData.players[gameData.turnIndex];
  const isPlayerTurn = currentPlayer && currentPlayer.id === currentUser.uid;

  const playerIndex = gameData.players.findIndex(
    (p) => p.id === currentUser.uid
  );
  if (playerIndex === -1 && gameData.phase !== "lobby") {
    console.warn("Current user not found in players array.");
    return;
  }
  const reorderedPlayers = [
    ...gameData.players.slice(playerIndex),
    ...gameData.players.slice(0, playerIndex),
  ];

  clearAllActionMessages();

  switch (gameData.phase) {
    case "bidding":
      isMakingMove = false;
      if (gameData.bidsMade === PLAYER_COUNT) {
        if (gameData.highBidderIndex === -1) {
          showMessage("All players passed. Redealing...", 2000);
          if (currentUser.uid === gameData.hostId) {
            setTimeout(startNewRound, 2000);
          }
        } else {
          gameData.phase = "widowPickup";
          gameData.turnIndex = gameData.highBidderIndex;
          if (currentUser.uid === gameData.hostId) {
            updateGame(gameId, gameData);
          }
        }
        break;
      }

      showMessage(`${currentPlayer.name}'s turn to bid.`);
      
      const reorderedBiddingIndex = reorderedPlayers.findIndex((p) => p.id === currentPlayer.id);
      if (reorderedBiddingIndex !== -1) {
          displayActionMessage(reorderedBiddingIndex, "Turn to bid");
      }

      if (isPlayerTurn) {
        renderBidButtons(gameData.highBid, handleBid);
      } else if (currentPlayer.isAI) {
        aiAction();
      }
      break;

    case "widowPickup":
      const bidderForWidow = gameData.players[gameData.highBidderIndex];
      showMessage(`${bidderForWidow.name} takes the widow...`, 1500);
      if (currentUser.uid === gameData.hostId) {
        setTimeout(() => {
          bidderForWidow.originalHand.push(...gameData.widow);
          bidderForWidow.hand.push(...gameData.widow);
          gameData.widow = [];
          gameData.phase = "trumpSelection";
          updateGame(gameId, gameData);
        }, 1500);
      }
      break;

    case "trumpSelection":
      const bidder = gameData.players[gameData.highBidderIndex];
      const reorderedBidderIndex = reorderedPlayers.findIndex((p) => p.id === bidder.id);
      
      if (reorderedBidderIndex !== -1) {
          displayActionMessage(reorderedBidderIndex, "Choosing trump...");
      } else {
          showMessage(`${bidder.name} is choosing trump...`);
      }
      
      if (bidder.id === currentUser.uid) {
        isMakingMove = false;
        renderTrumpSelection(handleTrumpSelection);
      } else if (bidder.isAI) {
        aiAction();
      }
      break;

    case "discarding":
      if (gameData.discardsMade === PLAYER_COUNT) {
        if (currentUser.uid === gameData.hostId) {
          let countdown = 3;
          showMessage(`Play starts in ${countdown}...`);
          const intervalId = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
              clearInterval(intervalId);
              clearAllActionMessages();
              hideMessage();
              gameData.phase = "playing";
              gameData.turnIndex = gameData.highBidderIndex;
              updateGame(gameId, gameData);
            } else {
              showMessage(`Play starts in ${countdown}...`);
            }
          }, 1000);
        }
        break;
      }

      const currentPlayerToDiscard = gameData.players[gameData.turnIndex];
      const reorderedDiscarderIndex = reorderedPlayers.findIndex((p) => p.id === currentPlayerToDiscard.id);

      if (currentPlayerToDiscard.id === currentUser.uid) {
        const isBidder =
          gameData.players[gameData.highBidderIndex].id === currentUser.uid;
        const minDiscards = isBidder
          ? currentPlayerToDiscard.hand.length - FINAL_HAND_SIZE
          : CARDS_DEALT - FINAL_HAND_SIZE;
        
        showMessage(
          `You must select at least ${minDiscards} cards to discard.`
        );
        displayActionMessage(0, "Your turn to discard");
        isMakingMove = false;
      } else {
        if (reorderedDiscarderIndex !== -1) {
            displayActionMessage(reorderedDiscarderIndex, "Discarding...");
        } else {
            showMessage(`${currentPlayerToDiscard.name} is discarding...`);
        }
        if (currentPlayerToDiscard.isAI) {
          aiAction();
        }
      }
      break;

    case "playing":
      if (gameData.currentTrick.length === PLAYER_COUNT) {
        isMakingMove = true;
        checkTrickWinner();
      } else {
        const reorderedPlayerIndex = reorderedPlayers.findIndex(
          (p) => p.id === currentPlayer.id
        );
        
        if (reorderedPlayerIndex !== -1) {
            displayActionMessage(reorderedPlayerIndex, "Turn to play");
        } else {
            showMessage(`${currentPlayer.name}'s turn to play.`);
        }
        
        if (isPlayerTurn) {
          isMakingMove = false;
        } else if (currentPlayer.isAI) {
          aiAction();
        }
      }
      break;

    case "scoring":
      isMakingMove = true;
      showMessage("Round over! Calculating scores...", 2000);

      if (currentUser.uid === gameData.hostId) {
        setTimeout(() => {
          const results = calculateTeamPoints();
          gameData.teams[0].score += results.team1.total;
          gameData.teams[1].score += results.team2.total;

          gameData.lastRoundResults = results;

          if (
            gameData.teams[0].score >= WINNING_SCORE ||
            gameData.teams[1].score >= WINNING_SCORE
          ) {
            gameData.phase = "gameOver";
          } else {
            gameData.phase = "roundEnd";
          }
          updateGame(gameId, gameData);
        }, 1500);
      }
      break;

    case "roundEnd":
      isMakingMove = false;
      hideMessage();

      if (gameData.lastRoundResults && !isRoundSummaryVisible()) {
        displayRoundResults(
          gameData.lastRoundResults,
          gameData,
          uiHelpers.createCardElement,
          currentUser
        );
      }
      break;

    case "gameOver":
      isMakingMove = true;

      if (gameData.lastRoundResults && !isRoundSummaryVisible()) {
        displayRoundResults(
          gameData.lastRoundResults,
          gameData,
          uiHelpers.createCardElement,
          currentUser
        );
      }
      showGameOver(gameData, currentUser);
      break;
  }

  oldPhase = gameData.phase;
};

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired.");
  document
    .getElementById("login-google")
    .addEventListener("click", handleGoogleLogin);
  document
    .getElementById("login-anonymous")
    .addEventListener("click", handleAnonymousLogin);

  document
    .getElementById("play-again-button")
    .addEventListener("click", handlePlayAgain);
  document
    .getElementById("full-reset-button")
    .addEventListener("click", resetGame);

  if (USE_FIREBASE) {
    console.log("Firebase ENABLED. Setting up auth listener.");
    onAuthStateChanged(auth, handleAuthChange);
  } else {
    console.log("Firebase DISABLED. Running in local test mode.");
    mockLogin(handleAuthChange);
  }
});


