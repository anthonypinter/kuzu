import json
import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Set, Optional
from copy import deepcopy

class GameState:
    """Represents a complete game state during exploration."""
    def __init__(self, position, flipped_tiles, collected_flowers, next_flower, 
                 diagonal_active, spray_active, flower_power_active, 
                 powers_used, path, neutralized_tiles):
        self.position = position
        self.flipped_tiles = flipped_tiles  # Set of (row, col) tuples
        self.collected_flowers = collected_flowers  # Set of flower numbers
        self.next_flower = next_flower
        self.diagonal_active = diagonal_active
        self.spray_active = spray_active
        self.flower_power_active = flower_power_active
        self.powers_used = powers_used  # Set of power-up tile values used
        self.path = path  # List of (row, col) positions visited
        self.neutralized_tiles = neutralized_tiles  # Set of neutralized death tiles
        
    def copy(self):
        """Create a deep copy of the state."""
        return GameState(
            self.position,
            self.flipped_tiles.copy(),
            self.collected_flowers.copy(),
            self.next_flower,
            self.diagonal_active,
            self.spray_active,
            self.flower_power_active,
            self.powers_used.copy(),
            self.path.copy(),
            self.neutralized_tiles.copy()
        )
    
    def get_signature(self):
        """Get a hashable signature for state comparison."""
        return (
            self.position,
            frozenset(self.flipped_tiles),
            frozenset(self.collected_flowers),
            self.next_flower,
            self.diagonal_active,
            self.spray_active,
            self.flower_power_active
        )
    
    def is_valid_move(self, next_pos, board_solver):
        """Check if move from current position to next_pos is valid."""
        current_row, current_col = self.position
        next_row, next_col = next_pos
        
        # Check diagonal movement
        row_diff = abs(next_row - current_row)
        col_diff = abs(next_col - current_col)
        
        # Movement must be orthogonal or diagonal (if diagonal active)
        is_valid_move = (
            (row_diff == 1 and col_diff == 0) or  # Vertical move
            (row_diff == 0 and col_diff == 1) or  # Horizontal move
            (self.diagonal_active and row_diff == 1 and col_diff == 1)  # Diagonal move
        )
        
        # If move is not orthogonal/diagonal, it is invalid
        if not is_valid_move:
            return False
        
        # Determine path tiles with precise tracking
        path_tiles = []
        
        # Horizontal move
        if current_row == next_row:
            start_col, end_col = min(current_col, next_col), max(current_col, next_col)
            path_tiles = [(current_row, c) for c in range(start_col + 1, end_col)]
        
        # Vertical move
        elif current_col == next_col:
            start_row, end_row = min(current_row, next_row), max(current_row, next_row)
            path_tiles = [(r, current_col) for r in range(start_row + 1, end_row)]
        
        # Diagonal move (when diagonal is active)
        elif self.diagonal_active:
            row_step = 1 if next_row > current_row else -1
            col_step = 1 if next_col > current_col else -1
            r, c = current_row + row_step, current_col + col_step
            while (r, c) != next_pos:
                path_tiles.append((r, c))
                r += row_step if r != next_row else 0
                c += col_step if c != next_col else 0
        
        # Check path tiles for death tiles
        for path_tile in path_tiles:
            tile_value = board_solver.get_tile(path_tile[0], path_tile[1])
            # Completely block movement if death tile is in path
            if tile_value == 11:
                return False
        
        # Get tile value at destination
        dest_tile_value = board_solver.get_tile(next_row, next_col)
        
        # Cannot move onto a death tile 
        if dest_tile_value == 11:
            return False
        
        # Cannot revisit non-stepping stone tiles
        if next_pos in self.flipped_tiles:
            # Only stepping stones (0) can be revisited
            if dest_tile_value != 0:
                return False
        
        return True

