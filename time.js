class TileGame {
    constructor() {
        // Game State Tracking
        this.board = [];
        this.currentPosition = null;
        this.flippedTiles = new Set();
        this.nextGoalTile = 1;
        this.collectedGoals = new Set();

        // Game Mechanics Flags
        this.canMoveDiagonal = false;
        this.hasExtraLife = false;
        this.extraLifeUsed = false;
        this.canSelectAnyGoal = false;
        
        // Game Control Flags
        this.isProcessingTurnEnd = false;
        this.isFlipping = false;
        this.isDailyCompleted = false;
        this.showAllTiles = false;

        // Special Mechanics
        this.isWarping = false;
        this.isGrappling = false;
        this.grapplePosition = null;

        // Game Progress
        this.tryCount = 1;
        this.victoryStats = {
            powersUsed: new Set(),
            tilesRevealed: 0
        };

        // Board Management
        this.todaysDate = this.getTodaysDateString();
        this.isRandomMode = false;
        this.boardDataUrl = 'boards.json';
    }

    // Async Initialization Method
    async initialize() {
        // Future: Load board from external source
        await this.loadBoard();
        this.initializeBoard();
        this.setupEventListeners();
        this.loadDailyProgress();
    }

    // Modify the loadBoard method to fetch from JSON
    async loadBoard() {
        if (this.isRandomMode) {
            this.board = this.generateRandomBoard();
        } else {
            try {
                this.board = await this.fetchDailyBoard();
            } catch (error) {
                console.error('Failed to load daily board:', error);
                // Fallback to random board generation if fetch fails
                this.board = this.generateRandomBoard();
            }
        }
    }

    async fetchDailyBoard() {
        // Fetch the JSON file
        const response = await fetch(this.boardDataUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch board data');
        }
        const boardData = await response.json();

        // Find the board for today's date
        const boardForToday = boardData[this.todaysDate];

        if (!boardForToday) {
            throw new Error(`No board found for date: ${this.todaysDate}`);
        }

        // Validate the board structure
        if (!Array.isArray(boardForToday) || 
            boardForToday.length !== 5 || 
            !boardForToday.every(row => row.length === 4)) {
            throw new Error('Invalid board structure');
        }

        return boardForToday;
    }

    // getTodaysDateString() {
    //     const today = new Date();
    //     return today.toISOString().split('T')[0];
    // }

    getTodaysDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

    initializeBoard() {
        // Reset Game State
        this.flippedTiles.clear();
        this.currentPosition = null;
        this.nextGoalTile = 1;
        this.collectedGoals.clear();

        // Reset Mechanics
        this.canMoveDiagonal = false;
        this.hasExtraLife = false;
        this.extraLifeUsed = false;
        this.canSelectAnyGoal = false;
        this.isWarping = false;
        this.isGrappling = false;
        this.grapplePosition = null;

        // Reset Control Flags
        this.isProcessingTurnEnd = false;
        this.isFlipping = false;
        this.showAllTiles = false;

        // Reset Victory Stats
        this.victoryStats = {
            powersUsed: new Set(),
            tilesRevealed: 0
        };

        // Update Try Count
        if (!this.isRandomMode) {
            this.loadDailyAttempts();
            const dailyData = this.loadDailyProgress();
            if (dailyData && dailyData.completed) {
                this.isDailyCompleted = true;
                this.showAllTiles = true;
                this.isProcessingTurnEnd = true;
            } else {
                this.isDailyCompleted = false;
            }
        } else {
            this.tryCount = 1;
            this.isDailyCompleted = false;
        }
        
        // Render and Update
        this.renderBoard();
        this.updateGameState();
        this.hideVictoryModal();
        this.hideHelpModal();
    }

    generateRandomBoard() {
        // Create a default random board generation method
        const tiles = [
            ...Array(6).fill(0),  // Stepping stones
            1, 2, 3, 4, 5,        // Flowers
            6, 7, 8, 9, 10,       // Power-ups
            ...Array(4).fill(11)  // Death tiles
        ];
        
        // Fisher-Yates shuffle
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        // Create 5x4 board
        this.board = Array(5).fill().map((_, i) => 
            tiles.slice(i * 4, (i + 1) * 4)
        );

        return this.board;
    }

    toggleMode() {
        this.isRandomMode = !this.isRandomMode;
        this.initializeBoard();
        this.updateModeDisplay();
    }

    updateModeDisplay() {
        const header = document.querySelector('h1');
        const dailyDateDiv = document.getElementById('dailyDate');
        
        if (this.isRandomMode) {
            header.textContent = "Kuzu's Maze - Practice";
            dailyDateDiv.style.display = 'none';
        } else {
            header.textContent = "Kuzu's Maze";
            dailyDateDiv.style.display = 'block';
            dailyDateDiv.textContent = `Today's Puzzle - ${new Date().toLocaleDateString()}`;
        }
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

    isValidMove(row, col) {
        if (this.isProcessingTurnEnd || this.isFlipping || this.isDailyCompleted) return false;
        
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

    getNextRequiredGoal() {
        for (let i = 1; i <= 5; i++) {
            if (!this.collectedGoals.has(i)) {
                return i;
            }
        }
        return 5;
    }

    updateGameState() {
        document.getElementById('nextGoal').textContent = 
            `Next Goal: ${this.nextGoalTile <= 5 ? this.nextGoalTile : 'Complete!'}`;
        document.getElementById('attemptCounter').textContent = 
            `Attempt: ${this.tryCount}`;
    
        document.getElementById('extraLifeBubble').classList.toggle('hidden', !this.hasExtraLife);
        document.getElementById('anyOrderBubble').classList.toggle('hidden', !this.canSelectAnyGoal);
        document.getElementById('diagonalBubble').classList.toggle('hidden', !this.canMoveDiagonal);
        document.getElementById('warpBubble').classList.toggle('hidden', !this.isWarping);
        document.getElementById('grappleBubble').classList.toggle('hidden', !this.isGrappling);
    
        const buttons = document.querySelectorAll('.control-btn');
        buttons.forEach(button => {
            if (button.id === 'restartBtn' && this.isDailyCompleted) {
                button.disabled = true;
            } else {
                button.disabled = this.isProcessingTurnEnd || this.isFlipping;
            }
        });
    }

    renderBoard() {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';
    
        this.board.forEach((row, rowIndex) => {
            row.forEach((tile, colIndex) => {
                const tileElement = document.createElement('button');
                tileElement.className = 'tile';
                tileElement.setAttribute('data-position', `${rowIndex}-${colIndex}`);
                
                if (this.isDailyCompleted) {
                    tileElement.disabled = true;
                    tileElement.style.cursor = 'default';
                }
                
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
    
                if (this.isValidMove(rowIndex, colIndex) && !this.isProcessingTurnEnd && !this.isFlipping && !this.isDailyCompleted) {
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

    setupEventListeners() {
        document.getElementById('restartBtn').onclick = () => {
            if (!this.isDailyCompleted) {
                this.handleTurnEnd('Starting new attempt...', true);
            }
        };

        document.getElementById('helpBtn').onclick = () => {
            this.showHelpModal();
        };

        document.getElementById('closeHelpBtn').onclick = () => {
            this.hideHelpModal();
        };

        document.getElementById('helpModal').onclick = (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelpModal();
            }
        };
        
        this.updateModeDisplay();
    }

    saveDailyProgress() {
        if (this.isRandomMode) return;
        
        const dailyData = {
            date: this.todaysDate,
            attempts: this.tryCount,
            completed: this.collectedGoals.size === 5,
            completedAttempts: this.collectedGoals.size === 5 ? this.tryCount : null
        };
        
        localStorage.setItem('kuzu-maze-daily', JSON.stringify(dailyData));
    }

    loadDailyProgress() {
        if (this.isRandomMode) return null;
        
        const savedData = localStorage.getItem('kuzu-maze-daily');
        if (savedData) {
            const dailyData = JSON.parse(savedData);
            
            if (dailyData.date === this.todaysDate) {
                if (dailyData.completed) {
                    this.showDailyCompleteMessage();
                }
                return dailyData;
            }
        }
        return null;
    }

    loadDailyAttempts() {
        const dailyData = this.loadDailyProgress();
        if (dailyData && !dailyData.completed) {
            this.tryCount = dailyData.attempts;
        } else if (dailyData && dailyData.completed) {
            this.tryCount = dailyData.completedAttempts;
        } else {
            this.tryCount = 1;
        }
    }

    // Placeholder methods
    // showDailyCompleteMessage() {}
    showDailyCompleteMessage() {
        if (!this.isRandomMode) {
            document.getElementById('dailyComplete').style.display = 'block';
        }
    }

     showVictoryModal() {
        const modal = document.getElementById('victoryModal');
        modal.classList.remove('hidden');
        this.isProcessingTurnEnd = true;

        if (!this.isRandomMode) {
            this.saveDailyProgress();
            this.showDailyCompleteMessage();
            this.isDailyCompleted = true;
        }

        document.getElementById('finalTryCount').textContent = this.tryCount;
        
        const headerText = this.isRandomMode ? 
            '🎉 Congratulations! 🎉' : 
            '🎉 Daily Puzzle Complete! 🎉';
        
        document.querySelector('#victoryModal .modal-header h2').textContent = headerText;
        
        const newGameBtn = document.getElementById('newGameAfterWin');
        if (this.isRandomMode) {
            newGameBtn.textContent = 'New Practice Game';
        } else {
            newGameBtn.textContent = 'Practice Mode';
        }
        
        document.getElementById('closeVictoryBtn').onclick = () => {
            this.hideVictoryModal();
            this.isProcessingTurnEnd = false;
            this.renderBoard();
        };
        
        document.getElementById('copyResultBtn').onclick = () => {
            this.shareResults();
        };
        
        document.getElementById('revealBoardAfterWin').onclick = () => {
            this.hideVictoryModal();
            this.showAllTiles = true;
            this.isProcessingTurnEnd = false;
            this.renderBoard();
        };
        
        document.getElementById('newGameAfterWin').onclick = () => {
            this.hideVictoryModal();
            if (this.isRandomMode) {
                this.initializeBoard();
            } else {
                this.toggleMode();
            }
        };
    }

    shareResults() {
        // Format powers used
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
        
        // Create the message
        const message = `🎉 Victory! 🎉
📊 My Results:
- Attempts: ${this.tryCount}
- Tiles Revealed: ${this.victoryStats.tilesRevealed} out of 20
- Powers Used: ${powersText}

Think you can do better? Try Kuzu's Maze: http://kuzusmaze.com`;

        // Detect if device is likely mobile/tablet
        const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (navigator.maxTouchPoints > 0);
        
        // Use Web Share API only on mobile devices, otherwise always use clipboard
        if (navigator.share && isMobileDevice) {
            navigator.share({
                title: "Kuzu's Maze Victory!",
                text: message
            }).catch(err => {
                console.log('Error sharing:', err);
                this.fallbackShare(message);
            });
        } else {
            // Always use clipboard for desktop/laptop
            this.fallbackShare(message);
        }
    }

    fallbackShare(message) {
        try {
            navigator.clipboard.writeText(message).then(() => {
                const copyBtn = document.getElementById('copyResultBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#10b981';
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = '';
                }, 2000);
            });
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = message;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const copyBtn = document.getElementById('copyResultBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }
    }

    hideVictoryModal() {
        const modal = document.getElementById('victoryModal');
        modal.classList.add('hidden');
        this.isProcessingTurnEnd = false;
    }

    showHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.remove('hidden');
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.add('hidden');
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
                
                this.saveDailyProgress();
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
}

// Async initialization
document.addEventListener('DOMContentLoaded', async () => {
    const game = new TileGame();
    await game.initialize();
});