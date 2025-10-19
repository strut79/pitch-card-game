import { cardSymbols, suits } from "./game.js";

let playerHandElements = [];
let playerInfoElements = [];
let trickAreaElements = [];
let playerBidDisplayElements = [];
let bidButtonsContainer, trumpSelectionContainer, discardButtonContainer;
let messageBox, messageText, team1PointsDisplay, team2PointsDisplay;
let team1RoundPointsLive, team2RoundPointsLive, winningBidDisplay;
let team1PointCardsEl, team2PointCardsEl, trickWinnerPopup, roundSummaryOverlay;
let team1RoundPointsDisplay, team2RoundPointsDisplay;
let team1CardValueDisplay, team2CardValueDisplay, rulesOverlay, nextRoundButton;
let playerActionDisplayElements = [];
let playerStatusDisplayElements = [];
let gameOverOverlay, playAgainButton;
let team1Drawer,
  team2Drawer,
  team1DrawerContent,
  team2DrawerContent,
  team1DrawerTab,
  team2DrawerTab;
let remainingDeckDisplay, widowHandEl;
let authContainer = document.getElementById("auth-container");

export const initUI = (
  handleCardClick,
  handleBid,
  handleTrumpSelection,
  handleDiscard,
  startGame,
  startNewRound,
  currentUser
) => {
  playerHandElements = [
    document.getElementById("player1-hand"),
    document.getElementById("player2-hand"),
    document.getElementById("player3-hand"),
    document.getElementById("player4-hand"),
  ];
  playerInfoElements = [
    document.getElementById("player1-info"),
    document.getElementById("player2-info"),
    document.getElementById("player3-info"),
    document.getElementById("player4-info"),
  ];
  trickAreaElements = [
    document.getElementById("player1-trick-area"),
    document.getElementById("player2-trick-area"),
    document.getElementById("player3-trick-area"),
    document.getElementById("player4-trick-area"),
  ];
  playerBidDisplayElements = [
    document.getElementById("player1-bid-display"),
    document.getElementById("player2-bid-display"),
    document.getElementById("player3-bid-display"),
    document.getElementById("player4-bid-display"),
  ];
  playerActionDisplayElements = [
    document.getElementById("player1-action-display"),
    document.getElementById("player2-action-display"),
    document.getElementById("player3-action-display"),
    document.getElementById("player4-action-display"),
  ];
  playerStatusDisplayElements = [
    document.getElementById("player1-status-display"),
    document.getElementById("player2-status-display"),
    document.getElementById("player3-status-display"),
    document.getElementById("player4-status-display"),
  ];
  bidButtonsContainer = document.getElementById("bid-buttons-container");
  trumpSelectionContainer = document.getElementById(
    "trump-selection-container"
  );
  discardButtonContainer = document.getElementById("discard-button-container");
  messageBox = document.getElementById("message-box");
  messageText = document.getElementById("message-text");
  team1PointsDisplay = document.getElementById("team1-points-display");
  team2PointsDisplay = document.getElementById("team2-points-display");
  team1RoundPointsLive = document.getElementById("team1-round-points-live");
  team2RoundPointsLive = document.getElementById("team2-round-points-live");
  trickWinnerPopup = document.getElementById("trick-winner-popup");
  rulesOverlay = document.getElementById("rules-overlay");
  roundSummaryOverlay = document.getElementById("round-summary-overlay");
  team1RoundPointsDisplay = document.getElementById(
    "team1-round-points-display"
  );
  team2RoundPointsDisplay = document.getElementById(
    "team2-round-points-display"
  );
  team1CardValueDisplay = document.getElementById("team1-card-value-display");
  team2CardValueDisplay = document.getElementById("team2-card-value-display");
  team1PointCardsEl = document.getElementById("team1-point-cards");
  team2PointCardsEl = document.getElementById("team2-point-cards");
  nextRoundButton = document.getElementById("next-round-button");
  gameOverOverlay = document.getElementById("game-over-overlay");
  playAgainButton = document.getElementById("play-again-button");
  team1Drawer = document.getElementById("team1-drawer");
  team2Drawer = document.getElementById("team2-drawer");
  team1DrawerContent = document.getElementById("team1-drawer-content");
  team2DrawerContent = document.getElementById("team2-drawer-content");
  team1DrawerTab = document.getElementById("team1-drawer-tab");
  team2DrawerTab = document.getElementById("team2-drawer-tab");
  remainingDeckDisplay = document.getElementById("remaining-deck-display");
  widowHandEl = document.getElementById("widow-hand");

  document
    .getElementById("full-reset-button")
    .addEventListener("click", startGame);
  document
    .getElementById("discard-button")
    .addEventListener("click", handleDiscard);
  document
    .getElementById("rules-button")
    .addEventListener("click", () => rulesOverlay.classList.remove("hidden"));
  document
    .getElementById("close-rules-button")
    .addEventListener("click", () => rulesOverlay.classList.add("hidden"));
  nextRoundButton.addEventListener("click", startNewRound);
  playAgainButton.addEventListener("click", startGame);

  team1DrawerTab.addEventListener("click", () =>
    team1Drawer.classList.toggle("drawer-open")
  );
  team2DrawerTab.addEventListener("click", () =>
    team2Drawer.classList.toggle("drawer-open")
  );

  const createCardElement = (card, options = {}) => {
    const {
      faceDown = false,
      isPlayerHand = false,
      inHand = false,
      isSummary = false,
      orientation = "bottom",
    } = options;
    const cardEl = document.createElement("div");
    let classes = [
      "card",
      "flex",
      "flex-col",
      "items-center",
      "justify-center",
      "rounded-lg",
      "border-2",
      "shadow-lg",
      "transition-all",
      "duration-150",
      "ease-in-out",
    ];

    if (isPlayerHand)
      classes.push("transform", "hover:-translate-y-4", "cursor-pointer");

    if (isSummary) {
      classes.push("w-12 h-20 relative");
    } else {
      const sizeClass = "w-16 h-24 md:w-20 md:h-28";
      classes.push(sizeClass, "absolute");
    }

    cardEl.className = classes.join(" ");
    cardEl.dataset.cardId = card.id;

    if (faceDown) {
      cardEl.classList.add("bg-blue-800", "border-blue-900");
      cardEl.innerHTML = `<div class="text-blue-200 text-4xl font-bold">P</div>`;
    } else if (card.value === "Game") {
      cardEl.classList.add("bg-green-200", "text-green-800");
      let gameHTML = `
                <div class="text-center">
                    <div class="text-3xl">醇</div>
                    <div class="font-bold text-xs">GAME</div>
                </div>`;
      if (options.count) {
        gameHTML = `
                <div class="text-center w-full">
                    <div class="text-lg">醇</div>
                    <div class="font-bold text-2xl leading-none">${options.count}</div>
                    <div class="font-bold text-xs">GAME</div>
                </div>`;
      }
      cardEl.innerHTML = gameHTML;
    } else {
      cardEl.classList.add(
        "bg-white",
        card.color === "red" ? "text-red-600" : "text-gray-800"
      );

      let valueDisplay;
      let symbol;
      let rankClass;
      let symbolClass;
      let posClassTop;
      let posClassBottom;

      if (card.value === "Joker") {
        symbol = "ワ";
        valueDisplay = isSummary ? "JKR" : "Joker";
        rankClass = isSummary ? "text-xs" : "text-lg";
        symbolClass = isSummary ? "text-3xl" : "text-4xl";
        posClassTop = isSummary ? "top-0.5 left-0.5" : "top-1 left-1";
        posClassBottom = isSummary
          ? "bottom-0.5 right-0.5"
          : "bottom-1 right-1";
      } else {
        symbol = cardSymbols[card.suit];
        valueDisplay = card.value === "10" ? "10" : card.value.charAt(0);
        rankClass = isSummary ? "text-base" : "text-lg";
        symbolClass = isSummary ? "text-3xl" : "text-4xl";
        posClassTop = isSummary ? "top-0 left-1" : "top-1 left-1";
        posClassBottom = isSummary ? "bottom-0 right-1" : "bottom-1 right-1";
      }

      cardEl.innerHTML = `
                <div class="absolute ${posClassTop} font-bold ${rankClass}">${valueDisplay}</div>
                <div class="${symbolClass}">${symbol}</div>
                <div class="absolute ${posClassBottom} font-bold transform rotate-180 ${rankClass}">${valueDisplay}</div>`;
    }

    if (card.isHigh && isSummary) {
      const highBadge = document.createElement("div");
      highBadge.textContent = "H";
      highBadge.className =
        "absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white";
      cardEl.appendChild(highBadge);
    }

    if (card.isLow && isSummary) {
      const lowBadge = document.createElement("div");
      lowBadge.textContent = "L";
      lowBadge.className =
        "absolute -bottom-2 -left-2 bg-blue-400 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white";
      cardEl.appendChild(lowBadge);
    }

    if (isPlayerHand) cardEl.onclick = () => handleCardClick(card);
    return cardEl;
  };

  return { createCardElement };
};

