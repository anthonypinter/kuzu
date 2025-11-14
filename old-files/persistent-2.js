class PersistentTileGame extends TileGame {
    constructor() {
        // Call parent constructor first
        super();

        // New properties for persistent mode
        this.playerInitials = '';
        this.topScores = [];

        // Setup event listeners specific to persistent mode
        this.setupPersistentModeListeners();

        // Load top scores from localStorage
        this.loadTopScores();

        // Show initials modal on first load
        this.showPlayerInitialsModal();
    }

    // Method to show player initials modal
    showPlayerInitialsModal() {
        const playerInitialsModal = document.getElementById('playerInitialsModal');
        const startGameBtn = document.getElementById('startGameBtn');
        const playerInitialsInput = document.getElementById('playerInitialsInput');

        playerInitialsModal.classList.remove('hidden');

        startGameBtn.onclick = () => {
            const initials = playerInitialsInput.value.trim().toUpperCase();
            
            // Validate initials (1-3 characters)
            if (initials.length > 0 && initials.length <= 3) {
                this.playerInitials = initials;
                document.getElementById('currentPlayerInitials').textContent = initials;
                playerInitialsModal.classList.add('hidden');
                
                // Reset game state for new player
                this.tryCount = 1;
                this.updateGameState();
            } else {
                alert('Please enter 1-3 initials');
            }
        };
    }

    // Override showVictoryModal to match persistent mode requirements
    showVictoryModal() {
        const victoryModal = document.getElementById('victoryModal');
        const finalTryCountSpan = document.getElementById('finalTryCount');

        // Show final attempt count
        finalTryCountSpan.textContent = this.tryCount;

        // Hide game board
        document.getElementById('gameBoard').style.display = 'none';

        // Show victory modal
        victoryModal.classList.remove('hidden');

        // Setup victory modal buttons
        document.getElementById('closeVictoryBtn').onclick = () => {
            this.hideVictoryModal();
            this.showPlayerInitialsModal();
        };

        document.getElementById('newGameAfterWin').onclick = () => {
            this.hideVictoryModal();
            this.showPlayerInitialsModal();
        };
    }

    // Method to load top scores from localStorage
    loadTopScores() {
        const savedScores = localStorage.getItem('kuzuMazeTopScores');
        this.topScores = savedScores ? JSON.parse(savedScores) : [];
        this.updateScoreTable();
    }

    // Method to save top scores to localStorage
    saveTopScores() {
        if (this.playerInitials && this.tryCount) {
            // Add current player's score
            this.topScores.push({
                initials: this.playerInitials,
                attempts: this.tryCount
            });

            // Sort scores by attempts (lowest first)
            this.topScores.sort((a, b) => a.attempts - b.attempts);

            // Keep only top 10 scores
            this.topScores = this.topScores.slice(0, 10);

            // Save to localStorage
            localStorage.setItem('kuzuMazeTopScores', JSON.stringify(this.topScores));
            
            // Update score table
            this.updateScoreTable();
        }
    }

    // Method to update score table in the UI
    updateScoreTable() {
        const scoreTableBody = document.getElementById('scoreTableBody');
        scoreTableBody.innerHTML = '';

        this.topScores.forEach((score, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${score.initials}</td>
                <td>${score.attempts}</td>
            `;
            scoreTableBody.appendChild(row);
        });
    }

    // Override handleTileClick to save scores when game is completed
    async handleTileClick(row, col) {
        await super.handleTileClick(row, col);

        // If game is completed (all 5 flowers collected)
        if (this.collectedGoals.size === 5) {
            this.saveTopScores();
        }
    }

    // Setup additional event listeners for persistent mode
    setupPersistentModeListeners() {
        // Add any additional event listeners specific to persistent mode
    }

    // Override existing methods as needed to support persistent mode
    hideVictoryModal() {
        const victoryModal = document.getElementById('victoryModal');
        victoryModal.classList.add('hidden');
        
        // Restore game board visibility
        document.getElementById('gameBoard').style.display = '';
    }
}

// Replace the default game initialization with persistent mode
document.addEventListener('DOMContentLoaded', () => {
    new PersistentTileGame();
});