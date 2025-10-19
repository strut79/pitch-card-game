import { onGameUpdate, updateGame } from "./firestore.js";
import { dealCards, PLAYER_COUNT } from "./game.js";

let gameData;
let currentUser;
let gameId;

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

  // Show the start button if the current user is the host
  if (gameData.hostId === currentUser.uid) {
    startGameButton.classList.remove("hidden");
  } else {
    startGameButton.classList.add("hidden");
  }
};

const handleTeamSelection = (teamId) => {
  const player = gameData.players.find((p) => p.id === currentUser.uid);
  if (player) {
    player.team = teamId;
    updateGame(gameId, { players: gameData.players });
  }
};

const handleStartGame = () => {
  // Fill empty slots with AI players
  const team1PlayerCount = gameData.players.filter((p) => p.team === 1).length;
  const team2PlayerCount = gameData.players.filter((p) => p.team === 2).length;
  let team1SlotsToFill = 2 - team1PlayerCount;
  let team2SlotsToFill = 2 - team2PlayerCount;

  for (let i = 0; i < team1SlotsToFill; i++) {
    const aiPlayer = {
      id: `ai-team1-${i + 1}`,
      name: `AI Player`,
      isAI: true,
      team: 1,
      hand: [],
      originalHand: [],
    };
    gameData.players.push(aiPlayer);
  }

  for (let i = 0; i < team2SlotsToFill; i++) {
    const aiPlayer = {
      id: `ai-team2-${i + 1}`,
      name: `AI Player`,
      isAI: true,
      team: 2,
      hand: [],
      originalHand: [],
    };
    gameData.players.push(aiPlayer);
  }

  const team1Full = gameData.players.filter((p) => p.team === 1);
  const team2Full = gameData.players.filter((p) => p.team === 2);

  // Assign player IDs to the team objects for scoring and reference
  gameData.teams[0].players = team1Full.map((p) => p.id);
  gameData.teams[1].players = team2Full.map((p) => p.id);

  // Reorder the main players array to ensure turn rotation between teams (partners sit opposite)
  const orderedPlayers = [];
  while (team1Full.length > 0 || team2Full.length > 0) {
    if (team1Full.length > 0) orderedPlayers.push(team1Full.shift());
    if (team2Full.length > 0) orderedPlayers.push(team2Full.shift());
  }
  gameData.players = orderedPlayers;

  // Set initial dealer and the first player to bid (left of dealer)
  gameData.dealerIndex = 0; // The host is the first dealer
  gameData.turnIndex = (gameData.dealerIndex + 1) % PLAYER_COUNT;

  // Deal cards to all players
  dealCards(gameData);

  // Start the game
  gameData.phase = "bidding";
  updateGame(gameId, gameData);
};

export const initLobby = (id, user) => {
  gameId = id;
  currentUser = user;

  document
    .getElementById("team1")
    .addEventListener("click", () => handleTeamSelection(1));
  document
    .getElementById("team2")
    .addEventListener("click", () => handleTeamSelection(2));
  startGameButton.addEventListener("click", handleStartGame);

  onGameUpdate(gameId, (newGameData) => {
    gameData = newGameData;
    updateLobbyUI();
  });
};
