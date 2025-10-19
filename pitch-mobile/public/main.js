console.log("main.js executed");
import { auth, db } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { createGame, onGameUpdate, updateGame } from './firestore.js';
import { 
    PLAYER_COUNT, 
    CARDS_DEALT, 
    FINAL_HAND_SIZE, 
    WINNING_SCORE, 
    suits, 
    cardSymbols, 
    isTrumpCard, 
    isProtectedCard, 
    getEffectiveSuit, 
    getCardRank, 
    getCardPointValue, 
    createDeck, 
    createNewGame 
} from './game.js';

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
    hideAuthContainer 
} from './ui.js';

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
        // After login, check if there is a game ID in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlGameId = urlParams.get('game');
        console.log("urlGameId:", urlGameId);
        if (urlGameId) {
            console.log("Joining game...");
            joinGame(urlGameId);
        } else {
            console.log("Starting a new game...");
            runGame();
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
        showMessage('Error logging in with Google. Please try again.', 3000);
        console.error("Google sign-in error", error);
    }
};

const handleAnonymousLogin = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        showMessage('Error signing in as guest. Please try again.', 3000);
        console.error("Anonymous sign-in error", error);
    }
};

// --- Game Logic: Core ---
const startGame = async () => {
    console.log("Creating a new game...");
    gameData = createNewGame(currentUser);
    console.log("Game data created:", gameData);
    gameId = await createGame(gameData);
    console.log("Game created with ID:", gameId);
    // Add gameId to the URL so other players can join
    window.history.pushState(null, null, `?game=${gameId}`);
    console.log("URL updated.");
    onGameUpdate(gameId, (newGameData) => {
        handleStateChanges(newGameData);
    });
};

const joinGame = (id) => {
    uiHelpers = initUI(handleCardClick, handleBid, handleTrumpSelection, handleDiscard, startGame, startNewRound, currentUser);
    gameId = id;
    onGameUpdate(gameId, (newGameData) => {
        handleStateChanges(newGameData);
    });
};

const startNewRound = () => {
    const newDealerIndex = (gameData.dealerIndex + 1) % PLAYER_COUNT;
    const deck = createDeck();

    gameData.players.forEach(player => {
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

    gameData.teams.forEach(team => {
        team.roundPoints = 0;
        team.cardsWon = [];
    });

    gameData.phase = 'bidding';
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
            if (currentSuit === trumpSuit && getCardRank(currentCard, trumpSuit) > getCardRank(winningCard, trumpSuit)) {
                winningCard = currentCard;
                winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
            }
        } else {
            if (currentSuit === trumpSuit) {
                winningCard = currentCard;
                winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
            } else if (currentSuit === leadSuit && getCardRank(currentCard, trumpSuit) > getCardRank(winningCard, trumpSuit)) {
                winningCard = currentCard;
                winningPlayerIndex = (gameData.trickLeadPlayerIndex + i) % PLAYER_COUNT;
            }
        }
    }

    const winner = gameData.players[winningPlayerIndex];
    displayTrickWinner(winner.name);

    const winnerTeam = gameData.teams.find(t => t.players.includes(winner.id));

    setTimeout(() => {
        winnerTeam.cardsWon.push(...trick);

        gameData.currentTrick = [];
        gameData.turnIndex = winningPlayerIndex;
        gameData.tricksPlayed++;

        if (gameData.tricksPlayed === FINAL_HAND_SIZE) {
            gameData.phase = 'scoring';
        }
        updateGame(gameId, gameData);
    }, 2000);
};

