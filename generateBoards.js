function generateDailyBoards(startDateString = '2025-01-01', boardCount = 100) {
    // Seeded random number generator
    function seededRandom(seed) {
        let state = 0;
        for (let i = 0; i < seed.length; i++) {
            state = ((state << 5) - state) + seed.charCodeAt(i);
            state = state & state; // Convert to 32-bit integer
        }
        
        return function() {
            state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
            return state / Math.pow(2, 32);
        };
    }

    // Function to generate a single board for a specific date
    function generateBoard(dateString) {
        const random = seededRandom(dateString);
        
        // Base tile set: 1 each of 1-10, 4 of 11, 6 of 0
        const tiles = [
            0, 0, 0, 0, 0, 0,
            1, 2, 3, 4, 5,
            6, 7, 8, 9, 10,
            11, 11, 11, 11
        ];

        // Fisher-Yates shuffle
        for (let i = tiles.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }

        // Convert 1D array to 5x4 board
        const board = [];
        for (let i = 0; i < 5; i++) {
            board.push(tiles.slice(i * 4, (i + 1) * 4));
        }

        return board;
    }

    // Generate boards for consecutive dates
    const boards = {};
    const startDate = new Date(startDateString);

    for (let i = 0; i < boardCount; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dateString = currentDate.toISOString().split('T')[0];
        boards[dateString] = generateBoard(dateString);
    }

    return boards;
}

// Example usage:
const dailyBoards = generateDailyBoards('2025-01-01', 100);

// Optional: log or use the boards
console.log(JSON.stringify(dailyBoards, null, 2));

// If you want to save to localStorage (optional)
localStorage.setItem('dailyBoards', JSON.stringify(dailyBoards));