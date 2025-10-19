import { onGameUpdate, updateGame } from "./firestore.js";
import { createNewGame, dealCards } from "./game.js";

let gameData;
let currentUser;
let gameId;
let createAndStartGameCallback;

const team1Players = document.getElementById("team1-players");
const team2Players = document.getElementById("team2-players");
const unassignedPlayersList = document.getElementById(
  "unassigned-players-list"
);
const startGameButton = document.getElementById("start-game-button");

const updateLobbyUI = () => {
  if (!gameData) return;

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
  if (!gameId) {
    // First move, create the game
    const newGameData = createNewGame(currentUser);
    newGameData.players[0].team = teamId;
    gameData = newGameData;
    if (createAndStartGameCallback) {
      await createAndStartGameCallback(gameData);
    }
  } else {
    const player = gameData.players.find((p) => p.id === currentUser.uid);
    if (player) {
      player.team = teamId;
      await updateGame(gameId, { players: gameData.players });
    }
  }
};

const handleStartGame = () => {
  if (gameData.hostId !== currentUser.uid) return;

  // Reorder players for proper seating: T1, T2, T1, T2
  const team1 = gameData.players.filter((p) => p.team === 1);
  const team2 = gameData.players.filter((p) => p.team === 2);

  // Fill empty slots with AI players
  while (team1.length < 2) {
    team1.push({
      id: `ai-t1-${team1.length}`,
      name: "AI Player",
      isAI: true,
      team: 1,
      hand: [],
      originalHand: [],
    });
  }
  while (team2.length < 2) {
    team2.push({
      id: `ai-t2-${team2.length}`,
      name: "AI Player",
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
  updateGame(gameId, gameData);
};

export const initLobby = (id, user, createGameCallback) => {
  gameId = id;
  currentUser = user;
  createAndStartGameCallback = createGameCallback;

  document
    .getElementById("team1")
    .addEventListener("click", () => handleTeamSelection(1));
  document
    .getElementById("team2")
    .addEventListener("click", () => handleTeamSelection(2));
  startGameButton.addEventListener("click", handleStartGame);

  if (gameId) {
    onGameUpdate(gameId, (newGameData) => {
      if (newGameData) {
        gameData = newGameData;
        updateLobbyUI();
      }
    });
  } else {
    // No game yet, create a temporary local state for the first player
    gameData = createNewGame(currentUser);
    updateLobbyUI();
  }
};
