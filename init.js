initializeBoard() {
        // ALWAYS get the current date first
    const currentDate = this.getTodaysDateString();
    
    // Check if date has changed
    if (this.todaysDate !== currentDate) {
        console.log('New day detected! Updating from', this.todaysDate, 'to', currentDate);
        this.todaysDate = currentDate;
        this.dailySeed = this.generateDailySeed(); // CRITICAL: Regenerate seed for new day!
        this.clearDailyProgress();
        this.isDailyCompleted = false;
    }

    const tiles = [
        ...Array(6).fill(0),
        1, 2, 3, 4, 5,
        6, 7, 8, 9, 10,
        ...Array(4).fill(11)
    ];
    
    let randomFunc = this.isRandomMode ? Math.random : this.seededRandom(this.dailySeed);
    
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(randomFunc() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    if (window.innerWidth <= 480) {
        this.board = Array(5).fill().map((_, i) => 
            tiles.slice(i * 4, (i + 1) * 4)
        );
    } else {
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
    
    // Reset victory stats
    this.victoryStats = {
        powersUsed: new Set(),
        tilesRevealed: 0
    };
    
    if (!this.isRandomMode) {
        this.loadDailyAttempts();
        // Check if TODAY'S daily is completed (after clearing old data)
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
    
    this.renderBoard();
    this.updateGameState();
    this.hideVictoryModal();
    this.hideHelpModal();
}