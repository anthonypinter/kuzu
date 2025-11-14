 const tileImage = document.createElement('img');
        tileImage.className = 'tile-image';
        tileImage.draggable = false; // Prevents drag behavior
        tileImage.loading = 'eager'; // Ensures immediate loading for game pieces

        class TileGame {
            constructor() {
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
                this.isMobile = window.innerWidth <= 480;
                this.isFlipping = false;
            
                this.initializeBoard();
                this.setupEventListeners();
                
                // Add resize listener to handle orientation changes
                window.addEventListener('resize', () => {
                    const wasMobile = this.isMobile;
                    this.isMobile = window.innerWidth <= 480;
                    if (wasMobile !== this.isMobile) {
                        this.initializeBoard();
                    }
                });
            }

            initializeBoard() {
                this.tryCount = 1;

                const tiles = [
                    ...Array(6).fill(0),
                    1, 2, 3, 4, 5,
                    6, 7, 8, 9, 10,
                    ...Array(4).fill(11)
                ];
                
                for (let i = tiles.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
                }

                if (window.innerWidth <= 480) {
                    // Mobile: 5 rows x 4 columns
                    this.board = Array(5).fill().map((_, i) => 
                        tiles.slice(i * 4, (i + 1) * 4)
                    );
                } else {
                    // Desktop: 4 rows x 5 columns
                    this.board = Array(4).fill().map((_, i) => 
                        tiles.slice(i * 5, (i + 1) * 5)
                    );
                }

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
                
                this.renderBoard();
                this.updateGameState();
                this.hideVictoryModal();
                this.hideHelpModal();
            }

            getTileImage(value) {
                const images = {
                    unflipped: './src/unflipped.svg',
            0: './src/walkthrough.svg',
            1: './src/flower1.svg',
            2: './src/flower2.svg',
            3: './src/flower3.svg',
            4: './src/flower4.svg',
            5: './src/flower5.svg',
            6: './src/grapple.svg',
            7: './src/extralife.svg',
            8: './src/diagonal.svg',
            9: './src/ooflower.svg',
            10: './src/warp.svg',
            11: './src/death.svg'
                };
                return images[value] || images.unflipped;
            }

            isValidMove(row, col) {
                if (this.isProcessingTurnEnd || this.isFlipping) return false;
                
                if (this.isWarping) {
                    return !this.flippedTiles.has(`${row}-${col}`);
                }
            
                if (this.isGrappling) {
                    const [currentRow, currentCol] = this.currentPosition;
                    
                    // First check if it's a normal move
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
                    
                    // If not adjacent, treat as grapple
                    return !this.flippedTiles.has(`${row}-${col}`);
                }

                // Check if it's the first move
                if (this.currentPosition === null) {
                    if (this.isMobile) {
                        // Check each edge for mobile layout (4 columns x 5 rows)
                        const lastRow = this.board.length - 1;
                        const lastCol = this.board[0].length - 1;
                        
                        return (row === 0 || row === lastRow) || // Top or bottom row
                               (col === 0 || col === lastCol);  // First or last column
                    } else {
                        // Desktop layout (5 columns x 4 rows)
                        return row === 0 || row === 3 || col === 0 || col === 4;
                    }
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

                    // Update the back face image after half the animation
                    setTimeout(() => {
                        const backFace = tileElement.querySelector('.tile-face-back img');
                        if (backFace) {
                            backFace.src = this.getTileImage(this.board[row][col]);
                        }
                    }, 150); // Half of the 300ms animation

                    // Complete the animation
                    setTimeout(() => {
                        tileElement.classList.remove('flipping');
                        this.isFlipping = false;
                        resolve();
                    }, 300);
                });
            }

            async resetTileAnimations() {
                const tilesToReset = Array.from(this.flippedTiles).map(pos => {
                    const [row, col] = pos.split('-').map(Number);
                    return { row, col, element: document.querySelector(`[data-position="${row}-${col}"]`) };
                }).filter(tile => tile.element);

                // Start all reset animations simultaneously
                const resetPromises = tilesToReset.map(({ row, col, element }) => {
                    return new Promise((resolve) => {
                        element.classList.add('resetting');
                        
                        // Reset the back face to unflipped state after half the animation
                        setTimeout(() => {
                            const backFace = element.querySelector('.tile-face-back img');
                            if (backFace) {
                                backFace.src = this.getTileImage('unflipped');
                            }
                        }, 200); // Half of the 400ms reset animation

                        setTimeout(() => {
                            element.classList.remove('resetting');
                            resolve();
                        }, 400);
                    });
                });

                // Wait for all animations to complete
                await Promise.all(resetPromises);
            }

            handleTurnEnd(message, shouldResetBoard = false) {
                this.isProcessingTurnEnd = true;
                
                this.currentPosition = null;
                this.renderBoard();
                
                setTimeout(async () => {
                    if (shouldResetBoard) {
                        // Play reset animations
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
                    }
                    this.isProcessingTurnEnd = false;
                    this.updateGameState();
                    this.renderBoard();
                }, 1500);
            }

            showVictoryModal() {
                const modal = document.getElementById('victoryModal');
                modal.classList.remove('hidden');
                this.isProcessingTurnEnd = true;

                document.getElementById('finalTryCount').textContent = this.tryCount;
                
                document.getElementById('closeVictoryBtn').onclick = () => {
                    this.hideVictoryModal();
                    this.isProcessingTurnEnd = false;
                    this.renderBoard();
                };
                
                document.getElementById('revealBoardAfterWin').onclick = () => {
                    this.hideVictoryModal();
                    this.showAllTiles = true;
                    this.isProcessingTurnEnd = false;
                    this.renderBoard();
                };
                
                document.getElementById('newGameAfterWin').onclick = () => {
                    this.hideVictoryModal();
                    this.initializeBoard();
                };
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
                    this.isGrappling = true;
                    this.grapplePosition = [row, col];
                    return false;
                }
             
                switch (tileValue) {
                    case 7:
                        this.hasExtraLife = true;
                        this.extraLifeUsed = false;
                        break;
             
                    case 8:
                        this.canMoveDiagonal = true;
                        break;
             
                    case 9:
                        this.canSelectAnyGoal = true;
                        break;
             
                    case 10:
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
                
                // Play flip animation
                await this.flipTile(row, col);
             
                if (this.isWarping) {
                    this.isWarping = false;
                    this.currentPosition = [row, col];
                    const shouldEnd = this.handleTileEffect(row, col, tileValue);
                    if (!shouldEnd) {
                        // Warp message
                    }
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
                        // Handle normal move from grapple tile
                        this.isGrappling = false;
                        this.grapplePosition = null;
                        this.currentPosition = [row, col];
                        this.handleTileEffect(row, col, tileValue);
                    } else {
                        // Handle grapple effect
                        const shouldEnd = this.handleTileEffect(row, col, tileValue, true);
                        if (!shouldEnd) {
                            this.currentPosition = this.grapplePosition;
                        }
                        // Only reset grapple state after successful use
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
                    button.disabled = this.isProcessingTurnEnd || this.isFlipping;
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
                        
                        // Create tile inner container for 3D flip
                        const tileInner = document.createElement('div');
                        tileInner.className = 'tile-inner';
                        
                        // Create front face (unflipped state)
                        const frontFace = document.createElement('div');
                        frontFace.className = 'tile-face tile-face-front';
                        const frontImage = document.createElement('img');
                        frontImage.className = 'tile-image';
                        frontImage.src = this.getTileImage('unflipped');
                        frontFace.appendChild(frontImage);
                        
                        // Create back face (revealed state)
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

            setupEventListeners() {
                document.getElementById('restartBtn').onclick = () => {
                    this.handleTurnEnd('Starting new attempt...', true);
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
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            new TileGame();
        });