const calculateTeamPoints = () => {
    const { trumpSuit, teams, highBid, players, highBidderIndex } = gameData;
    const team1 = teams[0];
    const team2 = teams[1];
    const bidder = players[highBidderIndex];
    const biddingTeam = teams.find(t => t.players.includes(bidder.id));

    const scores = { [team1.id]: 0, [team2.id]: 0 };
    const cardValueTotals = { [team1.id]: 0, [team2.id]: 0 };

    team1.cardsWon.forEach(card => cardValueTotals[team1.id] += getCardPointValue(card));
    team2.cardsWon.forEach(card => cardValueTotals[team2.id] += getCardPointValue(card));

    const allCardsInPlay = [...players.flatMap(p => p.originalHand), ...gameData.widow];

    const allTrumpsInPlay = allCardsInPlay.filter(c => isTrumpCard(c, trumpSuit));

    let highTrump, lowTrump;
    if (allTrumpsInPlay.length > 0) {
        const sortedTrumps = [...allTrumpsInPlay].sort((a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit));
        highTrump = sortedTrumps[sortedTrumps.length - 1];
        lowTrump = sortedTrumps[0];
    }

    const pointCards = [];
    if(highTrump) pointCards.push(highTrump);
    if(lowTrump) pointCards.push(lowTrump);

    const jackOfTrump = players.flatMap(p => p.originalHand).find(c => c.value === 'Jack' && c.suit === trumpSuit);
    if(jackOfTrump) pointCards.push(jackOfTrump);

    const offJack = players.flatMap(p => p.originalHand).find(c => c.value === 'Jack' && getSuitColor(c.suit) === getSuitColor(trumpSuit) && c.suit !== trumpSuit);
    if(offJack) pointCards.push(offJack);

    const jokers = players.flatMap(p => p.originalHand).filter(c => c.value === 'Joker');
    pointCards.push(...jokers);

    pointCards.forEach(card => {
        const winningTeam = team1.cardsWon.some(c => c.id === card.id) ? team1 : (team2.cardsWon.some(c => c.id === card.id) ? team2 : null);
        if (winningTeam) {
            scores[winningTeam.id]++;
        }
    });

    if (cardValueTotals[team1.id] > cardValueTotals[team2.id]) {
        scores[team1.id]++;
    } else if (cardValueTotals[team2.id] > cardValueTotals[team1.id]) {
        scores[team2.id]++;
    }

    if (scores[biddingTeam.id] < highBid) {
        scores[biddingTeam.id] = -highBid;
    }

    return {
        team1: { total: scores[team1.id], pointCards: team1.cardsWon, cardValue: cardValueTotals[team1.id] },
        team2: { total: scores[team2.id], pointCards: team2.cardsWon, cardValue: cardValueTotals[team2.id] }
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
    if (bidValue !== 'pass' && bidValue > gameData.highBid) {
        gameData.highBid = bidValue;
        gameData.highBidderIndex = gameData.turnIndex;
    }
    gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
    updateGame(gameId, gameData);
    isMakingMove = false;
};

const handleTrumpSelection = (suit) => {
    isMakingMove = true;
    gameData.trumpSuit = suit;

    gameData.phase = 'discarding';
    gameData.turnIndex = gameData.highBidderIndex;
    gameData.discardsMade = 0;
    updateGame(gameId, gameData);
    isMakingMove = false;
};

const toggleDiscardSelection = (card) => {
    if (isMakingMove) return;
    if (isProtectedCard(card, gameData.trumpSuit)) {
        showMessage(`<span class="text-red-400">Cannot discard protected cards.</span>`, 2000);
        return;
    }
    const index = selectedDiscards.findIndex(c => c.id === card.id);
    if (index > -1) {
        selectedDiscards.splice(index, 1);
    } else {
        selectedDiscards.push(card);
    }
    renderHand(gameData.players.find(p => p.id === currentUser.uid), document.getElementById('player1-hand'), selectedDiscards, handleCardClick, uiHelpers.createCardElement, true);
};

const handleDiscard = () => {
    if (isMakingMove) return;
    isMakingMove = true;
    const player = gameData.players[gameData.turnIndex];

    const isBidder = gameData.turnIndex === gameData.highBidderIndex;
    const minCardsToDiscard = isBidder ? (player.hand.length - FINAL_HAND_SIZE) : (CARDS_DEALT - FINAL_HAND_SIZE);

    if (selectedDiscards.length < minCardsToDiscard) {
        showMessage(`You must select at least ${minCardsToDiscard} cards to discard.`, 2000);
        isMakingMove = false;
        return;
    }

    const cardsKeptCount = player.hand.length - selectedDiscards.length;
    player.hand = player.hand.filter(card => !selectedDiscards.some(d => d.id === card.id));

    const cardsToDraw = Math.max(0, FINAL_HAND_SIZE - player.hand.length);
    if (cardsToDraw > 0) {
        const newCards = gameData.deck.splice(0, cardsToDraw);
        newCards.forEach(c => c.originalOwner = player.id);
        player.hand.push(...newCards);
    }

    selectedDiscards = [];

    gameData.discardsMade++;
    gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
    updateGame(gameId, gameData);
    isMakingMove = false;
};

const handleCardPlay = (card) => {
    if (isMakingMove) return;
    isMakingMove = true;

    const player = gameData.players[gameData.turnIndex];
    if (player.id !== currentUser.uid) {
        isMakingMove = false;
        return;
    }
    const leadCard = gameData.currentTrick.length > 0 ? gameData.currentTrick[0] : null;
    const leadSuit = leadCard ? getEffectiveSuit(leadCard, gameData.trumpSuit) : null;
    if (leadSuit) {
        const playedSuit = getEffectiveSuit(card, gameData.trumpSuit);
        if (playedSuit !== leadSuit && player.hand.some(c => getEffectiveSuit(c, gameData.trumpSuit) === leadSuit)) {
            showMessage(`You must follow suit (${leadSuit})`, 2000);
            isMakingMove = false;
            return;
        }
    }

    player.hand = player.hand.filter(c => c.id !== card.id);
    card.player = player.id;
    gameData.currentTrick.push(card);
    if (gameData.currentTrick.length === 1) {
        gameData.trickLeadPlayerIndex = gameData.turnIndex;
    }
    gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
    updateGame(gameId, gameData);
};

const handleCardClick = (card) => {
    if (isMakingMove) return;
    if (gameData.phase === 'playing' && gameData.players[gameData.turnIndex].id === currentUser.uid) {
        handleCardPlay(card);
    } else if (gameData.phase === 'discarding' && gameData.players[gameData.turnIndex].id === currentUser.uid) {
        toggleDiscardSelection(card);
    }
};

// --- State Machine ---
const handleStateChanges = (newGameData) => {
    gameData = newGameData;
    updateUI(gameData, selectedDiscards, handleCardClick, uiHelpers.createCardElement, handleBid, currentUser);

    const currentPlayer = gameData.players[gameData.turnIndex];
    const isPlayerTurn = currentPlayer && currentPlayer.id === currentUser.uid;

    switch (gameData.phase) {
        case 'bidding':
            isMakingMove = false;
            if (gameData.bidsMade === PLAYER_COUNT) {
                if (gameData.highBidderIndex === -1) {
                    showMessage('All players passed. Redealing...', 2000);
                    setTimeout(startNewRound, 2000);
                    return;
                } else {
                    gameData.phase = 'widowPickup';
                    gameData.turnIndex = gameData.highBidderIndex;
                }
                updateGame(gameId, gameData);
                return;
            }
            showMessage(`${currentPlayer.name}'s turn to bid.`);
            if (isPlayerTurn) renderBidButtons(gameData.highBid, handleBid);
            break;
        case 'widowPickup':
            const bidderForWidow = gameData.players[gameData.highBidderIndex];
            showMessage(`${bidderForWidow.name} takes the widow...`, 1500);
            setTimeout(() => {
                gameData.widow.forEach(card => {
                    card.originalOwner = bidderForWidow.id;
                    bidderForWidow.originalHand.push(card);
                });
                bidderForWidow.hand.push(...gameData.widow);
                gameData.widow = [];
                gameData.phase = 'trumpSelection';
                updateGame(gameId, gameData);
            }, 1500);
            return;
        case 'trumpSelection':
            const bidder = gameData.players[gameData.highBidderIndex];
            showMessage(`${bidder.name} is choosing trump...`);
            if (bidder.id === currentUser.uid) {
                isMakingMove = false;
                renderTrumpSelection(handleTrumpSelection);
            } 
            break;
        case 'discarding':
            if (gameData.discardsMade === PLAYER_COUNT) {
                isMakingMove = true;
                let countdown = 5;
                const intervalId = setInterval(() => {
                    showMessage(`Play starts in ${countdown}...`);
                    countdown--;
                    if (countdown < 0) {
                        clearInterval(intervalId);
                        clearAllActionMessages();
                        gameData.phase = 'playing';
                        gameData.turnIndex = gameData.highBidderIndex;
                        updateGame(gameId, gameData);
                    }
                }, 1000);
                return;
            }

            const player = gameData.players[gameData.turnIndex];
            const isBidder = gameData.turnIndex === gameData.highBidderIndex;
            const minCardsToDiscard = isBidder ? (player.hand.length - FINAL_HAND_SIZE) : (CARDS_DEALT - FINAL_HAND_SIZE);
            showMessage(`${player.name} is discarding... Select at least ${minCardsToDiscard} cards.`);

            if (player.id === currentUser.uid) {
                isMakingMove = false;
            } 
            break;
        case 'playing':
            if (gameData.currentTrick.length === PLAYER_COUNT) {
                isMakingMove = true;
                checkTrickWinner();
            } else {
                showMessage(`${gameData.players[gameData.turnIndex].name}'s turn to play.`);
                if (gameData.players[gameData.turnIndex].id === currentUser.uid) {
                    isMakingMove = false;
                } 
            }
            break;
        case 'scoring':
            isMakingMove = true;
            showMessage('Round over! Calculating scores...', 2000);
            setTimeout(() => {
                const results = calculateTeamPoints();
                gameData.teams[0].score += results.team1.total;
                gameData.teams[1].score += results.team2.total;
                gameData.teams[0].roundPoints = results.team1.total;
                gameData.teams[1].roundPoints = results.team2.total;

                displayRoundResults(results, gameData, uiHelpers.createCardElement);

                if (gameData.teams[0].score >= WINNING_SCORE || gameData.teams[1].score >= WINNING_SCORE) {
                    gameData.phase = 'gameOver';
                } else {
                    gameData.phase = 'roundEnd';
                }
                updateGame(gameId, gameData);
            }, 1500);
            break;
        case 'roundEnd':
            isMakingMove = false;
            hideMessage();
            break;
        case 'gameOver':
            isMakingMove = true;
            showGameOver(gameData);
            break;
    }
};

const runGame = () => {
    uiHelpers = initUI(handleCardClick, handleBid, handleTrumpSelection, handleDiscard, startGame, startNewRound, currentUser);
    startGame();
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-google').addEventListener('click', handleGoogleLogin);
    document.getElementById('login-anonymous').addEventListener('click', handleAnonymousLogin);
});