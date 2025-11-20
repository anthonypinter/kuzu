import json
import random
from datetime import datetime, timedelta

def seeded_random(seed):
    """Create a seeded random number generator."""
    random.seed(seed)
    return random.random

def generate_board(date_string):
    """
    Generate a 5x4 board with specific tile distribution:
    - 1 each of tiles 1-5
    - 1 of each special tile (6, 7, 8, 9, 10)
    - 4 death tiles (11)
    - 6 stepping stones (0)
    """
    # Create the base tile set
    tiles = [
        0, 0, 0, 0, 0, 0,  # 6 stepping stones
        1, 2, 3, 4, 5,      # 1 of each numbered flower
        6, 7, 8, 9, 10,     # 1 of each special tile
        11, 11, 11, 11      # 4 death tiles
    ]
    
    # Use the date as a seed for reproducibility
    random.seed(date_string)
    
    # Shuffle the tiles
    random.shuffle(tiles)
    
    # Convert to 5x4 board
    board = [tiles[i:i+4] for i in range(0, 20, 4)]
    
    return board

def generate_daily_boards(start_date='2025-11-18', num_boards=500):
    """Generate a dictionary of daily boards."""
    boards = {}
    
    current_date = datetime.strptime(start_date, '%Y-%m-%d')
    
    for _ in range(num_boards):
        # Convert date to string in YYYY-MM-DD format
        date_string = current_date.strftime('%Y-%m-%d')
        
        # Generate board for this date
        boards[date_string] = generate_board(date_string)
        
        # Move to next day
        current_date += timedelta(days=1)
    
    return boards

# Generate the boards
daily_boards = generate_daily_boards()

# Output to JSON file
with open('daily_boards.json', 'w') as f:
    json.dump(daily_boards, f, indent=4)

print(f"Generated {len(daily_boards)} daily boards and saved to /mnt/user-data/outputs/daily_boards.json")

# Verify the first few boards
for date, board in list(daily_boards.items())[:3]:
    print(f"\nBoard for {date}:")
    for row in board:
        print(row)
    
    # Validate tile distribution
    flat_board = [tile for row in board for tile in row]
    tile_counts = {
        0: flat_board.count(0),
        1: flat_board.count(1),
        2: flat_board.count(2),
        3: flat_board.count(3),
        4: flat_board.count(4),
        5: flat_board.count(5),
        6: flat_board.count(6),
        7: flat_board.count(7),
        8: flat_board.count(8),
        9: flat_board.count(9),
        10: flat_board.count(10),
        11: flat_board.count(11)
    }
    print("\nTile Distribution:")
    for tile, count in tile_counts.items():
        print(f"Tile {tile}: {count}")