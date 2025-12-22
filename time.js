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

        // Stored game result for re-opening victory modal
        this.storedGameResult = null;

        // Flag to track if victory modal was shown (prevent duplicate shows)
        this.victoryModalShown = false;
        
        // Flag to track if welcome back modal was shown (prevent duplicate shows)
        this.welcomeBackModalShown = false;

        // Streak tracking
        this.currentStreak = 0;
        this.bestStreak = 0;
        
        // Winning path tracking
        this.winningPath = [];
        
        // Solution data (optimal tiles and powers)
        this.solutionData = null;

        // Board Management
        this.todaysDate = this.getTodaysDateString();
        this.isRandomMode = false;
        this.boardDataUrl = 'boards.json';
    }

    // New method to store game result for potential re-opening of victory modal
    storeGameResult() {
        // Calculate stars and score
        const stars = this.calculateStars();
        const score = this.calculateScore();
        
        const gameResult = {
            tryCount: this.tryCount,
            tilesRevealed: this.victoryStats.tilesRevealed,
            powersUsed: Array.from(this.victoryStats.powersUsed), // Store IDs, not text
            mode: this.isRandomMode ? 'Practice' : 'Daily',
            date: this.todaysDate, // Use same format as todaysDate (YYYY-MM-DD)
            currentStreak: this.currentStreak,
            bestStreak: this.bestStreak,
            winningPath: this.winningPath, // Save winning path for golden borders
            score: score, // Store calculated score (for backwards compatibility)
            stars: stars, // Store star rating
            solutionData: this.solutionData // Store optimal solution for comparison
        };

        // Store in localStorage
        try {
            localStorage.setItem('kuzuMazeLastGameResult', JSON.stringify(gameResult));
        } catch (e) {
            console.error('Failed to store game result in localStorage', e);
        }

        // Also set the instance property
        this.storedGameResult = gameResult;

        return gameResult;
    }

    // Calculate Attempt Score (0-50 points)
    calculateAttemptScore() {
        const attempt = this.tryCount;
        
        if (attempt === 1) return 50;
        if (attempt === 2) return 45;
        if (attempt === 3) return 40;
        if (attempt === 4) return 35;
        if (attempt === 5) return 30;
        if (attempt >= 6 && attempt <= 10) {
            // Linear decrease from 25 to 20
            return 25 - ((attempt - 6) * 1);
        }
        if (attempt >= 11 && attempt <= 15) {
            // Linear decrease from 15 to 10
            return 15 - ((attempt - 11) * 1);
        }
        if (attempt >= 16 && attempt <= 20) {
            // Linear decrease from 5 to 0
            return 5 - ((attempt - 16) * 1);
        }
        
        return 0; // 21+ attempts
    }

    // Calculate Tile Efficiency Score (0-30 points)
    calculateTileScore() {
        const tilesRevealed = this.victoryStats.tilesRevealed;
        
        // Formula: 30 - (((totalTilesRevealed - 5) / 15) * 30)
        // 5 tiles (mandatory flowers): 30 points
        // Gradually reduces to 0 points at 20 tiles
        
        if (tilesRevealed <= 5) return 30;
        if (tilesRevealed >= 20) return 0;
        
        const score = 30 - (((tilesRevealed - 5) / 15) * 30);
        return Math.max(0, Math.round(score));
    }

    // Calculate Power-Up Efficiency Score (0-20 points)
    calculatePowerupScore() {
        let score = 20;
        
        // Deduct points for power-up usage
        const powerupDeductions = {
            6: 3,   // Grapple: -3 points
            7: 5,   // Extra Life: -5 points
            8: 4,   // Diagonal Movement: -4 points
            9: 8,   // Any Order Flower: -8 points
            10: 6   // Portal/Warp: -6 points
        };
        
        this.victoryStats.powersUsed.forEach(powerId => {
            if (powerupDeductions[powerId]) {
                score -= powerupDeductions[powerId];
            }
        });
        
        return Math.max(0, score);
    }

    // Calculate Total Score (0-100 points)
    calculateStars() {
        // If no solution data (random mode or old board format), return 3 stars as default
        if (!this.solutionData) {
            return 3;
        }

        const playerTiles = this.victoryStats.tilesRevealed;
        const playerPowers = this.victoryStats.powersUsed.size;
        const optimalTiles = this.solutionData.tiles;
        const optimalPowers = this.solutionData.powers;

        // 5 STARS: Matched optimal exactly (MAXIMUM)
        if (playerTiles === optimalTiles && playerPowers === optimalPowers) {
            return 5;
        }

        // 4 STARS: One extra tile OR one extra power (with optimal tiles)
        if (playerTiles === optimalTiles + 1 || 
            (playerTiles === optimalTiles && playerPowers === optimalPowers + 1)) {
            return 4;
        }

        // 3 STARS: Close to optimal
        if (playerTiles <= optimalTiles + 3 && playerPowers <= optimalPowers + 2) {
            return 3;
        }

        // 2 STARS: Fair performance
        if (playerTiles <= optimalTiles + 6 && playerPowers <= optimalPowers + 4) {
            return 2;
        }

        // 1 STAR: Completed
        return 1;
    }

    getStarMessage(stars) {
        const messages = {
            5: "Perfect! Matched optimal solution! ⚡",
            4: "Excellent! One step away from perfect! 👍",
            3: "Good job! Can you find a shorter path? 💪",
            2: "Fair! Try to optimize your path. 🎯",
            1: "Puzzle completed! Work on efficiency. 🎲"
        };
        return messages[stars] || messages[1];
    }

    calculateScore() {
        const attemptScore = this.calculateAttemptScore();
        const tileScore = this.calculateTileScore();
        const powerupScore = this.calculatePowerupScore();
        
        const totalScore = attemptScore + tileScore + powerupScore;
        
        return {
            total: totalScore,
            attempt: attemptScore,
            tile: tileScore,
            powerup: powerupScore
        };
    }

    // Method to re-open victory modal with stored result
    reopenVictoryModal() {
        if (!this.storedGameResult) {
            console.log('No stored game result to reopen');
            return;
        }
        
        // Mark that we've shown the modal
        this.victoryModalShown = true;

        const modal = document.getElementById('victoryModal');
        modal.classList.remove('hidden');
        
        // Ensure streak data is loaded into instance variables
        this.loadStreakData();
        
        // Display stars from stored result or recalculate
        let stars = this.storedGameResult.stars;
        if (!stars) {
            // Recalculate stars if not stored (for backwards compatibility)
            // Temporarily set victory stats for calculation
            this.victoryStats.tilesRevealed = this.storedGameResult.tilesRevealed;
            this.victoryStats.powersUsed = new Set(this.storedGameResult.powersUsed);
            this.solutionData = this.storedGameResult.solutionData;
            stars = this.calculateStars();
        }
        
        // Display stars visually
        const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        document.getElementById('victoryStars').textContent = starDisplay;
        
        // Display star text
        const starTexts = {
            5: 'PERFECT! 5 STARS!',
            4: 'EXCELLENT! 4 STARS!',
            3: 'GOOD! 3 STARS!',
            2: 'FAIR! 2 STARS!',
            1: 'COMPLETED! 1 STAR'
        };
        document.getElementById('victoryStarText').textContent = starTexts[stars];
        document.getElementById('victoryStarMessage').textContent = this.getStarMessage(stars);
        
        // Display player performance
        const playerTiles = this.storedGameResult.tilesRevealed;
        const playerPowers = this.storedGameResult.powersUsed.length;
        document.getElementById('victoryPlayerStats').textContent = `${playerTiles} tiles | ${playerPowers} powers`;
        
        // Display optimal solution
        if (this.storedGameResult.solutionData) {
            document.getElementById('victoryOptimalStats').textContent = 
                `${this.storedGameResult.solutionData.tiles} tiles | ${this.storedGameResult.solutionData.powers} powers`;
        } else {
            document.getElementById('victoryOptimalStats').textContent = 'N/A';
        }
        
        // Populate victory modal stats grid using INSTANCE variables (which are current/accurate)
        const gameStats = this.loadGameStats();
        document.getElementById('victoryTotalPlays').textContent = gameStats.totalDays;
        document.getElementById('victoryCurrentStreak').textContent = this.currentStreak;
        document.getElementById('victoryMaxStreak').textContent = this.bestStreak;
        
        // Calculate and display win rate from current game stats
        const winRate = this.calculateWinRate();
        document.getElementById('victoryWinRate').textContent = winRate + '%';
        
        // Generate histograms
        const histData = this.loadHistogramData();
        this.generateHistogram('victoryAttemptsHistogram', histData.attempts, 'attempts', this.tryCount);
        this.generateHistogram('victoryStarsHistogram', histData.stars, 'stars', stars);
        
        // Set header text based on mode
        const headerText = this.storedGameResult.mode === 'Practice' ? 
            'Congratulations!' : 
            'Daily Puzzle Complete!';
        
        document.querySelector('#victoryModal .modal-header h2').textContent = headerText;

        // DON'T set up button handlers here - they should be set once in setupEventListeners
    }

    // Helper method to share results
    shareMessage(message) {
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

    // Async Initialization Method
    async initialize() {
        // Future: Load board from external source
        await this.loadBoard();
        this.initializeBoard();
        this.setupEventListeners();
        this.loadDailyProgress();
        this.loadStreakData(); // Load streak data
        
        // Retrieve any stored game result
        const storedResult = localStorage.getItem('kuzuMazeLastGameResult');
        if (storedResult) {
            try {
                this.storedGameResult = JSON.parse(storedResult);
            } catch (e) {
                console.error('Failed to parse stored game result', e);
            }
        }
        
        // Setup button for reopening victory modal
        this.setupStatsButton();
        
        // Track that this day was played (even if not completed)
        this.trackDayPlayed();
        
        // Auto-show victory modal if today's daily puzzle is completed
        this.checkAndShowVictoryModal();
        
        // Fallback check after a delay (in case first check was too early)
        setTimeout(() => {
            if (!this.victoryModalShown) {
                console.log('Running fallback victory modal check...');
                this.checkAndShowVictoryModal();
            }
        }, 1000);
    }
    
    // Check if today's puzzle is completed and auto-show victory modal
    checkAndShowVictoryModal() {
        if (this.isRandomMode) return;
        
        // Direct check of localStorage instead of relying on method
        const savedData = localStorage.getItem('kuzu-maze-daily');
        if (!savedData) {
            console.log('No daily data found');
            return;
        }
        
        let dailyData;
        try {
            dailyData = JSON.parse(savedData);
        } catch (e) {
            console.error('Failed to parse daily data', e);
            return;
        }
        
        console.log('Daily data:', dailyData);
        console.log('Today\'s date:', this.todaysDate);
        console.log('Stored game result:', this.storedGameResult);
        
        // Check if:
        // 1. Today's daily puzzle is completed
        // 2. We have a stored game result
        // 3. The stored result is from today
        if (dailyData && dailyData.date === this.todaysDate && dailyData.completed) {
            console.log('Puzzle completed, checking for stored result...');
            
            if (this.storedGameResult) {
                // Both dates are now in YYYY-MM-DD format
                const resultDate = this.storedGameResult.date;
                console.log('Result date:', resultDate);
                
                if (resultDate === this.todaysDate) {
                    console.log('Auto-showing victory modal!');
                    // Auto-show the victory modal
                    setTimeout(() => {
                        this.reopenVictoryModal();
                    }, 500); // Small delay for smooth UX
                } else {
                    console.log('Result date mismatch:', resultDate, '!==', this.todaysDate);
                }
            } else {
                console.log('No stored game result found');
            }
        } else if (dailyData && dailyData.date === this.todaysDate && !dailyData.completed && this.tryCount > 1) {
            // Puzzle NOT completed but user has made attempts - show welcome back modal
            // Only show if not already shown
            if (!this.welcomeBackModalShown) {
                console.log('Puzzle in progress, showing welcome back modal');
                this.welcomeBackModalShown = true;
                setTimeout(() => {
                    this.showWelcomeBackModal();
                }, 500);
            } else {
                console.log('Welcome back modal already shown, skipping');
            }
        } else {
            console.log('Conditions not met for auto-popup');
        }
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

        // Store solution data if available
        if (boardForToday.solution) {
            this.solutionData = {
                tiles: boardForToday.solution.tiles_flipped,
                powers: boardForToday.solution.powers_used.length
            };
        }

        // Validate the board structure
        const board = boardForToday.board || boardForToday;
        if (!Array.isArray(board) || 
            board.length !== 5 || 
            !board.every(row => row.length === 4)) {
            throw new Error('Invalid board structure');
        }

        return board;
    }

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
        
        // Reset winning path
        this.winningPath = [];

        // Hide restart button (will show after first move)
        document.getElementById('restartBtn').classList.add('hidden');

        // Update Try Count
        if (!this.isRandomMode) {
            this.loadDailyAttempts();
            const dailyData = this.loadDailyProgress();
            if (dailyData && dailyData.completed) {
                this.isDailyCompleted = true;
                this.showAllTiles = true;
                this.isProcessingTurnEnd = true;
                
                // Show View Results button since puzzle is completed
                document.getElementById('viewResultsBtn').classList.remove('hidden');
                
                // Load winning path from stored game result
                const storedResult = localStorage.getItem('kuzuMazeLastGameResult');
                if (storedResult) {
                    try {
                        const gameResult = JSON.parse(storedResult);
                        if (gameResult.winningPath) {
                            this.winningPath = gameResult.winningPath;
                            console.log('Restored winning path with', this.winningPath.length, 'tiles');
                        }
                    } catch (e) {
                        console.error('Failed to load winning path from game result', e);
                    }
                }
            } else {
                this.isDailyCompleted = false;
                // Try to load saved turn state
                const turnLoaded = this.loadTurnState();
                if (turnLoaded) {
                    console.log('Restored previous turn state');
                }
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
        
        if (this.isRandomMode) {
            header.textContent = "Kuzu's Maze - Practice";
        } else {
            header.textContent = "Kuzu's Maze";
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
                    
                    // Clear turn state on victory
                    this.clearTurnState();
                    
                    // Automatically reveal all tiles and show winning path
                    this.showAllTiles = true;
                    this.renderBoard();
                    
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
        
        // Show restart button after first tile is clicked
        document.getElementById('restartBtn').classList.remove('hidden');
        
        // Add to winning path tracking
        this.winningPath.push(`${row}-${col}`);
        
        await this.flipTile(row, col);
     
        if (this.isWarping) {
            this.isWarping = false;
            this.currentPosition = [row, col];
            const shouldEndTurn = this.handleTileEffect(row, col, tileValue);
            this.updateGameState();
            this.renderBoard();
            
            // Save turn state after warp move (unless won or turn ended)
            if (this.collectedGoals.size < 5 && !shouldEndTurn) {
                this.saveTurnState();
            }
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
     
            let shouldEndTurn = false;
            if (isAdjacent) {
                // Adjacent tile - flip it but stay on grapple tile
                shouldEndTurn = this.handleTileEffect(row, col, tileValue, true);
                if (!shouldEndTurn) {
                    this.currentPosition = this.grapplePosition;
                }
                this.isGrappling = false;
                this.grapplePosition = null;
            } else {
                // Non-adjacent tile - flip it and stay on grapple tile
                shouldEndTurn = this.handleTileEffect(row, col, tileValue, true);
                if (!shouldEndTurn) {
                    this.currentPosition = this.grapplePosition;
                }
                this.isGrappling = false;
                this.grapplePosition = null;
            }
            this.updateGameState();
            this.renderBoard();
            
            // Save turn state after grapple move (unless won or turn ended)
            if (this.collectedGoals.size < 5 && !shouldEndTurn) {
                this.saveTurnState();
            }
            return;
        }
     
        this.currentPosition = [row, col];
        const shouldEndTurn = this.handleTileEffect(row, col, tileValue);
        this.updateGameState();
        this.renderBoard();
        
        // Save turn state after each move (unless won or turn ended)
        if (this.collectedGoals.size < 5 && !shouldEndTurn) {
            this.saveTurnState();
        }
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
            // Never disable modal buttons, help button, stats button, or view results button
            if (button.id === 'closeVictoryBtn' || 
                button.id === 'copyResultBtn' || 
                button.id === 'helpBtn' ||
                button.id === 'closeHelpBtn' ||
                button.id === 'closeWelcomeBtn' ||
                button.id === 'statsBtn' ||
                button.id === 'closeStatsBtn' ||
                button.id === 'viewResultsBtn') {
                button.disabled = false;
            } else if (button.id === 'restartBtn' && this.isDailyCompleted) {
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
                
                // Highlight tiles that were part of the winning path
                if (this.showAllTiles && this.winningPath.includes(`${rowIndex}-${colIndex}`)) {
                    tileElement.classList.add('winning-path');
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

        document.getElementById('viewResultsBtn').onclick = () => {
            this.reopenVictoryModal();
        };

        document.getElementById('helpBtn').onclick = () => {
            this.toggleHelpModal();
        };

        document.getElementById('closeHelpBtn').onclick = () => {
            this.hideHelpModal();
        };

        document.getElementById('helpModal').onclick = (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelpModal();
            }
        };
        
        // Stats modal event listeners
        document.getElementById('closeStatsBtn').onclick = () => {
            this.hideStatsModal();
        };

        document.getElementById('statsModal').onclick = (e) => {
            if (e.target.id === 'statsModal') {
                this.hideStatsModal();
            }
        };
        
        // Victory modal click outside to close
        document.getElementById('victoryModal').onclick = (e) => {
            if (e.target.id === 'victoryModal') {
                this.hideVictoryModal();
            }
        };
        
        // Set up victory modal buttons ONCE
        document.getElementById('closeVictoryBtn').onclick = () => {
            this.hideVictoryModal();
            if (this.isProcessingTurnEnd) {
                this.isProcessingTurnEnd = false;
                this.renderBoard();
            }
        };
        
        document.getElementById('copyResultBtn').onclick = () => {
            // Check if we have stored result (for reopened modal)
            if (this.storedGameResult) {
                // Format powers with emojis
                const powerEmojis = {
                    6: '🪝',  // Grapple
                    7: '🔫',  // Extra Life (Spray) - Squirt Gun
                    8: '✂️',  // Diagonal (Shears)
                    9: '🌼',  // Any Order (Flower Power) - Blossom
                    10: '🌀'  // Warp (Portal)
                };
                
                let powersText = "";
                // Check if powersUsed is an array and has items
                if (Array.isArray(this.storedGameResult.powersUsed) && this.storedGameResult.powersUsed.length > 0) {
                    const powers = this.storedGameResult.powersUsed
                        .sort((a, b) => a - b)
                        .map(power => powerEmojis[power])
                        .filter(emoji => emoji)
                        .join(' ');  // Space between emojis
                    powersText = " " + powers;  // Space before emojis
                } else {
                    powersText = "";  // No powers, no emojis
                }
                
                // Get formatted date (M/D/YY format - no leading zeros, 2-digit year)
                const dateObj = new Date(this.storedGameResult.date);
                const month = dateObj.getMonth() + 1; // No padding
                const day = dateObj.getDate(); // No padding
                const year = String(dateObj.getFullYear()).slice(-2); // Last 2 digits
                const formattedDate = `${month}/${day}/${year}`;
                
                // Convert attempt number to emoji digits
                const attemptEmoji = this.numberToEmoji(this.storedGameResult.tryCount);
                
                let shareMessage = `Kuzu's Maze, ${formattedDate}:\n${attemptEmoji}${powersText}`;
                
                // Add streak ONLY if it's a multiple of 7 (7, 14, 21, etc.) on separate line
                if (this.storedGameResult.mode === 'Daily' && 
                    this.storedGameResult.tryCount <= 20 && 
                    this.storedGameResult.currentStreak > 0 &&
                    this.storedGameResult.currentStreak % 7 === 0) {
                    shareMessage += `\n🔥 ${this.storedGameResult.currentStreak} day streak!`;
                }
                
                this.shareMessage(shareMessage);
            } else {
                // Use current game stats (for initial victory)
                this.shareResults();
            }
        };
        
        // Set up welcome back modal button
        document.getElementById('closeWelcomeBtn').onclick = () => {
            this.hideWelcomeBackModal();
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
    
    saveTurnState() {
        if (this.isRandomMode) return;
        
        // Don't save if puzzle is completed or if in the middle of processing
        if (this.isDailyCompleted || this.isProcessingTurnEnd) return;
        
        const turnState = {
            date: this.todaysDate,
            tryCount: this.tryCount,
            flippedTiles: Array.from(this.flippedTiles),
            winningPath: this.winningPath,
            currentPosition: this.currentPosition,
            collectedGoals: Array.from(this.collectedGoals),
            nextGoalTile: this.nextGoalTile,
            canMoveDiagonal: this.canMoveDiagonal,
            hasExtraLife: this.hasExtraLife,
            extraLifeUsed: this.extraLifeUsed,
            canSelectAnyGoal: this.canSelectAnyGoal,
            isWarping: this.isWarping,
            isGrappling: this.isGrappling,
            grapplePosition: this.grapplePosition,
            victoryStats: {
                powersUsed: Array.from(this.victoryStats.powersUsed),
                tilesRevealed: this.victoryStats.tilesRevealed
            }
        };
        
        localStorage.setItem('kuzu-maze-turn', JSON.stringify(turnState));
    }
    
    loadTurnState() {
        if (this.isRandomMode) return false;
        
        try {
            const savedTurn = localStorage.getItem('kuzu-maze-turn');
            if (!savedTurn) return false;
            
            const turnState = JSON.parse(savedTurn);
            
            // Only load if it's from today
            if (turnState.date !== this.todaysDate) {
                this.clearTurnState();
                return false;
            }
            
            // Restore game state
            this.tryCount = turnState.tryCount;
            this.flippedTiles = new Set(turnState.flippedTiles);
            this.winningPath = turnState.winningPath || [];
            this.currentPosition = turnState.currentPosition;
            this.collectedGoals = new Set(turnState.collectedGoals);
            this.nextGoalTile = turnState.nextGoalTile;
            this.canMoveDiagonal = turnState.canMoveDiagonal;
            this.hasExtraLife = turnState.hasExtraLife;
            this.extraLifeUsed = turnState.extraLifeUsed;
            this.canSelectAnyGoal = turnState.canSelectAnyGoal;
            this.isWarping = turnState.isWarping;
            this.isGrappling = turnState.isGrappling;
            this.grapplePosition = turnState.grapplePosition;
            
            if (turnState.victoryStats) {
                this.victoryStats = {
                    powersUsed: new Set(turnState.victoryStats.powersUsed),
                    tilesRevealed: turnState.victoryStats.tilesRevealed
                };
            }
            
            // Show restart button if tiles have been flipped
            if (this.flippedTiles.size > 0) {
                document.getElementById('restartBtn').classList.remove('hidden');
            }
            
            return true;
        } catch (e) {
            console.error('Failed to load turn state', e);
            return false;
        }
    }
    
    clearTurnState() {
        if (this.isRandomMode) return;
        localStorage.removeItem('kuzu-maze-turn');
    }

    loadDailyProgress() {
        if (this.isRandomMode) return null;
        
        const savedData = localStorage.getItem('kuzu-maze-daily');
        if (savedData) {
            const dailyData = JSON.parse(savedData);
            
            if (dailyData.date === this.todaysDate) {
                // Daily data matches today's date
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

    // Streak management methods
    loadStreakData() {
        if (this.isRandomMode) return;
        
        try {
            const streakData = localStorage.getItem('kuzu-maze-streak');
            if (streakData) {
                const data = JSON.parse(streakData);
                this.currentStreak = data.currentStreak || 0;
                this.bestStreak = data.bestStreak || 0;
                return data;
            }
        } catch (e) {
            console.error('Failed to load streak data', e);
        }
        
        this.currentStreak = 0;
        this.bestStreak = 0;
        return null;
    }

    saveStreakData() {
        if (this.isRandomMode) return;
        
        try {
            const streakData = {
                currentStreak: this.currentStreak,
                bestStreak: this.bestStreak,
                lastCompletedDate: this.todaysDate
            };
            localStorage.setItem('kuzu-maze-streak', JSON.stringify(streakData));
        } catch (e) {
            console.error('Failed to save streak data', e);
        }
    }

    // Game stats methods (total days played, wins)
    loadGameStats() {
        if (this.isRandomMode) return { totalDays: 0, wins: 0, daysPlayed: [], winDays: [] };
        
        try {
            const statsData = localStorage.getItem('kuzu-maze-game-stats');
            if (statsData) {
                const data = JSON.parse(statsData);
                return {
                    totalDays: data.totalDays || 0,
                    wins: data.wins || 0,
                    daysPlayed: data.daysPlayed || [],
                    winDays: data.winDays || []
                };
            }
        } catch (e) {
            console.error('Failed to load game stats', e);
        }
        
        return { totalDays: 0, wins: 0, daysPlayed: [], winDays: [] };
    }

    saveGameStats(isWin) {
        if (this.isRandomMode) return;
        
        try {
            const stats = this.loadGameStats();
            
            // Track unique days played
            if (!stats.daysPlayed.includes(this.todaysDate)) {
                stats.daysPlayed.push(this.todaysDate);
                stats.totalDays = stats.daysPlayed.length;
            }
            
            // Check if we've already recorded a win for today
            const winDays = stats.winDays || [];
            const alreadyWonToday = winDays.includes(this.todaysDate);
            
            // Track wins (completed in 20 or less attempts)
            // Only increment if this is a win AND we haven't already recorded it today
            if (isWin && this.tryCount <= 20 && !alreadyWonToday) {
                stats.wins++;
                winDays.push(this.todaysDate);
            }
            
            const statsData = {
                totalDays: stats.totalDays,
                wins: stats.wins,
                daysPlayed: stats.daysPlayed,
                winDays: winDays
            };
            
            localStorage.setItem('kuzu-maze-game-stats', JSON.stringify(statsData));
        } catch (e) {
            console.error('Failed to save game stats', e);
        }
    }

    calculateWinRate() {
        const stats = this.loadGameStats();
        if (stats.totalDays === 0) return 0;
        return Math.round((stats.wins / stats.totalDays) * 100);
    }

    // Histogram data methods
    loadHistogramData() {
        if (this.isRandomMode) return { attempts: [], stars: [] };
        
        try {
            const histData = localStorage.getItem('kuzu-maze-histogram-data');
            if (histData) {
                const data = JSON.parse(histData);
                // Migrate old data: if scores exist but stars don't, initialize stars array
                if (data.scores && !data.stars) {
                    data.stars = [];
                }
                // If neither exists, initialize both
                if (!data.attempts) data.attempts = [];
                if (!data.stars) data.stars = [];
                return data;
            }
        } catch (e) {
            console.error('Failed to load histogram data', e);
        }
        
        return { attempts: [], stars: [] };
    }

    saveHistogramData(attempts, stars) {
        if (this.isRandomMode) return;
        
        try {
            const data = this.loadHistogramData();
            
            // Add new entry (keep all games ever)
            data.attempts.push(attempts);
            data.stars.push(stars);
            
            localStorage.setItem('kuzu-maze-histogram-data', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save histogram data', e);
        }
    }

    generateHistogram(containerId, data, type, currentValue = null) {
        const container = document.getElementById(containerId);
        if (!container || !data || data.length === 0) {
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #9ca3af; font-size: 0.7rem; padding: 1rem 0;">No data yet</p>';
            }
            return;
        }
        
        // Define bucket ranges based on type
        let buckets, bucketLabels;
        
        if (type === 'attempts') {
            // Attempts: 1-5, 6-10, 11-15, 16-20, 20+ (low to high)
            buckets = [0, 0, 0, 0, 0];
            bucketLabels = ['1-5', '6-10', '11-15', '16-20', '20+'];
            
            data.forEach(value => {
                if (value >= 1 && value <= 5) buckets[0]++;
                else if (value >= 6 && value <= 10) buckets[1]++;
                else if (value >= 11 && value <= 15) buckets[2]++;
                else if (value >= 16 && value <= 20) buckets[3]++;
                else if (value > 20) buckets[4]++;
            });
        } else if (type === 'stars') {
            // Stars: 5, 4, 3, 2, 1 (high to low - reversed!)
            buckets = [0, 0, 0, 0, 0];
            bucketLabels = ['⭐⭐⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐', '⭐⭐', '⭐'];
            
            data.forEach(value => {
                if (value === 5) buckets[0]++;
                else if (value === 4) buckets[1]++;
                else if (value === 3) buckets[2]++;
                else if (value === 2) buckets[3]++;
                else if (value === 1) buckets[4]++;
            });
        } else {
            // Score: 81-100, 61-80, 41-60, 21-40, 1-20 (high to low - reversed!)
            buckets = [0, 0, 0, 0, 0];
            bucketLabels = ['81-100', '61-80', '41-60', '21-40', '1-20'];
            
            data.forEach(value => {
                if (value >= 81 && value <= 100) buckets[0]++;
                else if (value >= 61 && value <= 80) buckets[1]++;
                else if (value >= 41 && value <= 60) buckets[2]++;
                else if (value >= 21 && value <= 40) buckets[3]++;
                else if (value >= 1 && value <= 20) buckets[4]++;
            });
        }
        
        // Find max count for scaling
        const maxCount = Math.max(...buckets, 1);
        
        // Determine which bucket contains current value
        let currentBucketIndex = null;
        if (currentValue !== null) {
            if (type === 'attempts') {
                if (currentValue >= 1 && currentValue <= 5) currentBucketIndex = 0;
                else if (currentValue >= 6 && currentValue <= 10) currentBucketIndex = 1;
                else if (currentValue >= 11 && currentValue <= 15) currentBucketIndex = 2;
                else if (currentValue >= 16 && currentValue <= 20) currentBucketIndex = 3;
                else if (currentValue > 20) currentBucketIndex = 4;
            } else if (type === 'stars') {
                // Stars bucket indices (reversed order: 5 at top)
                if (currentValue === 5) currentBucketIndex = 0;
                else if (currentValue === 4) currentBucketIndex = 1;
                else if (currentValue === 3) currentBucketIndex = 2;
                else if (currentValue === 2) currentBucketIndex = 3;
                else if (currentValue === 1) currentBucketIndex = 4;
            } else {
                // Score bucket indices (reversed order)
                if (currentValue >= 81 && currentValue <= 100) currentBucketIndex = 0;
                else if (currentValue >= 61 && currentValue <= 80) currentBucketIndex = 1;
                else if (currentValue >= 41 && currentValue <= 60) currentBucketIndex = 2;
                else if (currentValue >= 21 && currentValue <= 40) currentBucketIndex = 3;
                else if (currentValue >= 1 && currentValue <= 20) currentBucketIndex = 4;
            }
        }
        
        // Generate HTML (horizontal bars)
        container.innerHTML = buckets.map((count, index) => {
            const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const isHighlight = index === currentBucketIndex;
            return `
                <div class="histogram-bar">
                    <span class="histogram-label">${bucketLabels[index]}</span>
                    <div class="histogram-bar-fill ${isHighlight ? 'highlight' : ''}" 
                         style="width: ${width}%;">
                        ${count > 0 ? `<span class="histogram-count">${count}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    trackDayPlayed() {
        if (this.isRandomMode) return;
        
        try {
            const stats = this.loadGameStats();
            
            // Track unique days played (even if not completed)
            if (!stats.daysPlayed.includes(this.todaysDate)) {
                stats.daysPlayed.push(this.todaysDate);
                stats.totalDays = stats.daysPlayed.length;
                
                const statsData = {
                    totalDays: stats.totalDays,
                    wins: stats.wins,
                    daysPlayed: stats.daysPlayed
                };
                
                localStorage.setItem('kuzu-maze-game-stats', JSON.stringify(statsData));
            }
        } catch (e) {
            console.error('Failed to track day played', e);
        }
    }

    updateStreak() {
        if (this.isRandomMode || this.tryCount > 20) return;
        
        const streakData = this.loadStreakData();
        
        if (!streakData || !streakData.lastCompletedDate) {
            // First time completing
            this.currentStreak = 1;
            this.bestStreak = 1;
        } else {
            const lastDate = new Date(streakData.lastCompletedDate);
            const today = new Date(this.todaysDate);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const lastDateStr = lastDate.toISOString().split('T')[0];
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastDateStr === yesterdayStr) {
                // Consecutive day - increment streak
                this.currentStreak++;
                if (this.currentStreak > this.bestStreak) {
                    this.bestStreak = this.currentStreak;
                }
            } else if (lastDateStr === this.todaysDate) {
                // Already completed today - keep current streak
                this.currentStreak = streakData.currentStreak;
                this.bestStreak = streakData.bestStreak;
            } else {
                // Streak broken - reset to 1
                this.currentStreak = 1;
                if (this.bestStreak === 0) {
                    this.bestStreak = 1;
                }
            }
        }
        
        this.saveStreakData();
    }

    // Placeholder methods (dailyComplete message removed)

     showVictoryModal() {
        const modal = document.getElementById('victoryModal');
        modal.classList.remove('hidden');
        this.isProcessingTurnEnd = true;

        if (!this.isRandomMode) {
            this.updateStreak(); // Update streak before saving
            this.saveDailyProgress();
            this.isDailyCompleted = true;
            
            // Save game stats (total days played, wins)
            // Win = completed in 20 or less attempts
            const isWin = this.tryCount <= 20;
            this.saveGameStats(isWin);
        }

        // Hide restart button and all power-up bubbles on victory
        document.getElementById('restartBtn').classList.add('hidden');
        document.getElementById('extraLifeBubble').classList.add('hidden');
        document.getElementById('diagonalBubble').classList.add('hidden');
        document.getElementById('warpBubble').classList.add('hidden');
        document.getElementById('grappleBubble').classList.add('hidden');
        
        // Show View Results button
        document.getElementById('viewResultsBtn').classList.remove('hidden');

        // Store the game result for potential re-opening
        this.storeGameResult();

        // Setup the stats button
        this.setupStatsButton();

        // Calculate and display stars
        const stars = this.calculateStars();
        const starMessage = this.getStarMessage(stars);
        
        // Display stars visually
        const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        document.getElementById('victoryStars').textContent = starDisplay;
        
        // Display star text
        const starTexts = {
            5: 'PERFECT! 5 STARS!',
            4: 'EXCELLENT! 4 STARS!',
            3: 'GOOD! 3 STARS!',
            2: 'FAIR! 2 STARS!',
            1: 'COMPLETED! 1 STAR'
        };
        document.getElementById('victoryStarText').textContent = starTexts[stars];
        document.getElementById('victoryStarMessage').textContent = starMessage;
        
        // Display player performance
        const playerTiles = this.victoryStats.tilesRevealed;
        const playerPowers = this.victoryStats.powersUsed.size;
        document.getElementById('victoryPlayerStats').textContent = `${playerTiles} tiles | ${playerPowers} powers`;
        
        // Display optimal solution
        if (this.solutionData) {
            document.getElementById('victoryOptimalStats').textContent = 
                `${this.solutionData.tiles} tiles | ${this.solutionData.powers} powers`;
        } else {
            document.getElementById('victoryOptimalStats').textContent = 'N/A';
        }

        // Populate victory modal stats grid
        const gameStats = this.loadGameStats();
        document.getElementById('victoryTotalPlays').textContent = gameStats.totalDays;
        document.getElementById('victoryCurrentStreak').textContent = this.currentStreak;
        document.getElementById('victoryMaxStreak').textContent = this.bestStreak;
        
        // Calculate and display win rate
        const winRate = this.calculateWinRate();
        document.getElementById('victoryWinRate').textContent = winRate + '%';
        
        // Save histogram data (attempts and stars)
        if (!this.isRandomMode) {
            this.saveHistogramData(this.tryCount, stars);
        }
        
        // Generate histograms
        const histData = this.loadHistogramData();
        this.generateHistogram('victoryAttemptsHistogram', histData.attempts, 'attempts', this.tryCount);
        this.generateHistogram('victoryStarsHistogram', histData.stars, 'stars', stars);
        
        const headerText = this.isRandomMode ? 
            'Congratulations!' : 
            'Daily Puzzle Complete!';
        
        document.querySelector('#victoryModal .modal-header h2').textContent = headerText;
        
        // Button handlers are set up once in setupEventListeners, not here
    }

    // Helper function to convert number to emoji digits
    numberToEmoji(num) {
        const digitEmojis = {
            '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
            '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
        };
        return String(num).split('').map(digit => digitEmojis[digit] || digit).join('');
    }

    shareResults() {
        // Format powers used with emojis
        const powerEmojis = {
            6: '🪝',  // Grapple
            7: '🔫',  // Extra Life (Spray) - Squirt Gun
            8: '✂️',  // Diagonal (Shears)
            9: '🌼',  // Any Order (Flower Power) - Blossom
            10: '🌀'  // Warp (Portal)
        };
        
        let powersText = "";
        if (this.victoryStats.powersUsed.size === 0) {
            powersText = "";  // No powers, no emojis
        } else {
            const powers = Array.from(this.victoryStats.powersUsed)
                .sort((a, b) => a - b) // Sort by power ID for consistent order
                .map(power => powerEmojis[power])
                .filter(emoji => emoji)
                .join(' ');  // Space between emojis
            powersText = " " + powers;  // Space before emojis
        }
        
        // Get formatted date (M/D/YY format - no leading zeros, 2-digit year)
        const dateObj = new Date(this.todaysDate);
        const month = dateObj.getMonth() + 1; // No padding
        const day = dateObj.getDate(); // No padding
        const year = String(dateObj.getFullYear()).slice(-2); // Last 2 digits
        const formattedDate = `${month}/${day}/${year}`;
        
        // Convert attempt number to emoji digits
        const attemptEmoji = this.numberToEmoji(this.tryCount);
        
        // Get stars
        const stars = this.calculateStars();
        const starDisplay = '⭐'.repeat(stars);
        
        // Create the message in two-line format with comma (no bullseye)
        let message = `Kuzu's Maze, ${formattedDate}:\n${attemptEmoji}${powersText}\n${starDisplay}`;

        // Add streak info ONLY if it's a multiple of 7 (7, 14, 21, etc.) on separate line
        if (!this.isRandomMode && this.tryCount <= 20 && this.currentStreak > 0 && this.currentStreak % 7 === 0) {
            message += `\n🔥 ${this.currentStreak} day streak!`;
        }

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
        // Don't remove the processing turn end flag if puzzle is completed
        // This prevents the board from being interactive after completion
        if (!this.isDailyCompleted) {
            this.isProcessingTurnEnd = false;
        }
    }

    showStatsModal() {
        // Load current streak data
        this.loadStreakData();
        
        // Load game stats
        const gameStats = this.loadGameStats();
        const winRate = this.calculateWinRate();
        
        // Update the stats display
        document.getElementById('statsTotalPlays').textContent = gameStats.totalDays;
        document.getElementById('statsWinRate').textContent = winRate + '%';
        document.getElementById('statsCurrentStreak').textContent = this.currentStreak;
        document.getElementById('statsMaxStreak').textContent = this.bestStreak;
        
        // Generate histograms (without highlighting current value)
        const histData = this.loadHistogramData();
        this.generateHistogram('statsAttemptsHistogram', histData.attempts, 'attempts', null);
        this.generateHistogram('statsStarsHistogram', histData.stars, 'stars', null);
        
        // Show the modal
        const modal = document.getElementById('statsModal');
        modal.classList.remove('hidden');
    }

    hideStatsModal() {
        const modal = document.getElementById('statsModal');
        modal.classList.add('hidden');
    }

    // Method to setup Stats button
    setupStatsButton() {
        // Remove any existing stats buttons first
        const existingButton = document.getElementById('statsBtn');
        if (existingButton) {
            existingButton.remove();
        }

        // Create stats button
        const statsButton = document.createElement('button');
        statsButton.id = 'statsBtn';
        statsButton.textContent = 'Stats';
        statsButton.className = 'control-btn';
        
        // Always make the button visible
        statsButton.style.display = 'block';
        
        // Add click event to show stats modal
        statsButton.onclick = () => {
            this.showStatsModal();
        };
        
        // Add to the header controls
        const header = document.querySelector('header .controls');
        if (header) {
            // Append the button at the end of the controls
            header.appendChild(statsButton);
        }

        return statsButton;
    }

    showHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.remove('hidden');
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.add('hidden');
    }

    toggleHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal.classList.contains('hidden')) {
            this.showHelpModal();
        } else {
            this.hideHelpModal();
        }
    }

    showWelcomeBackModal() {
        if (this.isRandomMode) return;
        
        const dailyData = this.loadDailyProgress();
        
        // Only show if:
        // 1. Daily puzzle exists
        // 2. Not completed
        // 3. tryCount > 1 (they've made at least one attempt)
        if (dailyData && !dailyData.completed && this.tryCount > 1) {
            const modal = document.getElementById('welcomeBackModal');
            document.getElementById('welcomeAttemptNumber').textContent = this.tryCount;
            modal.classList.remove('hidden');
            
            console.log('Showing welcome back modal for attempt', this.tryCount);
        }
    }

    hideWelcomeBackModal() {
        const modal = document.getElementById('welcomeBackModal');
        modal.classList.add('hidden');
    }

    handleTurnEnd(message, shouldResetBoard = false) {
        this.isProcessingTurnEnd = true;
        
        // Clear turn state when turn ends
        this.clearTurnState();
        
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
                
                // Reset winning path
                this.winningPath = [];
                
                // Hide restart button for new attempt
                document.getElementById('restartBtn').classList.add('hidden');
                
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
    
    // Make game globally accessible for debugging
    window.game = game;
    console.log('Game initialized. Access via window.game');
});