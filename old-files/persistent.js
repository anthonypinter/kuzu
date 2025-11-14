class PersistentTileGame {
    constructor() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initGame());
        } else {
            this.initGame();
        }
    }

    initGame() {
        // Prepare all game states
        this.initializeGameState();
        
        // Show initial modal to get player name
        //this.showInitialsModal();
         this.loadOrGenerateBoard();
    this.loadScores();
    this.renderScoreboard();
    this.setupEventListeners();
    this.renderBoard();
    this.updateGameState();
    }

    initializeGameState() {
        // Initialize all game state variables
        this.playerInitials = '';
        this.board = [];
        this.currentPosition = null;
        this.flippedTiles = new Set();
        this.nextGoalTile = 1;
        this.canMoveDiagonal = false;
        this.hasExtraLife = false;
        this.extraLifeUsed = false;
        this.isProcessingTurnEnd = false;
        this.canSelectAnyGoal = false;
        this.showAllTiles = false;
        this.collectedGoals = new Set();
        this.isWarping = false;
        this.isGrappling = false;
        this.grapplePosition = null;
        this.tryCount = 1;
        this.isFlipping = false;
        
        // Victory statistics tracking
        this.victoryStats = {
            powersUsed: new Set(),
            tilesRevealed: 0
        };
    }

    showInitialsModal() {
        // Find modal elements with error checking
        const modal = document.getElementById('playerInitialsModal');
        const startGameBtn = document.getElementById('startGameBtn');
        const initialsInput = document.getElementById('playerInitialsInput');

        // Log if any elements are missing
        if (!modal) console.error('Modal not found');
        if (!startGameBtn) console.error('Start Game Button not found');
        if (!initialsInput) console.error('Initials Input not found');

        // Ensure all elements exist before proceeding
        if (!modal || !startGameBtn || !initialsInput) {
            console.error('Cannot show initials modal - missing elements');
            return;
        }

        // Clear any existing event listeners
        startGameBtn.onclick = null;

        // Uppercase and limit input
        initialsInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 3);
        });

        // Start game button handler
        startGameBtn.onclick = () => {
            const initials = initialsInput.value.trim().toUpperCase().slice(0, 3);
            
            if (initials.length === 3) {
                // Hide the modal
                modal.classList.add('hidden');
                
                // Set up the rest of the game
                this.playerInitials = initials;
                
                // Update player initials display if element exists
                const playerInitialsDisplay = document.getElementById('currentPlayerInitials');
                if (playerInitialsDisplay) {
                    playerInitialsDisplay.textContent = this.playerInitials;
                }
                
                // Load or generate the board
                this.loadOrGenerateBoard();
                this.loadScores();
                this.renderScoreboard();
                this.setupEventListeners();
                this.renderBoard();
                this.updateGameState();
            } else {
                alert('Please enter exactly 3 initials');
                initialsInput.focus();
            }
        };

        // Show the modal
        modal.classList.remove('hidden');
    }

    loadOrGenerateBoard() {
        // Check if there's a saved board in localStorage
        const savedBoard = localStorage.getItem('kuzuMazePersistentBoard');
        
        if (savedBoard) {
            // Parse the saved board
            this.board = JSON.parse(savedBoard);
        } else {
            // Generate a new board if none exists
            const tiles = [
                ...Array(6).fill(0),
                1, 2, 3, 4, 5,
                6, 7, 8, 9, 10,
                ...Array(4).fill(11)
            ];
        
            // Use Math.random for board generation
            for (let i = tiles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
            }

            // Always use 4 columns x 5 rows layout
            this.board = Array(5).fill().map((_, i) => 
                tiles.slice(i * 4, (i + 1) * 4)
            );

            // Save the generated board
            localStorage.setItem('kuzuMazePersistentBoard', JSON.stringify(this.board));
        }
    }

    loadScores() {
        const savedScores = localStorage.getItem('kuzuMazeScores');
        this.scores = savedScores ? JSON.parse(savedScores) : [];
    }

    saveScores() {
        localStorage.setItem('kuzuMazeScores', JSON.stringify(this.scores));
        this.renderScoreboard();
    }

    renderScoreboard() {
        const scoreTableBody = document.getElementById('scoreTableBody');
        
        if (!scoreTableBody) {
            console.error('Score table body not found');
            return;
        }

        scoreTableBody.innerHTML = '';

        this.scores.forEach((score, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${score.initials}</td>
                <td>${score.attempts}</td>
            `;
            scoreTableBody.appendChild(row);
        });
    }

    addScore(initials, attempts) {
        // Ensure initials are uppercase and trimmed
        initials = initials.trim().toUpperCase().slice(0, 3);
        
        // Create new score object
        const newScore = { initials, attempts };
        
        // Add to scores and sort
        this.scores.push(newScore);
        this.scores.sort((a, b) => a.attempts - b.attempts);
        
        // Keep only top 10
        this.scores = this.scores.slice(0, 10);
        
        // Save and render
        this.saveScores();
    }

    isValidMove(row, col) {
        // Disable all moves if game is processing
        if (this.isProcessingTurnEnd || this.isFlipping) return false;
        
        if (this.isWarping) {
            return !this.flippedTiles.has(`${row}-${col}`);
        }
    
        if (this.isGrappling) {
            const [currentRow, currentCol] = this.currentPosition;
            
            const isAdjacent = 
                (Math.abs(row - currentRow) === 1 && col === currentCol) ||
                (Math.abs(col - currentCol) === 1 && row === currentRow) ||
                (this.canMoveDiagonal && 
                 Math.abs(row - currentRow) === 1 && 
                 Math.abs(col - currentCol) === 1);
        
            if (isAdjacent) {
                return !this.flippedTiles.has(`${row}-${col}`) || 
                       (this.flippedTiles.has(`${row}-${col}`) && this.board[row][col] === 0);
            }
            
            return !this.flippedTiles.has(`${row}-${col}`);
        }

        if (this.currentPosition === null) {
            // Always use 5 rows x 4 columns logic
            const lastRow = this.board.length - 1;
            const lastCol = this.board[0].length - 1;
            
            return (row === 0 || row === lastRow) || (col === 0 || col === lastCol);
        }

        const [currentRow, currentCol] = this.currentPosition;
        const orthogonal = (
            (Math.abs(row - currentRow) === 1 && col === currentCol) ||
            (Math.abs(col - currentCol) === 1 && row === currentRow)
        );
        
        const diagonal = this.canMoveDiagonal && (
            Math.abs(row - currentRow) === 1 && Math.abs(col - currentCol) === 1
        );

        const canMoveToTile = !this.flippedTiles.has(`${row}-${col}`) || 
                             (this.flippedTiles.has(`${row}-${col}`) && this.board[row][col] === 0);

        return (orthogonal || diagonal) && canMoveToTile;
    }

    async handleTileClick(row, col) {
        if (!this.isValidMove(row, col)) {
            return;
        }
     
        const tileValue = this.board[row][col];
        this.flippedTiles.add(`${row}-${col}`);
        
        await this.flipTile(row, col);
     
        if (this.isWarping) {
            this.isWarping = false;
            this.currentPosition = [row, col];
            this.handleTileEffect(row, col, tileValue);
            this.updateGameState();
            this.renderBoard();
            return;
        }
     
        if (this.isGrappling) {
            const [currentRow, currentCol] = this.currentPosition;
            const isAdjacent = 
                (Math.abs(row - currentRow) === 1 && col === currentCol) ||
                (Math.abs(col - currentCol) === 1 && row === currentRow) ||
                (this.canMoveDiagonal && 
                 Math.abs(row - currentRow) === 1 && 
                 Math.abs(col - currentCol) === 1);
     
            if (isAdjacent) {
                this.isGrappling = false;
                this.grapplePosition = null;
                this.currentPosition = [row, col];
                this.handleTileEffect(row, col, tileValue);
            } else {
                const shouldEnd = this.handleTileEffect(row, col, tileValue, true);
                if (!shouldEnd) {
                    this.currentPosition = this.grapplePosition;
                }
                this.isGrappling = false;
                this.grapplePosition = null;
            }
            this.updateGameState();
            this.renderBoard();
            return;
        }
     
        this.currentPosition = [row, col];
        this.handleTileEffect(row, col, tileValue);
        this.updateGameState();
        this.renderBoard();
    }

    async flipTile(row, col) {
        return new Promise((resolve) => {
            const tileElement = document.querySelector(`[data-position="${row}-${col}"]`);
            if (!tileElement) {
                resolve();
                return;
            }

            this.isFlipping = true;
            tileElement.classList.add('flipping');

            setTimeout(() => {
                const backFace = tileElement.querySelector('.tile-face-back img');
                if (backFace) {
                    backFace.src = this.getTileImage(this.board[row][col]);
                }
            }, 150);

            setTimeout(() => {
                tileElement.classList.remove('flipping');
                this.isFlipping = false;
                resolve();
            }, 300);
        });
    }

    handleTileEffect(row, col, tileValue, isGrappleEffect = false) {
        if (tileValue >= 1 && tileValue <= 5) {
            if (this.canSelectAnyGoal || tileValue === this.nextGoalTile) {
                this.collectedGoals.add(tileValue);
     
                if (this.extraLifeUsed) {
                    this.hasExtraLife = true;
                    this.extraLifeUsed = false;
                }
     
                if (this.canSelectAnyGoal) {
                    const remainingGoals = new Set([1, 2, 3, 4, 5]);
                    this.collectedGoals.forEach(value => {
                        remainingGoals.delete(value);
                    });
                    
                    const nextGoal = Math.min(...remainingGoals);
                    this.nextGoalTile = nextGoal;
                    this.canSelectAnyGoal = false;
                } else {
                    this.nextGoalTile = this.getNextRequiredGoal();
                }
                
                if (this.collectedGoals.size === 5) {
                    // Track final tiles revealed count
                    this.victoryStats.tilesRevealed = this.flippedTiles.size;
                    setTimeout(() => {
                        this.showVictoryModal();
                    }, 500);
                    return true;
                }
            } else {
                this.handleTurnEnd(`Wrong order! Needed ${this.nextGoalTile}, found ${tileValue}`, true);
                return true;
            }
        }
     
        if (tileValue === 6 && !isGrappleEffect) {
            this.victoryStats.powersUsed.add(6);
            this.isGrappling = true;
            this.grapplePosition = [row, col];
            return false;
        }
     
        switch (tileValue) {
            case 7:
                this.victoryStats.powersUsed.add(7);
                this.hasExtraLife = true;
                this.extraLifeUsed = false;
                break;
     
            case 8:
                this.victoryStats.powersUsed.add(8);
                this.canMoveDiagonal = true;
                break;
     
            case 9:
                this.victoryStats.powersUsed.add(9);
                this.canSelectAnyGoal = true;
                break;
     
            case 10:
                this.victoryStats.powersUsed.add(10);
                if (!isGrappleEffect) {
                    this.isWarping = true;
                } else {
                    this.isGrappling = false;
                    this.isWarping = true;
                }
                break;
     
            case 11:
                if (this.hasExtraLife) {
                    this.hasExtraLife = false;
                    this.extraLifeUsed = true;
                } else {
                    this.handleTurnEnd('Death tile! Starting new attempt...', true);
                    return true;
                }
                break;
        }
        return false;
    }

    handleTurnEnd(message, shouldResetBoard = false) {
        this.isProcessingTurnEnd = true;
        
        this.currentPosition = null;
        this.renderBoard();
        
        setTimeout(async () => {
            if (shouldResetBoard) {
                await this.resetTileAnimations();
                
                this.flippedTiles.clear();
                this.collectedGoals.clear();
                this.canMoveDiagonal = false;
                this.canSelectAnyGoal = false;
                this.hasExtraLife = false;
                this.extraLifeUsed = false;
                this.isWarping = false;
                this.isGrappling = false;
                this.grapplePosition = null;
                this.nextGoalTile = 1;
                this.showAllTiles = false;
                this.tryCount++;
                
                // Reset victory stats
                this.victoryStats = {
                    powersUsed: new Set(),
                    tilesRevealed: 0
                };
            }
            this.isProcessingTurnEnd = false;
            this.updateGameState();
            this.renderBoard();
        }, 1500);
    }

    async resetTileAnimations() {
        const tilesToReset = Array.from(this.flippedTiles).map(pos => {
            const [row, col] = pos.split('-').map(Number);
            return { row, col, element: document.querySelector(`[data-position="${row}-${col}"]`) };
        }).filter(tile => tile.element);

        const resetPromises = tilesToReset.map(({ row, col, element }) => {
            return new Promise((resolve) => {
                element.classList.add('resetting');
                
                setTimeout(() => {
                    const backFace = element.querySelector('.tile-face-back img');
                    if (backFace) {
                        backFace.src = this.getTileImage('unflipped');
                    }
                }, 200);

                setTimeout(() => {
                    element.classList.remove('resetting');
                    resolve();
                }, 400);
            });
        });

        await Promise.all(resetPromises);
    }

    renderBoard() {
        const gameBoard = document.getElementById('gameBoard');
        
        if (!gameBoard) {
            console.error('Game board not found');
            return;
        }

        gameBoard.innerHTML = '';
    
        if (!this.board || this.board.length === 0) {
            console.error('Board is empty or undefined');
            return;
        }
    
        this.board.forEach((row, rowIndex) => {
            row.forEach((tile, colIndex) => {
                const tileElement = document.createElement('button');
                tileElement.className = 'tile';
                tileElement.setAttribute('data-position', `${rowIndex}-${colIndex}`);
                
                const tileInner = document.createElement('div');
                tileInner.className = 'tile-inner';
                
                const frontFace = document.createElement('div');
                frontFace.className = 'tile-face tile-face-front';
                const frontImage = document.createElement('img');
                frontImage.className = 'tile-image';
                frontImage.src = this.getTileImage('unflipped');
                frontFace.appendChild(frontImage);
                
                const backFace = document.createElement('div');
                backFace.className = 'tile-face tile-face-back';
                const backImage = document.createElement('img');
                backImage.className = 'tile-image';
                
                if (this.flippedTiles.has(`${rowIndex}-${colIndex}`) || this.showAllTiles) {
                    backImage.src = this.getTileImage(tile);
                    tileElement.classList.add('flipping');
                } else {
                    backImage.src = this.getTileImage('unflipped');
                }
                
                backFace.appendChild(backImage);
                
                tileInner.appendChild(frontFace);
                tileInner.appendChild(backFace);
                tileElement.appendChild(tileInner);
    
                if (this.isValidMove(rowIndex, colIndex) && !this.isProcessingTurnEnd && !this.isFlipping) {
                    tileElement.classList.add('valid-move');
                }
    
                if (this.currentPosition && 
                    this.currentPosition[0] === rowIndex && 
                    this.currentPosition[1] === colIndex) {
                    tileElement.classList.add('current');
                }
    
                tileElement.onclick = () => this.handleTileClick(rowIndex, colIndex);
                gameBoard.appendChild(tileElement);
            });
        });
    }

    getTileImage(value) {
        const images = {
            unflipped: 'src/unflipped.svg',
            0: 'src/walkthrough.svg',
            1: 'src/flower1.svg',
            2: 'src/flower2.svg',
            3: 'src/flower3.svg',
            4: 'src/flower4.svg',
            5: 'src/flower5.svg',
            6: 'src/grapple.svg',
            7: 'src/extralife.svg',
            8: 'src/diagonal.svg',
            9: 'src/ooflower.svg',
            10: 'src/warp.svg',
            11: 'src/death.svg'
        };
        return images[value] || images.unflipped;
    }

    getNextRequiredGoal() {
        for (let i = 1; i <= 5; i++) {
            if (!this.collectedGoals.has(i)) {
                return i;
            }
        }
        return 5;
    }

    showVictoryModal() {
    const modal = document.getElementById('victoryModal');
    const playerInitialsModal = document.getElementById('playerInitialsModal');
    const gameBoard = document.getElementById('gameBoard');
    const startGameBtn = document.getElementById('startGameBtn');
    const initialsInput = document.getElementById('playerInitialsInput');
    
    if (!modal || !playerInitialsModal || !gameBoard) {
        console.error('Required modal elements not found');
        return;
    }

    // Hide game board
    gameBoard.style.display = 'none';

    // Show final attempt count
    document.getElementById('finalTryCount').textContent = this.tryCount;

    // Setup initials input modal
    initialsInput.value = ''; // Clear previous input
    modal.classList.add('hidden');
    playerInitialsModal.classList.remove('hidden');

    // Override start game button to handle score submission
    startGameBtn.onclick = () => {
        const initials = initialsInput.value.trim().toUpperCase().slice(0, 3);
        
        if (initials.length > 0 && initials.length <= 3) {
            // Add the score with player's initials
            this.addScore(initials, this.tryCount);
            
            // Hide initials modal
            playerInitialsModal.classList.add('hidden');
            
            // Reset game state, but keep the same board
            this.resetGameStateForNewPlayer();
            
            // Restore game board
            gameBoard.style.display = '';
        } else {
            alert('Please enter 1-3 initials');
        }
    };
}

resetGameStateForNewPlayer() {
    this.flippedTiles.clear();
    this.currentPosition = null;
    this.nextGoalTile = 1;
    this.canMoveDiagonal = false;
    this.hasExtraLife = false;
    this.extraLifeUsed = false;
    this.canSelectAnyGoal = false;
    this.collectedGoals.clear();
    this.isWarping = false;
    this.isGrappling = false;
    this.grapplePosition = null;
    this.isProcessingTurnEnd = false;
    this.showAllTiles = false;
    this.isFlipping = false;
    
    // Reset victory stats
    this.victoryStats = {
        powersUsed: new Set(),
        tilesRevealed: 0
    };
    
    // Reset attempt count
    this.tryCount = 1;
    
    this.renderBoard();
    this.updateGameState();
}

    resetBoard() {
        // Generate a completely new board
        const tiles = [
            ...Array(6).fill(0),
            1, 2, 3, 4, 5,
            6, 7, 8, 9, 10,
            ...Array(4).fill(11)
        ];
    
        // Use Math.random for board generation
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        // Always use 4 columns x 5 rows layout
        this.board = Array(5).fill().map((_, i) => 
            tiles.slice(i * 4, (i + 1) * 4)
        );

        // Save the new board
        localStorage.setItem('kuzuMazePersistentBoard', JSON.stringify(this.board));

        // Reset game state
        this.flippedTiles.clear();
        this.currentPosition = null;
        this.nextGoalTile = 1;
        this.canMoveDiagonal = false;
        this.hasExtraLife = false;
        this.extraLifeUsed = false;
        this.canSelectAnyGoal = false;
        this.collectedGoals.clear();
        this.isWarping = false;
        this.isGrappling = false;
        this.grapplePosition = null;
        this.isProcessingTurnEnd = false;
        this.showAllTiles = false;
        this.isFlipping = false;
        
        // Reset victory stats
        this.victoryStats = {
            powersUsed: new Set(),
            tilesRevealed: 0
        };
        
        this.tryCount = 1;
        
        this.renderBoard();
        this.updateGameState();
    }

    setupEventListeners() {
        // Restart button
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.onclick = () => {
                this.handleTurnEnd('Starting new attempt...', true);
            };
        }

        // New reset attempts button
    const resetAttemptsBtn = document.getElementById('resetAttemptsBtn');
    if (resetAttemptsBtn) {
        resetAttemptsBtn.onclick = () => {
            // Reset the game state, but keep the same board
            this.resetGameStateForNewPlayer();
            
            // Optionally, show the initials modal to start a new player
            this.showPlayerInitialsModal();
        };
    }

    // New reset board button
// const resetBoardBtn = document.getElementById('resetBoardBtn');
// if (resetBoardBtn) {
//     resetBoardBtn.onclick = () => {
//         this.resetBoardWithPassword();
//     };
// }

const gameTitle = document.getElementById('gameTitle');
if (gameTitle) {
    let clickCount = 0;
    let lastClickTime = 0;

    gameTitle.onclick = () => {
        const currentTime = new Date().getTime();
        
        // Reset click count if too much time has passed between clicks
        if (currentTime - lastClickTime > 1000) {
            clickCount = 0;
        }

        clickCount++;
        lastClickTime = currentTime;

        // Trigger reset board after 5 quick clicks
        if (clickCount >= 5) {
            this.resetBoardWithPassword();
            clickCount = 0;
        }
    };
}

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.onclick = () => {
                this.showHelpModal();
            };
        }

        // Close help modal
        const closeHelpBtn = document.getElementById('closeHelpBtn');
        if (closeHelpBtn) {
            closeHelpBtn.onclick = () => {
                this.hideHelpModal();
            };
        }

        // Help modal click outside to close
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.onclick = (e) => {
                if (e.target.id === 'helpModal') {
                    this.hideHelpModal();
                }
            };
        }
    }

    showHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    updateGameState() {
        const nextGoalEl = document.getElementById('nextGoal');
        const attemptCounterEl = document.getElementById('attemptCounter');
        const extraLifeBubble = document.getElementById('extraLifeBubble');
        const anyOrderBubble = document.getElementById('anyOrderBubble');
        const diagonalBubble = document.getElementById('diagonalBubble');
        const warpBubble = document.getElementById('warpBubble');
        const grappleBubble = document.getElementById('grappleBubble');

        if (nextGoalEl) {
            nextGoalEl.textContent = 
                `Next Goal: ${this.nextGoalTile <= 5 ? this.nextGoalTile : 'Complete!'}`;
        }

        if (attemptCounterEl) {
            attemptCounterEl.textContent = 
                `Attempt: ${this.tryCount}`;
        }
    
        if (extraLifeBubble) {
            extraLifeBubble.classList.toggle('hidden', !this.hasExtraLife);
        }

        if (anyOrderBubble) {
            anyOrderBubble.classList.toggle('hidden', !this.canSelectAnyGoal);
        }

        if (diagonalBubble) {
            diagonalBubble.classList.toggle('hidden', !this.canMoveDiagonal);
        }

        if (warpBubble) {
            warpBubble.classList.toggle('hidden', !this.isWarping);
        }

        if (grappleBubble) {
            grappleBubble.classList.toggle('hidden', !this.isGrappling);
        }
    
        const buttons = document.querySelectorAll('.control-btn');
        buttons.forEach(button => {
            button.disabled = this.isProcessingTurnEnd || this.isFlipping;
        });
    }

    shareResults() {
        const powerNames = {
            7: 'Extra Life',
            8: 'Diagonal',
            9: 'Any Order',
            10: 'Warp',
            6: 'Grapple'
        };
        
        let powersText = "";
        if (this.victoryStats.powersUsed.size === 0) {
            powersText = "None - Pure skill! 💪";
        } else {
            const powers = Array.from(this.victoryStats.powersUsed)
                .map(power => powerNames[power])
                .filter(name => name)
                .join(", ");
            powersText = powers;
        }
        
        const message = `🎉 Victory! 🎉
📊 My Results:
- Attempts: ${this.tryCount}
- Tiles Revealed: ${this.victoryStats.tilesRevealed} out of 20
- Powers Used: ${powersText}

Think you can do better? Try Kuzu's Maze!`;

        // Use clipboard API
        try {
            navigator.clipboard.writeText(message).then(() => {
                const copyBtn = document.getElementById('copyResultBtn');
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.background = '#10b981';
                    
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '';
                    }, 2000);
                }
            });
        } catch (err) {
            console.error('Failed to copy results', err);
        }
    }

    resetBoardWithPassword() {
    const password = prompt("Enter the password to reset the board:");
    
    if (password === "whatastellargame42069") {
        // Generate a completely new board
        const tiles = [
            ...Array(6).fill(0),
            1, 2, 3, 4, 5,
            6, 7, 8, 9, 10,
            ...Array(4).fill(11)
        ];
    
        // Use Math.random for board generation
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        // Always use 4 columns x 5 rows layout
        this.board = Array(5).fill().map((_, i) => 
            tiles.slice(i * 4, (i + 1) * 4)
        );

        // Save the new board
        localStorage.setItem('kuzuMazePersistentBoard', JSON.stringify(this.board));

        // Reset game state completely
        this.flippedTiles.clear();
        this.currentPosition = null;
        this.nextGoalTile = 1;
        this.canMoveDiagonal = false;
        this.hasExtraLife = false;
        this.extraLifeUsed = false;
        this.canSelectAnyGoal = false;
        this.collectedGoals.clear();
        this.isWarping = false;
        this.isGrappling = false;
        this.grapplePosition = null;
        this.isProcessingTurnEnd = false;
        this.showAllTiles = false;
        this.isFlipping = false;
        
        // Reset victory stats
        this.victoryStats = {
            powersUsed: new Set(),
            tilesRevealed: 0
        };
        
        // Reset attempt count and clear scores
        this.tryCount = 1;
        this.scores = [];
        localStorage.removeItem('kuzuMazeScores');
        
        // Render and update
        this.renderBoard();
        this.updateGameState();
        this.renderScoreboard();
    } else if (password !== null) {
        alert("Incorrect password. Board not reset.");
    }
}
}

// Initialize the game 
document.addEventListener('DOMContentLoaded', () => {
    new PersistentTileGame();
});