class BoardSolver:
    def __init__(self, board: List[List[int]]):
        self.board = board
        self.height = len(board)
        self.width = len(board[0])
        
    def is_edge_tile(self, row: int, col: int) -> bool:
        """Check if a tile is on the board's edge."""
        return (row == 0 or row == self.height - 1 or 
                col == 0 or col == self.width - 1)
    
    def get_tile(self, row: int, col: int) -> int:
        """Get the tile value at a position."""
        return self.board[row][col]
    
    def get_adjacent_positions(self, row: int, col: int, diagonal: bool) -> List[Tuple[int, int]]:
        """Get valid adjacent positions."""
        positions = [
            (row-1, col), (row+1, col),  # Vertical
            (row, col-1), (row, col+1)   # Horizontal
        ]
        
        if diagonal:
            positions.extend([
                (row-1, col-1), (row-1, col+1),  # Diagonal
                (row+1, col-1), (row+1, col+1)
            ])
        
        return [
            (r, c) for (r, c) in positions 
            if 0 <= r < self.height and 0 <= c < self.width
        ]
    
    def solve(self) -> Dict:
        """Find the optimal solution for the board using BFS."""
        # Find all edge starting positions
        start_positions = [
            (r, c) for r in range(self.height) 
            for c in range(self.width) 
            if self.is_edge_tile(r, c)
        ]
        
        solutions = []
        
        # Explore from each starting position
        for start_pos in start_positions:
            queue = []
            visited = set()
            
            initial_state = GameState(
                position=start_pos,
                flipped_tiles={start_pos},
                collected_flowers=set(),
                next_flower=1,
                diagonal_active=False,
                spray_active=False,
                flower_power_active=False,
                powers_used=set(),
                path=[start_pos],
                neutralized_tiles=set()
            )
            
            # Process the starting tile's effect
            starting_states = self.process_tile_effect(initial_state, is_initial=True)
            queue.extend(starting_states)
            
            iteration = 0
            max_iterations = 100000
            
            while queue and iteration < max_iterations:
                iteration += 1
                current_state = queue.pop(0)
                
                # Check signature to avoid revisiting
                sig = current_state.get_signature()
                if sig in visited:
                    continue
                visited.add(sig)
                
                # Check win condition
                if len(current_state.collected_flowers) == 5:
                    solutions.append(current_state)
                    continue
                
                # Get adjacent positions
                adjacent = self.get_adjacent_positions(
                    current_state.position[0], current_state.position[1], 
                    current_state.diagonal_active
                )
                
                for next_pos in adjacent:
                    # Use is_valid_move from the state itself
                    if current_state.is_valid_move(next_pos, self):
                        new_state = current_state.copy()
                        new_state.position = next_pos
                        
                        # Process the tile effect at the new position
                        resulting_states = self.process_tile_effect(new_state)
                        queue.extend(resulting_states)
        
        # Select optimal solution
        if not solutions:
            return {
                'tiles_flipped': -1,
                'powers_used': [],
                'path': [],
                'error': 'No solution found'
            }
        
        # Sort by tiles flipped, then by number of powers used
        solutions.sort(key=lambda s: (len(s.flipped_tiles), len(s.powers_used)))
        best = solutions[0]
        
        return {
            'tiles_flipped': len(best.flipped_tiles),
            'powers_used': sorted(list(best.powers_used)),
            'path': best.path
        }

    def process_tile_effect(self, state: GameState, is_initial=False) -> List[GameState]:
        """Process the effect of the current tile and return possible next states."""
        row, col = state.position
        tile_value = self.get_tile(row, col)
        
        # Add to path (tracks all moves including revisits)
        if not is_initial:
            state.path.append(state.position)
        
        # If this is a new tile, add it to flipped tiles (counts unique tiles only)
        if state.position not in state.flipped_tiles:
            state.flipped_tiles.add(state.position)
        
        new_states = []
        
        # Stepping stone (0) - just continue
        if tile_value == 0:
            new_states.append(state)
        
        # Flowers (1-5)
        elif tile_value in {1, 2, 3, 4, 5}:
            # Check if we can collect this flower
            can_collect = False
            
            if state.flower_power_active:
                # Flower power allows any flower, but is consumed
                can_collect = True
                state.flower_power_active = False
            elif tile_value == state.next_flower:
                # Correct sequence
                can_collect = True
                
                # Refill spray when collecting correct flower
                if state.next_flower > 1:  # Not the first flower
                    state.spray_active = True
            
            if can_collect:
                state.collected_flowers.add(tile_value)
                if tile_value == state.next_flower:
                    state.next_flower += 1
                new_states.append(state)
            # If can't collect, turn ends (return empty list)
        
        # Spray/Extra Life (7)
        elif tile_value == 7:
            state.spray_active = True
            state.powers_used.add(7)
            new_states.append(state)
        
        # Diagonal (8)
        elif tile_value == 8:
            state.diagonal_active = True
            state.powers_used.add(8)
            new_states.append(state)
        
        # Flower Power (9)
        elif tile_value == 9:
            state.flower_power_active = True
            state.powers_used.add(9)
            new_states.append(state)
        
        # Portal/Warp (10)
        elif tile_value == 10:
            state.powers_used.add(10)
            
            # Can warp to any unrevealed tile
            for r in range(self.height):
                for c in range(self.width):
                    if (r, c) not in state.flipped_tiles:
                        warp_state = state.copy()
                        warp_state.position = (r, c)
                        warp_state.flipped_tiles.add((r, c))
                        new_states.append(warp_state)
        
        # Death tile (11)
        elif tile_value == 11:
            if state.spray_active:
                # Neutralize and continue
                state.spray_active = False
                state.neutralized_tiles.add(state.position)
                new_states.append(state)
            # Otherwise turn ends (return empty list)
        
        return new_states