export const showMessage = (message, duration = null) => {
  if (!messageBox) return;
  messageText.innerHTML = message;
  messageBox.classList.remove("hidden");
  if (duration) {
    setTimeout(hideMessage, duration);
  }
};

export const hideMessage = () => {
  if (messageBox) messageBox.classList.add("hidden");
};

export const displayActionMessage = (playerIndex, message) => {
  const el = playerActionDisplayElements[playerIndex];
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
};

export const clearAllActionMessages = () => {
  playerActionDisplayElements.forEach((el) => {
    if (el) el.classList.add("hidden");
  });
};

export const renderHand = (
  player,
  handEl,
  selectedDiscards,
  handleCardClick,
  createCardElement,
  isPlayer
) => {
  if (!handEl) return;
  handEl.innerHTML = "";
  const hand = player.hand;
  const orientation = player.orientation;
  const isMobile = window.innerWidth < 640;

  if (!isPlayer && isMobile) {
    hand.forEach((card, index) => {
      const cardEl = createCardElement(card, { faceDown: true, orientation });
      cardEl.style.left = "50%";
      cardEl.style.top = "50%";
      const offset = index * 2;
      cardEl.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
      handEl.appendChild(cardEl);
    });

    if (hand.length > 0) {
      const cardCountBadge = document.createElement("div");
      cardCountBadge.className =
        "absolute -bottom-2 right-10 bg-gray-900 bg-opacity-70 text-white text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-500 z-10";
      cardCountBadge.textContent = hand.length;
      handEl.appendChild(cardCountBadge);
    }
    return;
  }

  const cardCount = hand.length;
  let fanAngle,
    anglePerCard,
    startAngle,
    horizontalOffset,
    verticalOffset,
    totalSize;

  if (orientation === "left" || orientation === "right") {
    fanAngle = 60;
    anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
    startAngle = -fanAngle / 2;
    verticalOffset = 35;
    totalSize = (cardCount - 1) * verticalOffset;
  } else {
    // Top and bottom
    const maxFanAngle = isMobile && cardCount > 10 ? 45 : 70;
    fanAngle = Math.min(cardCount * 10, maxFanAngle);
    anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
    startAngle = -fanAngle / 2;
    const maxHorizontalOffset = isMobile ? 30 : 55;
    horizontalOffset = Math.min(
      maxHorizontalOffset,
      (handEl.offsetWidth * 0.8) / cardCount
    );
    totalSize = (cardCount - 1) * horizontalOffset;
  }

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card, {
      faceDown: !isPlayer,
      isPlayerHand: isPlayer,
      orientation,
    });

    if (isPlayer && selectedDiscards.some((c) => c.id === card.id)) {
      cardEl.classList.add("border-purple-500", "border-4", "-translate-y-2");
    }

    let rotation, xTransform, yTransform;

    switch (orientation) {
      case "bottom":
        rotation = startAngle + index * anglePerCard;
        xTransform = `calc(-50% + ${
          -totalSize / 2 + index * horizontalOffset
        }px)`;
        yTransform = `${Math.abs(rotation) / 4}px`;
        cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
        cardEl.style.bottom = "0";
        cardEl.style.left = "50%";
        break;
      case "top":
        rotation = startAngle + index * anglePerCard;
        xTransform = `calc(-50% + ${
          -totalSize / 2 + index * horizontalOffset
        }px)`;
        yTransform = `${-Math.abs(rotation) / 4}px`;
        cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
        cardEl.style.top = "0";
        cardEl.style.left = "50%";
        break;
      case "left":
        rotation = startAngle + index * anglePerCard + 90;
        xTransform = `${Math.abs(rotation - 90) / 4}px`;
        yTransform = `calc(-50% + ${
          -totalSize / 2 + index * verticalOffset
        }px)`;
        cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
        cardEl.style.left = "0";
        cardEl.style.top = "50%";
        break;
      case "right":
        rotation = startAngle + index * anglePerCard - 90;
        xTransform = `${-Math.abs(rotation + 90) / 4}px`;
        yTransform = `calc(-50% + ${
          -totalSize / 2 + index * verticalOffset
        }px)`;
        cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
        cardEl.style.right = "0";
        cardEl.style.top = "50%";
        break;
    }
    handEl.appendChild(cardEl);
  });
};

