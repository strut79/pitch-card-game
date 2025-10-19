// --- Game Configuration ---
		const PLAYER_COUNT = 4;
		const CARDS_DEALT = 7;
		const FINAL_HAND_SIZE = 6; // Changed from 5 to 6
		const WIDOW_SIZE = 7;
		const WINNING_SCORE = 21;

		// --- Game State ---
		let gameData = {}; // Holds the entire game state
		let isMakingMove = false; // Prevents multiple actions at once
		let selectedDiscards = []; // Cards the player has selected to discard
		// DOM Element References (will be assigned in runGame)
		let playerHandElements = [];
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
		let team1Drawer, team2Drawer, team1DrawerContent, team2DrawerContent, team1DrawerTab, team2DrawerTab;
		let remainingDeckDisplay, widowHandEl;


		// --- Utility Functions ---
		const showMessage = (message, duration = null) => {
			if (!messageBox) return;
			messageText.innerHTML = message;
			messageBox.classList.remove('hidden');
			if (duration) {
				setTimeout(hideMessage, duration);
			}
		};

		const hideMessage = () => {
			if (messageBox) messageBox.classList.add('hidden');
		};

		const displayActionMessage = (playerIndex, message) => {
			const el = playerActionDisplayElements[playerIndex];
			if (!el) return;
			el.textContent = message;
			el.classList.remove('hidden');
		};

		const clearAllActionMessages = () => {
			playerActionDisplayElements.forEach(el => {
				if (el) el.classList.add('hidden');
			});
		};

		// --- Card Data and Logic ---
		const suits = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];
		const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
		const cardSymbols = { 'Clubs': '♣️', 'Diamonds': '♦️', 'Hearts': '♥️', 'Spades': '♠️' };

		const getSuitColor = (suit) => (suit === 'Diamonds' || suit === 'Hearts') ? 'red' : 'black';

		const isTrumpCard = (card, trumpSuit) => {
			if (!card || !trumpSuit) return false;
			const isTrumpSuit = card.suit === trumpSuit;
			const isOffJack = card.value === 'Jack' && card.suit !== trumpSuit && card.suit && getSuitColor(card.suit) === getSuitColor(trumpSuit);
			return isTrumpSuit || isOffJack || card.value === 'Joker';
		};

		const isProtectedCard = (card, trumpSuit) => {
			if (!card || !trumpSuit) return false;
			return isTrumpCard(card, trumpSuit) && (card.value === 'Jack' || card.value === 'Joker');
		};

		const getEffectiveSuit = (card, trumpSuit) => {
			return isTrumpCard(card, trumpSuit) ? trumpSuit : card.suit;
		};

		const getCardRank = (card, trumpSuit) => {
			if (!card) return -1;
			const isJoker = card.value === 'Joker';
			const isTrump = isTrumpCard(card, trumpSuit);
			const trumpRanks = { 'Ace': 18, 'King': 17, 'Queen': 16, 'Jack': 15, 'Off-Jack': 14, 'High-Joker': 13, 'Low-Joker': 12, '10': 11, '9': 10, '8': 9, '7': 8, '6': 7, '5': 6, '4': 5, '3': 4, '2': 3 };
			const standardRanks = { 'Ace': 14, 'King': 13, 'Queen': 12, 'Jack': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
			if (isJoker) return card.color === 'red' ? trumpRanks['High-Joker'] : trumpRanks['Low-Joker'];
			if (isTrump) {
				if (card.suit === trumpSuit) return trumpRanks[card.value] || 0;
				if (card.value === 'Jack') return trumpRanks['Off-Jack'];
			}
			return standardRanks[card.value] || 0;
		};

		const getCardPointValue = (card) => {
			if (!card) return 0;
			switch (card.value) {
				case 'Ace': return 4;
				case 'King': return 3;
				case 'Queen': return 2;
				case 'Jack': return 1;
				case '10': return 10;
				default: return 0;
			}
		};

		const createDeck = () => {
			const deck = [];
			for (const suit of suits) {
				for (const value of values) {
					deck.push({ id: `${value}-${suit}`, value, suit, color: getSuitColor(suit) });
				}
			}
			deck.push({ id: 'Joker-red', value: 'Joker', suit: null, color: 'red' });
			deck.push({ id: 'Joker-black', value: 'Joker', suit: null, color: 'black' });
			return shuffle(deck);
		};

		const shuffle = (deck) => {
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			return deck;
		};

		// --- UI Rendering ---
		const createCardElement = (card, options = {}) => {
			const { faceDown = false, isPlayerHand = false, inHand = false, isSummary = false, orientation = 'bottom' } = options;
			const cardEl = document.createElement('div');
			let classes = ['card', 'flex', 'flex-col', 'items-center', 'justify-center', 'rounded-lg', 'border-2', 'shadow-lg', 'transition-all', 'duration-150', 'ease-in-out'];

			if (isPlayerHand) classes.push('transform', 'hover:-translate-y-4', 'cursor-pointer');

			if (isSummary) {
				classes.push('w-12 h-20 relative');
			} else {
				const sizeClass = 'w-16 h-24 md:w-20 md:h-28';
				classes.push(sizeClass, 'absolute');
			}

			cardEl.className = classes.join(' ');
			cardEl.dataset.cardId = card.id;

			if (faceDown) {
				cardEl.classList.add('bg-blue-800', 'border-blue-900');
				cardEl.innerHTML = `<div class="text-blue-200 text-4xl font-bold">P</div>`;
			} else if (card.value === 'Game') {
				cardEl.classList.add('bg-green-200', 'text-green-800');
				let gameHTML = `
					<div class="text-center">
						<div class="text-3xl">🏆</div>
						<div class="font-bold text-xs">GAME</div>
					</div>`;
				if (options.count) {
					gameHTML = `
					<div class="text-center w-full">
						<div class="text-lg">🏆</div>
						<div class="font-bold text-2xl leading-none">${options.count}</div>
						<div class="font-bold text-xs">GAME</div>
					</div>`;
				}
				cardEl.innerHTML = gameHTML;
			} else {
				cardEl.classList.add('bg-white', card.color === 'red' ? 'text-red-600' : 'text-gray-800');

				let valueDisplay;
				let symbol;
				let rankClass;
				let symbolClass;
				let posClassTop;
				let posClassBottom;

				if (card.value === 'Joker') {
					symbol = '🃏';
					valueDisplay = isSummary ? 'JKR' : 'Joker';
					rankClass = isSummary ? 'text-xs' : 'text-lg';
					symbolClass = isSummary ? 'text-3xl' : 'text-4xl';
					posClassTop = isSummary ? 'top-0.5 left-0.5' : 'top-1 left-1';
					posClassBottom = isSummary ? 'bottom-0.5 right-0.5' : 'bottom-1 right-1';
				} else {
					symbol = cardSymbols[card.suit];
					valueDisplay = card.value === '10' ? '10' : card.value.charAt(0);
					rankClass = isSummary ? 'text-base' : 'text-lg';
					symbolClass = isSummary ? 'text-3xl' : 'text-4xl';
					posClassTop = isSummary ? 'top-0 left-1' : 'top-1 left-1';
					posClassBottom = isSummary ? 'bottom-0 right-1' : 'bottom-1 right-1';
				}

				cardEl.innerHTML = `
					<div class="absolute ${posClassTop} font-bold ${rankClass}">${valueDisplay}</div>
					<div class="${symbolClass}">${symbol}</div>
					<div class="absolute ${posClassBottom} font-bold transform rotate-180 ${rankClass}">${valueDisplay}</div>`;
			}

			if (card.isHigh && isSummary) {
				const highBadge = document.createElement('div');
				highBadge.textContent = 'H';
				highBadge.className = 'absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white';
				cardEl.appendChild(highBadge);
			}

			if (card.isLow && isSummary) {
				const lowBadge = document.createElement('div');
				lowBadge.textContent = 'L';
				lowBadge.className = 'absolute -bottom-2 -left-2 bg-blue-400 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white';
				cardEl.appendChild(lowBadge);
			}

			if (isPlayerHand) cardEl.onclick = () => handleCardClick(card);
			return cardEl;
		};
        
		const renderHand = (player, handEl) => {
			if (!handEl) return;
			handEl.innerHTML = '';
			const hand = player.hand;
			const isPlayer = player.id === 'player1';
			const orientation = player.orientation;
			const isMobile = window.innerWidth < 640;

			if (!isPlayer && isMobile) {
				hand.forEach((card, index) => {
					const cardEl = createCardElement(card, { faceDown: true, orientation });
					cardEl.style.left = '50%';
					cardEl.style.top = '50%';
					const offset = index * 2;
					cardEl.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
					handEl.appendChild(cardEl);
				});

				if (hand.length > 0) {
					const cardCountBadge = document.createElement('div');
					cardCountBadge.className = 'absolute -bottom-2 right-10 bg-gray-900 bg-opacity-70 text-white text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-gray-500 z-10';
					cardCountBadge.textContent = hand.length;
					handEl.appendChild(cardCountBadge);
				}
				return;
			}

			const cardCount = hand.length;
			let fanAngle, anglePerCard, startAngle, horizontalOffset, verticalOffset, totalSize;

			if (orientation === 'left' || orientation === 'right') {
				fanAngle = 60;
				anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
				startAngle = -fanAngle / 2;
				verticalOffset = 35;
				totalSize = (cardCount - 1) * verticalOffset;
			} else { // Top and bottom
                const maxFanAngle = isMobile && cardCount > 10 ? 45 : 70;
				fanAngle = Math.min(cardCount * 10, maxFanAngle);
				anglePerCard = cardCount > 1 ? fanAngle / (cardCount - 1) : 0;
				startAngle = -fanAngle / 2;
                const maxHorizontalOffset = isMobile ? 30 : 55;
				horizontalOffset = Math.min(maxHorizontalOffset, (handEl.offsetWidth * 0.8) / cardCount);
				totalSize = (cardCount - 1) * horizontalOffset;
			}

			hand.forEach((card, index) => {
				const cardEl = createCardElement(card, {
					faceDown: !isPlayer,
					isPlayerHand: isPlayer,
					orientation
				});

				if (isPlayer && selectedDiscards.some(c => c.id === card.id)) {
					cardEl.classList.add('border-purple-500', 'border-4', '-translate-y-2');
				}

				let rotation, xTransform, yTransform;

				switch (orientation) {
					case 'bottom':
						rotation = startAngle + index * anglePerCard;
						xTransform = `calc(-50% + ${-totalSize / 2 + index * horizontalOffset}px)`;
						yTransform = `${Math.abs(rotation) / 4}px`;
						cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
						cardEl.style.bottom = '0';
						cardEl.style.left = '50%';
						break;
					case 'top':
						rotation = startAngle + index * anglePerCard;
						xTransform = `calc(-50% + ${-totalSize / 2 + index * horizontalOffset}px)`;
						yTransform = `${-Math.abs(rotation) / 4}px`;
						cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
						cardEl.style.top = '0';
						cardEl.style.left = '50%';
						break;
					case 'left':
						rotation = startAngle + index * anglePerCard + 90;
						xTransform = `${Math.abs(rotation - 90) / 4}px`;
						yTransform = `calc(-50% + ${-totalSize / 2 + index * verticalOffset}px)`;
						cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
						cardEl.style.left = '0';
						cardEl.style.top = '50%';
						break;
					case 'right':
						rotation = startAngle + index * anglePerCard - 90;
						xTransform = `${-Math.abs(rotation + 90) / 4}px`;
						yTransform = `calc(-50% + ${-totalSize / 2 + index * verticalOffset}px)`;
						cardEl.style.transform = `translateX(${xTransform}) translateY(${yTransform}) rotate(${rotation}deg)`;
						cardEl.style.right = '0';
						cardEl.style.top = '50%';
						break;
				}
				handEl.appendChild(cardEl);
			});
		};

		const renderWidow = () => {
			if (!widowHandEl) return;
			widowHandEl.innerHTML = '';
			const widow = gameData.widow || [];
			widow.forEach((card, index) => {
				const isFaceUp = index === widow.length - 1;
				const cardEl = createCardElement(card, { faceDown: !isFaceUp, isSummary: true });
				cardEl.style.position = 'absolute';
				cardEl.style.left = '50%';
				cardEl.style.top = '50%';
				const offset = (index - (widow.length / 2)) * 4;
				cardEl.style.transform = `translate(calc(-50% + ${offset}px), -50%)`;
				cardEl.style.zIndex = index;
				widowHandEl.appendChild(cardEl);
			});
		};

		const renderPlayerBids = () => {
			gameData.players.forEach((player, index) => {
				const bidEl = playerBidDisplayElements[index];
				if (!bidEl) return;

				if (gameData.phase === 'bidding' && player.hasBid) {
					bidEl.textContent = player.bid === 'pass' ? 'Pass' : `Bid: ${player.bid}`;
					bidEl.classList.remove('hidden');
				} else {
					bidEl.classList.add('hidden');
				}
			});
		};

		const renderPlayerStatus = () => {
			if (gameData.phase === 'discarding' || gameData.phase === 'playing') {
				playerStatusDisplayElements.forEach((el, index) => {
					if (index === gameData.highBidderIndex) {
						el.innerHTML = `Bid: ${gameData.highBid} <span class="text-xl">${cardSymbols[gameData.trumpSuit] || ''}</span>`;
						el.classList.remove('hidden');
					} else {
						el.classList.add('hidden');
					}
				});
			} else {
				playerStatusDisplayElements.forEach(el => el.classList.add('hidden'));
			}
		};

		const renderTrick = () => {
			trickAreaElements.forEach(el => { if (el) el.innerHTML = ''; });
			if (!gameData.currentTrick) return;
			gameData.currentTrick.forEach(playedCard => {
				const playerIndex = gameData.players.findIndex(p => p.id === playedCard.player);
				if (playerIndex !== -1 && trickAreaElements[playerIndex]) {
					trickAreaElements[playerIndex].appendChild(createCardElement(playedCard));
				}
			});
		};

		const renderBidButtons = (highBid) => {
			if (!bidButtonsContainer) return;
			bidButtonsContainer.innerHTML = '';
			const minBid = 4;
			const maxBid = 7;
			const minAllowed = highBid > 0 ? highBid + 1 : minBid;

			for (let i = minAllowed; i <= maxBid; i++) {
				const button = document.createElement('button');
				button.textContent = i;
				button.className = `bid-button w-14 h-14 sm:w-16 sm:h-16 bg-sky-500 text-white font-bold rounded-full shadow-lg text-2xl sm:text-3xl hover:scale-110`;
				button.onclick = () => handleBid(i);
				bidButtonsContainer.appendChild(button);
			}
			const passButton = document.createElement('button');
			passButton.textContent = 'Pass';
			passButton.className = 'w-14 h-14 sm:w-16 sm:h-16 bg-gray-600 text-white font-bold rounded-full shadow-lg text-lg sm:text-xl hover:scale-110';
			passButton.onclick = () => handleBid('pass');
			bidButtonsContainer.appendChild(passButton);
		};

		const renderTrumpSelection = () => {
			if (!trumpSelectionContainer) return;
			trumpSelectionContainer.innerHTML = '';
			suits.forEach(suit => {
				const button = document.createElement('button');
				button.innerHTML = `${cardSymbols[suit]} <span class="hidden md:inline">${suit}</span>`;
				button.className = 'w-24 md-w-32 py-3 px-4 bg-lime-600 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 text-xl hover:scale-110';
				button.onclick = () => handleTrumpSelection(suit);
				trumpSelectionContainer.appendChild(button);
			});
		};

		const displayTrickWinner = (winnerName) => {
			if (!trickWinnerPopup) return;
			trickWinnerPopup.textContent = `${winnerName} won the trick!`;
			trickWinnerPopup.classList.remove('hidden', 'opacity-0', 'scale-0');
			setTimeout(() => {
				trickWinnerPopup.classList.add('opacity-0', 'scale-0');
				setTimeout(() => trickWinnerPopup.classList.add('hidden'), 300);
			}, 1500);
		};

		const displayRoundResults = (results) => {
			team1RoundPointsDisplay.textContent = results.team1.total;
			team2RoundPointsDisplay.textContent = results.team2.total;
			team1CardValueDisplay.textContent = results.team1.cardValue;
			team2CardValueDisplay.textContent = results.team2.cardValue;
			team1PointCardsEl.innerHTML = '';
			results.team1.pointCards.forEach(card => {
				if (card.value === 'Game' && !card.isPoint) return;
				team1PointCardsEl.appendChild(createCardElement(card, { isSummary: true }));
			});
			team2PointCardsEl.innerHTML = '';
			results.team2.pointCards.forEach(card => {
				if (card.value === 'Game' && !card.isPoint) return;
				team2PointCardsEl.appendChild(createCardElement(card, { isSummary: true }));
			});

			if (remainingDeckDisplay) {
				remainingDeckDisplay.innerHTML = '';
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
					cardEl.style.position = 'absolute';
					cardEl.style.left = `calc(50% + ${startOffset + (index * overlap)}px)`;
					cardEl.style.zIndex = index;

					remainingDeckDisplay.appendChild(cardEl);
				});
			}

			roundSummaryOverlay.classList.remove('hidden');
		};

		const updatePointDrawers = () => {
			if (!team1DrawerContent || !team2DrawerContent) return;

			team1DrawerContent.innerHTML = '';
			gameData.teams[0].pointCards.filter(c => c.value !== 'Game').forEach(card => {
				team1DrawerContent.appendChild(createCardElement(card, { isSummary: true, count: card.count }));
			});

			team2DrawerContent.innerHTML = '';
			gameData.teams[1].pointCards.filter(c => c.value !== 'Game').forEach(card => {
				team2DrawerContent.appendChild(createCardElement(card, { isSummary: true, count: card.count }));
			});
		};

		// --- Game Logic: Core ---
		const startGame = () => {
			gameOverOverlay.classList.add('hidden');
			const deck = createDeck();
			const players = [
				{ id: 'player1', name: 'You', hand: [], originalHand: [], orientation: 'bottom', bid: 0, hasBid: false },
				{ id: 'player2', name: 'Player 2', hand: [], originalHand: [], orientation: 'left', bid: 0, hasBid: false },
				{ id: 'player3', name: 'Player 3', hand: [], originalHand: [], orientation: 'top', bid: 0, hasBid: false },
				{ id: 'player4', name: 'Player 4', hand: [], originalHand: [], orientation: 'right', bid: 0, hasBid: false }
			];

			for (let i = 0; i < CARDS_DEALT * PLAYER_COUNT; i++) {
				const playerIndex = i % PLAYER_COUNT;
				const card = deck.pop();
				card.originalOwner = players[playerIndex].id;
				players[playerIndex].hand.push(card);
				players[playerIndex].originalHand.push(card);
			}

			const widow = deck.splice(0, WIDOW_SIZE);

			gameData = {
				deck,
				players,
				widow,
				teams: [
					{ id: 'team1', players: ['player1', 'player3'], score: 0, roundPoints: 0, cardsWon: [], pointCards: [] },
					{ id: 'team2', players: ['player2', 'player4'], score: 0, roundPoints: 0, cardsWon: [], pointCards: [] }
				],
				phase: 'bidding',
				turnIndex: 1,
				dealerIndex: 0,
				highBid: 0,
				highBidderIndex: -1,
				bidsMade: 0,
				trumpSuit: null,
				currentTrick: [],
				trickLeadPlayerIndex: -1,
				tricksPlayed: 0
			};
			updatePointDrawers();
			handleStateChanges();
		};

		const startNewRound = () => {
			roundSummaryOverlay.classList.add('hidden');
			const deck = createDeck();
			const newDealerIndex = (gameData.dealerIndex + 1) % PLAYER_COUNT;

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
				team.pointCards = [];
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

			document.getElementById('trump-suit-display').textContent = 'None';
			updatePointDrawers();
			handleStateChanges();
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

			// Check for point cards in the trick
			trick.forEach(card => {
				if (isTrumpCard(card, trumpSuit) && (card.value === 'Jack' || card.value === 'Joker')) {
					winnerTeam.pointCards.push(card);
				}
			});

			updatePointDrawers();

			setTimeout(() => {
				winnerTeam.cardsWon.push(...trick);

				gameData.currentTrick = [];
				gameData.turnIndex = winningPlayerIndex;
				gameData.tricksPlayed++;

				if (gameData.tricksPlayed === FINAL_HAND_SIZE) {
					gameData.phase = 'scoring';
				}
				handleStateChanges();
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

			const pointCardDefinitions = [
				{ name: 'High', card: highTrump },
				{ name: 'Low', card: lowTrump }
			];

			// Award High and Low points
			pointCardDefinitions.forEach(({ name, card }) => {
				if (!card) return;

				let teamToAward;
				if (name === 'Low') {
					teamToAward = card.originalOwner ? teams.find(t => t.players.includes(card.originalOwner)) : null;
				} else { // High
					const winnerOfHighCard = team1.cardsWon.some(c => c.id === card.id) ? team1 : (team2.cardsWon.some(c => c.id === card.id) ? team2 : null);
					teamToAward = winnerOfHighCard;
				}

				if (teamToAward) {
					const cardForDisplay = { ...card };
					if (name === 'High') cardForDisplay.isHigh = true;
					if (name === 'Low') cardForDisplay.isLow = true;
					if (!teamToAward.pointCards.some(c => c.id === cardForDisplay.id)) {
						teamToAward.pointCards.push(cardForDisplay);
					}
				}
			});

			// Calculate points from cards won in tricks (J, J, Jokers)
			scores[team1.id] += team1.pointCards.filter(c => c.value !== 'Game' && !c.isHigh && !c.isLow).length;
			scores[team2.id] += team2.pointCards.filter(c => c.value !== 'Game' && !c.isHigh && !c.isLow).length;

			// Add points for High and Low
			scores[team1.id] += team1.pointCards.filter(c => c.isHigh || c.isLow).length;
			scores[team2.id] += team2.pointCards.filter(c => c.isHigh || c.isLow).length;

			// Game point cards for drawers
			team1.pointCards.push({ id: 'game-point-t1', value: 'Game', count: cardValueTotals[team1.id], isPoint: false });
			team2.pointCards.push({ id: 'game-point-t2', value: 'Game', count: cardValueTotals[team2.id], isPoint: false });

			// Award actual score point for Game
			if (cardValueTotals[team1.id] > cardValueTotals[team2.id]) {
				scores[team1.id]++;
				const gameCard = team1.pointCards.find(c => c.id === 'game-point-t1');
				if (gameCard) gameCard.isPoint = true;
			} else if (cardValueTotals[team2.id] > cardValueTotals[team1.id]) {
				scores[team2.id]++;
				const gameCard = team2.pointCards.find(c => c.id === 'game-point-t2');
				if (gameCard) gameCard.isPoint = true;
			}


			if (scores[biddingTeam.id] < highBid) {
				scores[biddingTeam.id] = -highBid;
			}

			updatePointDrawers();

			return {
				team1: { total: scores[team1.id], pointCards: team1.pointCards, cardValue: cardValueTotals[team1.id] },
				team2: { total: scores[team2.id], pointCards: team2.pointCards, cardValue: cardValueTotals[team2.id] }
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
			handleStateChanges();
			isMakingMove = false;
		};

		const handleTrumpSelection = (suit) => {
			isMakingMove = true;
			gameData.trumpSuit = suit;
			document.getElementById('trump-suit-display').textContent = cardSymbols[suit];

			gameData.phase = 'discarding';
			gameData.turnIndex = gameData.highBidderIndex;
			gameData.discardsMade = 0;
			handleStateChanges();
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
			renderHand(gameData.players[0], playerHandElements[0]);
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

			displayActionMessage(gameData.turnIndex, `Kept ${cardsKeptCount}`);

			gameData.discardsMade++;
			gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
			handleStateChanges();
			isMakingMove = false;
		};

		const handleCardPlay = (card) => {
			if (isMakingMove) return;
			isMakingMove = true;

			const player = gameData.players[gameData.turnIndex];
			if (player.id !== 'player1') {
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
			handleStateChanges();
		};

		const handleCardClick = (card) => {
			if (isMakingMove) return;
			if (gameData.phase === 'playing' && gameData.players[gameData.turnIndex].id === 'player1') {
				handleCardPlay(card);
			} else if (gameData.phase === 'discarding' && gameData.players[gameData.turnIndex].id === 'player1') {
				toggleDiscardSelection(card);
			}
		};

		// --- AI Logic (UPDATED) ---
		const aiAction = () => {
			const player = gameData.players[gameData.turnIndex];
			if (player.id === 'player1') return;

			setTimeout(() => {
				if (gameData.phase === 'bidding') {
					const evaluateHandForSuit = (hand, trumpSuit) => {
						let score = 0;
						hand.forEach(card => {
							if (isTrumpCard(card, trumpSuit)) {
								if (card.value === 'Joker') score += 4;
								else if (card.value === 'Jack') score += 3.5;
								else if (card.value === 'Ace' || card.value === 'King') score += 2;
								else if (card.value === '2' || card.value === '3') score += 0.5;
								else score += 1;
							}
						});
						hand.forEach(card => {
							if (card.value === 'Ace' && !isTrumpCard(card, trumpSuit)) {
								score += 1.5;
							}
						});
						return score;
					};

					let bestSuit = null;
					let maxScore = 0;
					suits.forEach(suit => {
						const score = evaluateHandForSuit(player.hand, suit);
						if (score > maxScore) {
							maxScore = score;
							bestSuit = suit;
						}
					});

					let determinedBid = 'pass';
					if (maxScore > 12) determinedBid = 6;
					else if (maxScore > 10) determinedBid = 5;
					else if (maxScore > 8) determinedBid = 4;

					const minBid = 4;
					const minAllowed = gameData.highBid > 0 ? gameData.highBid + 1 : minBid;
					if (determinedBid !== 'pass' && determinedBid < minAllowed) {
						determinedBid = 'pass';
					}

					player.potentialTrumpSuit = bestSuit;
					handleBid(determinedBid);

				} else if (gameData.phase === 'trumpSelection') {
					const evaluateHandForSuit = (hand, trumpSuit) => {
						let score = 0;
						hand.forEach(card => {
							if (isTrumpCard(card, trumpSuit)) {
								if (card.value === 'Joker') score += 4;
								else if (card.value === 'Jack') score += 3.5;
								else if (card.value === 'Ace' || card.value === 'King') score += 2;
								else if (card.value === '2' || card.value === '3') score += 0.5;
								else score += 1;
							}
						});
						hand.forEach(card => {
							if (card.value === 'Ace' && !isTrumpCard(card, trumpSuit)) {
								score += 1.5;
							}
						});
						return score;
					};

					let bestSuit = 'Spades';
					let maxScore = -1;
					suits.forEach(suit => {
						const score = evaluateHandForSuit(player.hand, suit);
						if (score > maxScore) {
							maxScore = score;
							bestSuit = suit;
						}
					});

					handleTrumpSelection(bestSuit);

				} else if (gameData.phase === 'discarding') {
					const trumpSuit = gameData.trumpSuit;
					const isBidder = gameData.turnIndex === gameData.highBidderIndex;

					let numberToDiscard;
					if (isBidder) {
						numberToDiscard = player.hand.length - FINAL_HAND_SIZE;
					} else {
						const trumpCount = player.hand.filter(c => isTrumpCard(c, trumpSuit)).length;
						const offSuitAceCount = player.hand.filter(c => c.value === 'Ace' && !isTrumpCard(c, trumpSuit)).length;

						let cardsToKeep = 0;
						if (trumpCount >= 4) {
							cardsToKeep = 5;
						} else if (trumpCount === 3 || (trumpCount === 2 && offSuitAceCount > 0)) {
							cardsToKeep = 4;
						} else if (trumpCount === 2) {
							cardsToKeep = 3;
						} else {
							cardsToKeep = 2;
						}
						numberToDiscard = player.hand.length - cardsToKeep;
					}

					const sortedHand = [...player.hand].sort((a, b) => {
						const aValue = (isTrumpCard(a, trumpSuit) ? 100 : 0) + getCardRank(a, trumpSuit) + (a.value === 'Ace' ? 5 : 0);
						const bValue = (isTrumpCard(b, trumpSuit) ? 100 : 0) + getCardRank(b, trumpSuit) + (b.value === 'Ace' ? 5 : 0);
						return aValue - bValue;
					});

					const toDiscard = [];
					for (const card of sortedHand) {
						if (toDiscard.length < numberToDiscard && !isProtectedCard(card, trumpSuit)) {
							toDiscard.push(card);
						}
					}

					if (toDiscard.length < numberToDiscard) {
						for (const card of sortedHand) {
							if (toDiscard.length < numberToDiscard && !toDiscard.some(c => c.id === card.id)) {
								toDiscard.push(card);
							}
						}
					}

					const cardsKeptCount = player.hand.length - toDiscard.length;
					player.hand = player.hand.filter(c => !toDiscard.some(d => d.id === c.id));

					const cardsToDraw = Math.max(0, FINAL_HAND_SIZE - player.hand.length);
					if (cardsToDraw > 0) {
						const newCards = gameData.deck.splice(0, cardsToDraw);
						newCards.forEach(c => c.originalOwner = player.id);
						player.hand.push(...newCards);
					}

					displayActionMessage(gameData.turnIndex, `Kept ${cardsKeptCount}`);
					gameData.discardsMade++;
					gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
					handleStateChanges();

				} else if (gameData.phase === 'playing') {
					const trumpSuit = gameData.trumpSuit;
					const leadCard = gameData.currentTrick.length > 0 ? gameData.currentTrick[0] : null;
					const leadSuit = leadCard ? getEffectiveSuit(leadCard, trumpSuit) : null;

					let legalPlays = player.hand;
					if (leadSuit) {
						const followingSuit = player.hand.filter(c => getEffectiveSuit(c, trumpSuit) === leadSuit);
						if (followingSuit.length > 0) legalPlays = followingSuit;
					}

					let cardToPlay;
					if (!leadCard) {
						const sortedPlays = [...legalPlays].sort((a, b) => {
							const aValue = (isTrumpCard(a, trumpSuit) ? 100 : 0) + getCardRank(a, trumpSuit);
							const bValue = (isTrumpCard(b, trumpSuit) ? 100 : 0) + getCardRank(b, trumpSuit);
							return bValue - aValue;
						});
						cardToPlay = sortedPlays[0];
					} else {
						const winningCardInTrick = gameData.currentTrick.reduce((best, current) => {
							const effectiveBestSuit = getEffectiveSuit(best, trumpSuit);
							const effectiveCurrentSuit = getEffectiveSuit(current, trumpSuit);

							if (effectiveCurrentSuit === effectiveBestSuit) {
								return getCardRank(current, trumpSuit) > getCardRank(best, trumpSuit) ? current : best;
							}
							if (effectiveCurrentSuit === trumpSuit) {
								return current;
							}
							return best;
						}, gameData.currentTrick[0]);

						const winningRank = getCardRank(winningCardInTrick, trumpSuit);
						const canWinCards = legalPlays.filter(c => getCardRank(c, trumpSuit) > winningRank && getEffectiveSuit(c, trumpSuit) === getEffectiveSuit(winningCardInTrick, trumpSuit) || getEffectiveSuit(c, trumpSuit) === trumpSuit && getEffectiveSuit(winningCardInTrick, trumpSuit) !== trumpSuit);

						if (canWinCards.length > 0) {
							cardToPlay = canWinCards.sort((a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit))[0];
						} else {
							// Can't win. Check if partner is winning.
							const winningPlayerId = winningCardInTrick.player;
							const aiTeam = gameData.teams.find(team => team.players.includes(player.id));
							const partnerIsWinning = aiTeam.players.includes(winningPlayerId);

							if (partnerIsWinning) {
								// Partner is winning, try to save a point card.
								const pointCards = legalPlays.filter(c => isTrumpCard(c, trumpSuit) && (c.value === 'Jack' || c.value === 'Joker'));
								if (pointCards.length > 0) {
									// Save the highest point card.
									cardToPlay = pointCards.sort((a, b) => getCardRank(b, trumpSuit) - getCardRank(a, trumpSuit))[0];
								} else {
									// No point cards, play lowest card.
									cardToPlay = legalPlays.sort((a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit))[0];
								}
							} else {
								// Opponent is winning, play lowest card.
								cardToPlay = legalPlays.sort((a, b) => getCardRank(a, trumpSuit) - getCardRank(b, trumpSuit))[0];
							}
						}
					}

					if (!cardToPlay) {
						console.error(`AI Error: No card chosen. Legal plays:`, legalPlays);
						cardToPlay = legalPlays[0];
					}

					player.hand = player.hand.filter(c => c.id !== cardToPlay.id);
					cardToPlay.player = player.id;
					gameData.currentTrick.push(cardToPlay);
					if (gameData.currentTrick.length === 1) {
						gameData.trickLeadPlayerIndex = gameData.turnIndex;
					}
					gameData.turnIndex = (gameData.turnIndex + 1) % PLAYER_COUNT;
					handleStateChanges();
				}
			}, 1000 + Math.random() * 500);
		};

		// --- State Machine ---
		const handleStateChanges = () => {
			if (!gameData || !gameData.players) return;
			renderWidow();
			gameData.players.forEach((p, i) => renderHand(p, playerHandElements[i]));
			renderTrick();
			renderPlayerBids();
			renderPlayerStatus();
			team1PointsDisplay.textContent = gameData.teams[0].score;
			team2PointsDisplay.textContent = gameData.teams[1].score;
			team1RoundPointsLive.textContent = `(+${gameData.teams[0].roundPoints})`;
			team2RoundPointsLive.textContent = `(+${gameData.teams[1].roundPoints})`;
			const currentPlayer = gameData.players[gameData.turnIndex];
			const isPlayerTurn = currentPlayer && currentPlayer.id === 'player1';
			bidButtonsContainer.classList.toggle('hidden', gameData.phase !== 'bidding' || !isPlayerTurn);
			trumpSelectionContainer.classList.toggle('hidden', gameData.phase !== 'trumpSelection' || !isPlayerTurn);
			discardButtonContainer.classList.toggle('hidden', gameData.phase !== 'discarding' || !isPlayerTurn);

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
						handleStateChanges();
						return;
					}
					showMessage(`${currentPlayer.name}'s turn to bid.`);
					if (isPlayerTurn) renderBidButtons(gameData.highBid);
					else aiAction();
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
						renderWidow();
						gameData.phase = 'trumpSelection';
						handleStateChanges();
					}, 1500);
					return;
				case 'trumpSelection':
					const bidder = gameData.players[gameData.highBidderIndex];
					showMessage(`${bidder.name} is choosing trump...`);
					if (bidder.id === 'player1') {
						isMakingMove = false;
						renderTrumpSelection();
					} else {
						isMakingMove = true;
						aiAction();
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
								handleStateChanges();
							}
						}, 1000);
						return;
					}

					const player = gameData.players[gameData.turnIndex];
					const isBidder = gameData.turnIndex === gameData.highBidderIndex;
					const minCardsToDiscard = isBidder ? (player.hand.length - FINAL_HAND_SIZE) : (CARDS_DEALT - FINAL_HAND_SIZE);
					showMessage(`${player.name} is discarding... Select at least ${minCardsToDiscard} cards.`);

					if (isPlayerTurn) {
						isMakingMove = false;
					} else {
						isMakingMove = true;
						aiAction();
					}
					break;
				case 'playing':
					if (gameData.currentTrick.length === PLAYER_COUNT) {
						isMakingMove = true;
						checkTrickWinner();
					} else {
						showMessage(`${gameData.players[gameData.turnIndex].name}'s turn to play.`);
						if (gameData.players[gameData.turnIndex].id === 'player1') {
							isMakingMove = false;
						} else {
							isMakingMove = true;
							aiAction();
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

						displayRoundResults(results);

						if (gameData.teams[0].score >= WINNING_SCORE || gameData.teams[1].score >= WINNING_SCORE) {
							gameData.phase = 'gameOver';
						} else {
							gameData.phase = 'roundEnd';
						}
						handleStateChanges();
					}, 1500);
					break;
				case 'roundEnd':
					isMakingMove = false;
					hideMessage();
					break;
				case 'gameOver':
					isMakingMove = true;
					hideMessage();
					roundSummaryOverlay.classList.add('hidden');

					const team1Won = gameData.teams[0].score >= WINNING_SCORE;
					const team2Won = gameData.teams[1].score >= WINNING_SCORE;

					let winnerMessage = "Game Over!";
					if (team1Won && !team2Won) {
						winnerMessage = "🎉 You Win! 🎉";
					} else if (team2Won && !team1Won) {
						winnerMessage = "Opponents Win.";
					} else {
						winnerMessage = "It's a Tie!";
					}

					document.getElementById('game-over-title').textContent = winnerMessage;
					document.getElementById('final-score-team1').textContent = gameData.teams[0].score;
					document.getElementById('final-score-team2').textContent = gameData.teams[1].score;

					gameOverOverlay.classList.remove('hidden');
					break;
			}
		};
		const runGame = () => {
			playerHandElements = [document.getElementById('player1-hand'), document.getElementById('player2-hand'), document.getElementById('player3-hand'), document.getElementById('player4-hand')];
			trickAreaElements = [document.getElementById('player1-trick-area'), document.getElementById('player2-trick-area'), document.getElementById('player3-trick-area'), document.getElementById('player4-trick-area')];
			playerBidDisplayElements = [document.getElementById('player1-bid-display'), document.getElementById('player2-bid-display'), document.getElementById('player3-bid-display'), document.getElementById('player4-bid-display')];
			playerActionDisplayElements = [
				document.getElementById('player1-action-display'), document.getElementById('player2-action-display'),
				document.getElementById('player3-action-display'), document.getElementById('player4-action-display')
			];
			playerStatusDisplayElements = [
				document.getElementById('player1-status-display'), document.getElementById('player2-status-display'),
				document.getElementById('player3-status-display'), document.getElementById('player4-status-display')
			];
			bidButtonsContainer = document.getElementById('bid-buttons-container');
			trumpSelectionContainer = document.getElementById('trump-selection-container');
			discardButtonContainer = document.getElementById('discard-button-container');
			messageBox = document.getElementById('message-box');
			messageText = document.getElementById('message-text');
			team1PointsDisplay = document.getElementById('team1-points-display');
			team2PointsDisplay = document.getElementById('team2-points-display');
			team1RoundPointsLive = document.getElementById('team1-round-points-live');
			team2RoundPointsLive = document.getElementById('team2-round-points-live');
			trickWinnerPopup = document.getElementById('trick-winner-popup');
			rulesOverlay = document.getElementById('rules-overlay');
			roundSummaryOverlay = document.getElementById('round-summary-overlay');
			team1RoundPointsDisplay = document.getElementById('team1-round-points-display');
			team2RoundPointsDisplay = document.getElementById('team2-round-points-display');
			team1CardValueDisplay = document.getElementById('team1-card-value-display');
			team2CardValueDisplay = document.getElementById('team2-card-value-display');
			team1PointCardsEl = document.getElementById('team1-point-cards');
			team2PointCardsEl = document.getElementById('team2-point-cards');
			nextRoundButton = document.getElementById('next-round-button');
			gameOverOverlay = document.getElementById('game-over-overlay');
			playAgainButton = document.getElementById('play-again-button');
			team1Drawer = document.getElementById('team1-drawer');
			team2Drawer = document.getElementById('team2-drawer');
			team1DrawerContent = document.getElementById('team1-drawer-content');
			team2DrawerContent = document.getElementById('team2-drawer-content');
			team1DrawerTab = document.getElementById('team1-drawer-tab');
			team2DrawerTab = document.getElementById('team2-drawer-tab');
			remainingDeckDisplay = document.getElementById('remaining-deck-display');
			widowHandEl = document.getElementById('widow-hand');

			document.getElementById('full-reset-button').addEventListener('click', startGame);
			document.getElementById('discard-button').addEventListener('click', handleDiscard);
			document.getElementById('rules-button').addEventListener('click', () => rulesOverlay.classList.remove('hidden'));
			document.getElementById('close-rules-button').addEventListener('click', () => rulesOverlay.classList.add('hidden'));
			nextRoundButton.addEventListener('click', startNewRound);
			playAgainButton.addEventListener('click', startGame);

			team1DrawerTab.addEventListener('click', () => team1Drawer.classList.toggle('drawer-open'));
			team2DrawerTab.addEventListener('click', () => team2Drawer.classList.toggle('drawer-open'));

			startGame();
		};
		document.addEventListener('DOMContentLoaded', runGame);