def generate_board(date_string: str) -> List[List[int]]:
    """Generate a 5x4 board with specific tile distribution."""
    tiles = [
        0, 0, 0, 0, 0, 0,  # 6 stepping stones
        1, 2, 3, 4, 5,      # 1 of each numbered flower
        6, 7, 8, 9, 10,     # 1 of each special tile
        11, 11, 11, 11      # 4 death tiles
    ]
    
    random.seed(date_string)
    random.shuffle(tiles)
    
    return [tiles[i:i+4] for i in range(0, 20, 4)]

def generate_daily_boards(start_date='2025-01-01', num_boards=100):
    """Generate daily boards with solutions."""
    boards = {}
    
    current_date = datetime.strptime(start_date, '%Y-%m-%d')
    
    for i in range(num_boards):
        date_string = current_date.strftime('%Y-%m-%d')
        
        print(f"Generating board {i+1}/{num_boards} for {date_string}...")
        
        board = generate_board(date_string)
        solver = BoardSolver(board)
        solution = solver.solve()
        
        boards[date_string] = {
            'board': board,
            'solution': solution
        }
        
        current_date += timedelta(days=1)
    
    return boards

# Generate the boards
print("Starting board generation...")
daily_boards = generate_daily_boards('2025-12-23', 100)

# Output to JSON file
output_path = 'boards.json'
with open(output_path, 'w') as f:
    json.dump(daily_boards, f, indent=4)

print(f"\nGenerated {len(daily_boards)} daily boards and saved to {output_path}")

# Verify the first few boards
print("\n" + "="*60)
print("Sample Boards:")
print("="*60)

for date, board_data in list(daily_boards.items())[:3]:
    print(f"\nDate: {date}")
    print("Board:")
    for row in board_data['board']:
        print("  " + str(row))
    print("Solution:")
    solution = board_data['solution']
    print(f"  Tiles flipped: {solution['tiles_flipped']}")
    print(f"  Powers used: {solution['powers_used']}")
    
    # Print path with board positions for clarity
    print("  Path (row, col):")
    for pos in solution['path']:
        tile_value = board_data['board'][pos[0]][pos[1]]
        print(f"    {pos} (tile value: {tile_value})")
    
    if 'error' in solution:
        print(f"  Error: {solution['error']}")