export const renderWidow = (gameData, createCardElement) => {
  if (!widowHandEl) return;
  widowHandEl.innerHTML = "";
  const widow = gameData.widow || [];
  widow.forEach((card, index) => {
    const isFaceUp = index === widow.length - 1;
    const cardEl = createCardElement(card, {
      faceDown: !isFaceUp,
      isSummary: true,
    });
    cardEl.style.position = "absolute";
    cardEl.style.left = "50%";
    cardEl.style.top = "50%";
    const offset = (index - widow.length / 2) * 4;
    cardEl.style.transform = `translate(calc(-50% + ${offset}px), -50%)`;
    cardEl.style.zIndex = index;
    widowHandEl.appendChild(cardEl);
  });
};

export const renderPlayerBids = (gameData) => {
  gameData.players.forEach((player, index) => {
    const bidEl = playerBidDisplayElements[index];
    if (!bidEl) return;

    if (gameData.phase === "bidding" && player.hasBid) {
      bidEl.textContent = player.bid === "pass" ? "Pass" : `Bid: ${player.bid}`;
      bidEl.classList.remove("hidden");
    } else {
      bidEl.classList.add("hidden");
    }
  });
};

export const renderPlayerStatus = (gameData) => {
  if (gameData.phase === "discarding" || gameData.phase === "playing") {
    playerStatusDisplayElements.forEach((el, index) => {
      if (index === gameData.highBidderIndex) {
        el.innerHTML = `Bid: ${gameData.highBid} <span class="text-xl">${
          cardSymbols[gameData.trumpSuit] || ""
        }</span>`;
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
  } else {
    playerStatusDisplayElements.forEach((el) => el.classList.add("hidden"));
  }
};

export const renderTrick = (gameData, createCardElement) => {
  trickAreaElements.forEach((el) => {
    if (el) el.innerHTML = "";
  });
  if (!gameData.currentTrick) return;
  gameData.currentTrick.forEach((playedCard) => {
    const playerIndex = gameData.players.findIndex(
      (p) => p.id === playedCard.player
    );
    if (playerIndex !== -1 && trickAreaElements[playerIndex]) {
      trickAreaElements[playerIndex].appendChild(createCardElement(playedCard));
    }
  });
};

export const renderBidButtons = (highBid, handleBid) => {
  if (!bidButtonsContainer) return;
  bidButtonsContainer.innerHTML = "";
  const minBid = 4;
  const maxBid = 7;
  const minAllowed = highBid > 0 ? highBid + 1 : minBid;

  for (let i = minAllowed; i <= maxBid; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = `bid-button w-14 h-14 sm:w-16 sm:h-16 bg-sky-500 text-white font-bold rounded-full shadow-lg text-2xl sm:text-3xl hover:scale-110`;
    button.onclick = () => handleBid(i);
    bidButtonsContainer.appendChild(button);
  }
  const passButton = document.createElement("button");
  passButton.textContent = "Pass";
  passButton.className =
    "w-14 h-14 sm:w-16 sm:h-16 bg-gray-600 text-white font-bold rounded-full shadow-lg text-lg sm:text-xl hover:scale-110";
  passButton.onclick = () => handleBid("pass");
  bidButtonsContainer.appendChild(passButton);
};

export const renderTrumpSelection = (handleTrumpSelection) => {
  if (!trumpSelectionContainer) return;
  trumpSelectionContainer.innerHTML = "";
  suits.forEach((suit) => {
    const button = document.createElement("button");
    button.innerHTML = `${cardSymbols[suit]} <span class="hidden md:inline">${suit}</span>`;
    button.className =
      "w-24 md-w-32 py-3 px-4 bg-lime-600 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 text-xl hover:scale-110";
    button.onclick = () => handleTrumpSelection(suit);
    trumpSelectionContainer.appendChild(button);
  });
};

export const displayTrickWinner = (winnerName) => {
  if (!trickWinnerPopup) return;
  trickWinnerPopup.textContent = `${winnerName} won the trick!`;
  trickWinnerPopup.classList.remove("hidden", "opacity-0", "scale-0");
  setTimeout(() => {
    trickWinnerPopup.classList.add("opacity-0", "scale-0");
    setTimeout(() => trickWinnerPopup.classList.add("hidden"), 300);
  }, 1500);
};

export const displayRoundResults = (results, gameData, createCardElement) => {
  team1RoundPointsDisplay.textContent = results.team1.total;
  team2RoundPointsDisplay.textContent = results.team2.total;
  team1CardValueDisplay.textContent = results.team1.cardValue;
  team2CardValueDisplay.textContent = results.team2.cardValue;
  team1PointCardsEl.innerHTML = "";
  results.team1.pointCards.forEach((card) => {
    if (card.value === "Game" && !card.isPoint) return;
    team1PointCardsEl.appendChild(createCardElement(card, { isSummary: true }));
  });
  team2PointCardsEl.innerHTML = "";
  results.team2.pointCards.forEach((card) => {
    if (card.value === "Game" && !card.isPoint) return;
    team2PointCardsEl.appendChild(createCardElement(card, { isSummary: true }));
  });

  if (remainingDeckDisplay) {
    remainingDeckDisplay.innerHTML = "";
    const deck = gameData.deck || [];
    const cardCount = deck.length;

    const maxSpread = 400;
    const cardWidth = 48;
    let overlap = (maxSpread - cardWidth) / (cardCount - 1);
    if (cardCount === 1) overlap = 0;
    if (overlap > cardWidth - 8) overlap = cardWidth - 8;

    const totalWidth = (cardCount - 1) * overlap + cardWidth;
    const startOffset = -totalWidth / 2;

    deck.forEach((card, index) => {
      const cardEl = createCardElement(card, { isSummary: true });
      cardEl.style.position = "absolute";
      cardEl.style.left = `calc(50% + ${startOffset + index * overlap}px)`;
      cardEl.style.zIndex = index;

      remainingDeckDisplay.appendChild(cardEl);
    });
  }

  roundSummaryOverlay.classList.remove("hidden");
};

export const updatePointDrawers = (gameData, createCardElement) => {
  if (!team1DrawerContent || !team2DrawerContent) return;

  team1DrawerContent.innerHTML = "";
  gameData.teams[0].pointCards
    .filter((c) => c.value !== "Game")
    .forEach((card) => {
      team1DrawerContent.appendChild(
        createCardElement(card, { isSummary: true, count: card.count })
      );
    });

  team2DrawerContent.innerHTML = "";
  gameData.teams[1].pointCards
    .filter((c) => c.value !== "Game")
    .forEach((card) => {
      team2DrawerContent.appendChild(
        createCardElement(card, { isSummary: true, count: card.count })
      );
    });
};

export const updateUI = (
  gameData,
  selectedDiscards,
  handleCardClick,
  createCardElement,
  handleBid,
  currentUser
) => {
  if (!gameData || !gameData.players) return;

  const playerIndex = gameData.players.findIndex(
    (p) => p.id === currentUser.uid
  );
  const reorderedPlayers = [
    ...gameData.players.slice(playerIndex),
    ...gameData.players.slice(0, playerIndex),
  ];

  renderWidow(gameData, createCardElement);
  reorderedPlayers.forEach((p, i) => {
    renderHand(
      p,
      playerHandElements[i],
      selectedDiscards,
      handleCardClick,
      createCardElement,
      p.id === currentUser.uid
    );
    if (playerInfoElements[i]) {
      playerInfoElements[i].textContent = `Player ${i + 1}: ${p.name}`;
    }
  });
  renderTrick(gameData, createCardElement);
  renderPlayerBids(gameData);
  renderPlayerStatus(gameData);
  team1PointsDisplay.textContent = gameData.teams[0].score;
  team2PointsDisplay.textContent = gameData.teams[1].score;
  team1RoundPointsLive.textContent = `(+${gameData.teams[0].roundPoints})`;
  team2RoundPointsLive.textContent = `(+${gameData.teams[1].roundPoints})`;
  const currentPlayer = gameData.players[gameData.turnIndex];
  const isPlayerTurn = currentPlayer && currentPlayer.id === currentUser.uid;
  bidButtonsContainer.classList.toggle(
    "hidden",
    gameData.phase !== "bidding" || !isPlayerTurn
  );
  trumpSelectionContainer.classList.toggle(
    "hidden",
    gameData.phase !== "trumpSelection" || !isPlayerTurn
  );
  discardButtonContainer.classList.toggle(
    "hidden",
    gameData.phase !== "discarding" || !isPlayerTurn
  );

  if (gameData.phase === "bidding" && isPlayerTurn) {
    renderBidButtons(gameData.highBid, handleBid);
  }
};

export const showGameOver = (gameData) => {
  hideMessage();
  roundSummaryOverlay.classList.add("hidden");

  const team1Won = gameData.teams[0].score >= WINNING_SCORE;
  const team2Won = gameData.teams[1].score >= WINNING_SCORE;

  let winnerMessage = "Game Over!";
  if (team1Won && !team2Won) {
    winnerMessage = "脂 You Win! 脂";
  } else if (team2Won && !team1Won) {
    winnerMessage = "Opponents Win.";
  } else {
    winnerMessage = "It's a Tie!";
  }

  document.getElementById("game-over-title").textContent = winnerMessage;
  document.getElementById("final-score-team1").textContent =
    gameData.teams[0].score;
  document.getElementById("final-score-team2").textContent =
    gameData.teams[1].score;

  gameOverOverlay.classList.remove("hidden");
};

export const showAuthContainer = () => {
  console.log("showAuthContainer called");
  if (authContainer) authContainer.classList.remove("hidden");
};

export const hideAuthContainer = () => {
  if (authContainer) authContainer.classList.add("hidden");
};

export const showLobby = () => {
  const lobbyContainer = document.getElementById("lobby-container");
  if (lobbyContainer) lobbyContainer.classList.remove("hidden");
};

export const hideLobby = () => {
  const lobbyContainer = document.getElementById("lobby-container");
  if (lobbyContainer) lobbyContainer.classList.add("hidden");
};

export const hideGame = () => {
  const gameContainer = document.getElementById("game-container");
  if (gameContainer) gameContainer.classList.add("hidden");
};

export const showGame = () => {
  const gameContainer = document.getElementById("game-container");
  if (gameContainer) gameContainer.classList.remove("hidden");
};
