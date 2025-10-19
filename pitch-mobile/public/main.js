console.log("main.js executed");
import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { createGame, onGameUpdate, updateGame } from "./firestore.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
  PLAYER_COUNT,
  CARDS_DEALT,
  FINAL_HAND_SIZE,
  WIDOW_SIZE,
  WINNING_SCORE,
  suits,
  cardSymbols,
  isTrumpCard,
  isProtectedCard,
  getEffectiveSuit,
  getSuitColor,
  getCardRank,
  getCardPointValue,
  createDeck,
  createNewGame,
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
  showAuthContainer,
  hideAuthContainer,
  showLobby,
  hideLobby,
  showGame,
  hideGame,
  hideRoundSummary,
} from "./ui.js";
import { initLobby } from "./lobby.js";

// --- Game State ---
let gameData = {}; // Holds the entire game state
let isMakingMove = false; // Prevents multiple actions at once
let selectedDiscards = []; // Cards the player has selected to discard
let uiHelpers;
let currentUser = null;
let gameId = null;

// --- Auth ---
onAuthStateChanged(auth, (user) => {
  console.log("onAuthStateChanged called");
  if (user) {
    console.log("User is logged in:", user);
    currentUser = user;
    hideAuthContainer();
    const urlParams = new URLSearchParams(window.location.search);
    const urlGameId = urlParams.get("game");
    console.log("urlGameId:", urlGameId);
    if (urlGameId) {
      console.log("Joining game...");
      joinGame(urlGameId);
    } else {
      console.log("No game in URL, showing lobby to create one.");
      showLobby();
      hideGame();
      initLobby(null, currentUser, createAndStartGame);
    }
  } else {
    console.log("User is not logged in.");
    currentUser = null;
    showAuthContainer();
  }
});

const handleGoogleLogin = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    showMessage("Error logging in with Google. Please try again.", 3000);
    console.error("Google sign-in error", error);
  }
};

const handleAnonymousLogin = async () => {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    showMessage("Error signing in as guest. Please try again.", 3000);
    console.error("Anonymous sign-in error", error);
  }
};

// --- Game Logic: Core ---
const createAndStartGame = async (lobbyGameData) => {
  console.log("Creating a new game from lobby data...");
  gameId = await createGame(lobbyGameData);
  console.log("Game created with ID:", gameId);
  window.history.pushState(null, null, `?game=${gameId}`);
  console.log("URL updated.");

  onGameUpdate(gameId, (newGameData) => {
    handleStateChanges(newGameData);
  });
};

