// FIX: Removed unused imports
import { dealCards, createNewGame } from "./game.js";

// FIX: Made these module-level so renderLobby can access them
let gameData;
let currentUser;
let gameId;
let createAndStartGameCallback;
let updateGameCallback;
let createNewGameCallback;

// FIX: Also made UI elements module-level
let team1Players, team2Players, unassignedPlayersList, startGameButton;

// FIX: New function to just render the UI
export const renderLobby = (newGameData, user) => {
  console.log("renderLobby called, phase:", newGameData.phase);
  gameData = newGameData;
  currentUser = user; // Ensure currentUser is always up to date

  if (!team1Players) {
    // Get elements if this is the first render
    team1Players = document.getElementById("team1-players");
    team2Players = document.getElementById("team2-players");
    unassignedPlayersList = document.getElementById(
      "unassigned-players-list"
    );
    startGameButton = document.getElementById("start-game-button");
  }

  if (!gameData || !team1Players) return;

  // Clear the lists
  team1Players.innerHTML = "";
  team2Players.innerHTML = "";
  unassignedPlayersList.innerHTML = "";

  // Populate the lists
  gameData.players.forEach((player) => {
    const playerElement = document.createElement("li");
    playerElement.textContent = player.name;

    if (player.team === 1) {
      team1Players.appendChild(playerElement);
    } else if (player.team === 2) {
      team2Players.appendChild(playerElement);
    } else {
      unassignedPlayersList.appendChild(playerElement);
    }
  });

  if (gameData.hostId === currentUser.uid) {
    startGameButton.classList.remove("hidden");
  } else {
    startGameButton.classList.add("hidden");
  }
};

const handleTeamSelection = async (teamId) => {
  console.log("handleTeamSelection", teamId, "gameId:", gameId);
  if (!gameId) {
    // First move, create the game
    // FIX: Use the passed-in createNewGame function
    const newGameData = createNewGameCallback(currentUser);
    newGameData.players[0].team = teamId;
    gameData = newGameData; // Set local state for callbacks
    if (createAndStartGameCallback) {
      // This will set up the main.js listener and trigger the first update
      await createAndStartGameCallback(gameData);
    }
  } else {
    // Game already exists, just update it
    const player = gameData.players.find((p) => p.id === currentUser.uid);
    if (player) {
      player.team = teamId;
      // FIX: Use the passed-in updateGame callback
      await updateGameCallback(gameId, { players: gameData.players });
    } else {
      // FIX: Handle joining a game (player not in list yet)
      const newPlayer = {
        id: currentUser.uid,
        name: currentUser.displayName || "New Player",
        isOnline: true,
        team: teamId,
      };
      gameData.players.push(newPlayer);
      await updateGameCallback(gameId, { players: gameData.players });
    }
  }
};

const handleStartGame = () => {
  if (gameData.hostId !== currentUser.uid) return;

  // Reorder players for proper seating: T1, T2, T1, T2
  const team1 = gameData.players.filter((p) => p.team === 1);
  const team2 = gameData.players.filter((p) => p.team === 2);

  // FIX: Add a counter for AI names
  let aiCounter = 1;

  // Fill empty slots with AI players
  while (team1.length < 2) {
    team1.push({
      id: `ai-t1-${team1.length}`,
      name: `AI Player ${aiCounter++}`, // <-- Use counter
      isAI: true,
      team: 1,
      hand: [],
      originalHand: [],
    });
  }
  while (team2.length < 2) {
    team2.push({
      id: `ai-t2-${team2.length}`,
      name: `AI Player ${aiCounter++}`, // <-- Use counter
      isAI: true,
      team: 2,
      hand: [],
      originalHand: [],
    });
  }

  const orderedPlayers = [team1[0], team2[0], team1[1], team2[1]];
  gameData.players = orderedPlayers;

  // Assign player IDs to teams in gameData
  gameData.teams[0].players = team1.map((p) => p.id);
  gameData.teams[1].players = team2.map((p) => p.id);

  dealCards(gameData);

  gameData.phase = "bidding";
  gameData.turnIndex = (gameData.dealerIndex + 1) % 4;
  
  // FIX: Use the passed-in updateGame callback
  updateGameCallback(gameId, gameData);
};

// FIX: Simplified initLobby
export const initLobby = (
  id,
  user,
  newGameFunc,
  createGameFunc,
  updateGameFunc
) => {
  console.log("initLobby called");
  gameId = id; // This might be null initially
  currentUser = user;
  createNewGameCallback = newGameFunc;
  createAndStartGameCallback = createGameFunc;
  updateGameCallback = updateGameFunc;

  // Get elements ONCE and add listeners
  team1Players = document.getElementById("team1-players");
  team2Players = document.getElementById("team2-players");
  unassignedPlayersList = document.getElementById(
    "unassigned-players-list"
  );
  startGameButton = document.getElementById("start-game-button");

  document
    .getElementById("team1")
    .addEventListener("click", () => handleTeamSelection(1));
  document
    .getElementById("team2")
    .addEventListener("click", () => handleTeamSelection(2));
  startGameButton.addEventListener("click", handleStartGame);

  // FIX: No listener here. main.js handles listeners.
};