const joinGame = async (id) => {
  uiHelpers = initUI(
    handleCardClick,
    handleBid,
    handleTrumpSelection,
    handleDiscard,
    createAndStartGame,
    startNewRound,
    currentUser
  );
  gameId = id;

  const gameRef = doc(db, "games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    console.error("Game not found!");
    window.history.replaceState(null, null, window.location.pathname);
    showLobby();
    hideGame();
    initLobby(null, currentUser, createAndStartGame);
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

  onGameUpdate(gameId, (newGameData) => {
    handleStateChanges(newGameData);
  });
};

const startNewRound = () => {
  if (gameData.hostId !== currentUser.uid) return;
  hideRoundSummary();

  const newDealerIndex = (gameData.dealerIndex + 1) % PLAYER_COUNT;
  const deck = createDeck();

  gameData.players.forEach((player) => {
    player.hand = [];
    player.originalHand = [];
    player.bid = 0;
    player.hasBid = false;
  });

  for (let i = 0; i < CARDS_DEALT * PLAYER_COUNT; i++) {
    const playerIndex = (newDealerIndex + 1 + i) % PLAYER_COUNT;
    const card = deck.pop();
    card.originalOwner = gameData.players[playerIndex].id;
    gameData.players[playerIndex].hand.push(card);
    gameData.players[playerIndex].originalHand.push(card);
  }

  const widow = deck.splice(0, WIDOW_SIZE);
  gameData.widow = widow;
  gameData.deck = deck;

  gameData.teams.forEach((team) => {
    team.roundPoints = 0;
    team.cardsWon = [];
    team.pointCards = [];
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

  if (winnerTeam) {
    trick.forEach((card) => {
      const isPointCard =
        card.value === "Joker" ||
        (card.value === "Jack" && isTrumpCard(card, trumpSuit));

      if (
        isPointCard &&
        !winnerTeam.pointCards.some((pc) => pc.id === card.id)
      ) {
        winnerTeam.pointCards.push(card);
      }
    });
  }

  setTimeout(() => {
    if (winnerTeam) {
      winnerTeam.cardsWon.push(...trick);
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
    t.roundPoints = 0;
    t.pointCards = [];
  });

  const cardValueTotals = { [biddingTeam.id]: 0, [otherTeam.id]: 0 };
  biddingTeam.cardsWon.forEach(
    (card) => (cardValueTotals[biddingTeam.id] += getCardPointValue(card))
  );
  otherTeam.cardsWon.forEach(
    (card) => (cardValueTotals[otherTeam.id] += getCardPointValue(card))
  );

  const allCardsInPlay = [
    ...players.flatMap((p) => p.originalHand),
    ...gameData.widow,
  ];
  const allTrumpsInPlay = allCardsInPlay.filter((c) =>
    isTrumpCard(c, trumpSuit)
  );

  let highTrump, lowTrump;
  if (allTrumpsInPlay.length > 0) {
    const sortedTrumps = [...allTrumpsInPlay].sort(
      (a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit)
    );
    highTrump = sortedTrumps[sortedTrumps.length - 1];
    lowTrump = sortedTrumps[0];
  }

  const pointCardDefinitions = [
    { name: "High", card: highTrump },
    { name: "Low", card: lowTrump },
    {
      name: "Jack",
      card: allCardsInPlay.find(
        (c) => c.value === "Jack" && c.suit === trumpSuit
      ),
    },
    {
      name: "Off-Jack",
      card: allCardsInPlay.find(
        (c) =>
          c.value === "Jack" &&
          getSuitColor(c.suit) === getSuitColor(trumpSuit) &&
          c.suit !== trumpSuit
      ),
    },
    ...allCardsInPlay
      .filter((c) => c.value === "Joker")
      .map((joker) => ({ name: "Joker", card: joker })),
  ];

  pointCardDefinitions.forEach(({ name, card }) => {
    if (!card) return;
    let teamToAward;
    if (name === "Low") {
      teamToAward = card.originalOwner
        ? teams.find((t) => t.players.includes(card.originalOwner))
        : null;
    } else {
      const winnerOfCard = biddingTeam.cardsWon.some((c) => c.id === card.id)
        ? biddingTeam
        : otherTeam.cardsWon.some((c) => c.id === card.id)
        ? otherTeam
        : null;
      teamToAward = winnerOfCard;
    }

    if (teamToAward) {
      teamToAward.roundPoints++;
      const cardForDisplay = { ...card };
      if (name === "High") cardForDisplay.isHigh = true;
      if (name === "Low") cardForDisplay.isLow = true;
      if (!teamToAward.pointCards.some((c) => c.id === cardForDisplay.id)) {
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
  } else {
    otherTeam.roundPoints = 0; // Non-bidding team gets 0 if bidder makes it
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
  gameData.turnIndex = 0; // Start discard phase from first player
  gameData.discardsMade = 0;
  gameData.players.forEach((p) => (p.hasDiscarded = false)); // Reset for new phase
  updateGame(gameId, gameData).finally(() => {
    isMakingMove = false;
  });
};

const toggleDiscardSelection = (card) => {
  if (isProtectedCard(card, gameData.trumpSuit)) {
    showMessage(
      `<span class="text-red-400">Cannot discard protected cards.</span>`,
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
        // Leading the trick
        const sortedPlays = [...legalPlays].sort((a, b) => {
          const aValue =
            (isTrumpCard(a, trumpSuit) ? 100 : 0) + getCardRank(a, trumpSuit);
          const bValue =
            (isTrumpCard(b, trumpSuit) ? 100 : 0) + getCardRank(b, trumpSuit);
          return bValue - aValue; // Play highest card
        });
        cardToPlay = sortedPlays[0];
      } else {
        // Following suit
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
          // Play lowest winning card
          cardToPlay = canWinCards.sort(
            (a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit)
          )[0];
        } else {
          // Can't win, play lowest card
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
  const oldPhase = gameData ? gameData.phase : null;
  gameData = newGameData;

  if (!gameData) {
    console.log("No game data, returning to lobby.");
    showLobby();
    hideGame();
    initLobby(null, currentUser, createAndStartGame);
    return;
  }

  if (gameData.phase === "lobby") {
    if (oldPhase !== "lobby") {
      showLobby();
      hideGame();
      initLobby(gameId, currentUser, createAndStartGame);
    }
    return;
  }

  if (oldPhase === "lobby" && gameData.phase !== "lobby") {
    hideLobby();
    showGame();
    if (!uiHelpers) {
      uiHelpers = initUI(
        handleCardClick,
        handleBid,
        handleTrumpSelection,
        handleDiscard,
        createAndStartGame,
        startNewRound,
        currentUser
      );
    }
  }

  if (!uiHelpers) {
    uiHelpers = initUI(
      handleCardClick,
      handleBid,
      handleTrumpSelection,
      handleDiscard,
      createAndStartGame,
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

  const currentPlayer = gameData.players[gameData.turnIndex];
  const isPlayerTurn = currentPlayer && currentPlayer.id === currentUser.uid;

  switch (gameData.phase) {
    case "bidding":
      isMakingMove = false;
      if (gameData.bidsMade === PLAYER_COUNT) {
        if (gameData.highBidderIndex === -1) {
          showMessage("All players passed. Redealing...", 2000);
          if (currentUser.uid === gameData.hostId) {
            setTimeout(startNewRound, 2000);
          }
          return;
        } else {
          gameData.phase = "widowPickup";
          gameData.turnIndex = gameData.highBidderIndex;
        }
        if (currentUser.uid === gameData.hostId) {
          updateGame(gameId, gameData);
        }
        return;
      }
      showMessage(`${currentPlayer.name}'s turn to bid.`);
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
      return;
    case "trumpSelection":
      const bidder = gameData.players[gameData.highBidderIndex];
      showMessage(`${bidder.name} is choosing trump...`);
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
          const intervalId = setInterval(() => {
            showMessage(`Play starts in ${countdown}...`);
            countdown--;
            if (countdown < 0) {
              clearInterval(intervalId);
              clearAllActionMessages();
              gameData.phase = "playing";
              gameData.turnIndex = gameData.highBidderIndex;
              updateGame(gameId, gameData);
            }
          }, 1000);
        }
        return;
      }

      const currentPlayerToDiscard = gameData.players[gameData.turnIndex];
      if (currentPlayerToDiscard.id === currentUser.uid) {
        const isBidder =
          gameData.players[gameData.highBidderIndex].id === currentUser.uid;
        const minDiscards = isBidder
          ? currentPlayerToDiscard.hand.length - FINAL_HAND_SIZE
          : CARDS_DEALT - FINAL_HAND_SIZE;
        showMessage(
          `Your turn to discard. Select at least ${minDiscards} cards.`
        );
        isMakingMove = false;
      } else {
        showMessage(`${currentPlayerToDiscard.name} is discarding...`);
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
        showMessage(
          `${gameData.players[gameData.turnIndex].name}'s turn to play.`
        );
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

          displayRoundResults(
            results,
            gameData,
            uiHelpers.createCardElement,
            currentUser
          );

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
      break;
    case "gameOver":
      isMakingMove = true;
      showGameOver(gameData, currentUser);
      break;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("login-google")
    .addEventListener("click", handleGoogleLogin);
  document
    .getElementById("login-anonymous")
    .addEventListener("click", handleAnonymousLogin);

  // Check for gameId in URL on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const urlGameId = urlParams.get("game");
  if (urlGameId) {
    // If there is a gameId, let onAuthStateChanged handle joining
  } else {
    // Otherwise, show auth right away
    showAuthContainer();
  }
});
