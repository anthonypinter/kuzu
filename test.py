import json
import sys
from typing import List, Dict, Tuple, Set
from dataclasses import dataclass, field
import copy
import heapq
import time

@dataclass(order=False)
class SearchState:
    board: List[List[int]]
    current_position: Tuple[int, int] = None
    flipped_tiles: Set[Tuple[int, int]] = field(default_factory=set)
    collected_goals: Set[int] = field(default_factory=set)
    next_goal: int = 1
    
    # Power-up tracking
    powers_used_set: Set[int] = field(default_factory=set)
    can_move_diagonal: bool = False
    extra_life_available: bool = False
    can_select_any_goal: bool = False
    
    # Path tracking
    path: List[Tuple[int, int]] = field(default_factory=list)
    
    # Optimization metrics
    tiles_flipped: int = 0
    
    def __lt__(self, other):
        # Primary sort: fewer tiles flipped
        # Secondary sort: fewer powers used
        return (self.tiles_flipped, len(self.powers_used_set)) < \
               (other.tiles_flipped, len(other.powers_used_set))

class SolutionFinder:
    def __init__(self, board: List[List[int]]):
        self.board = board
        self.rows = len(board)
        self.cols = len(board[0])
        self.start_time = time.time()
    
    def is_valid_move(self, state: SearchState, new_row: int, new_col: int) -> bool:
        # Check board bounds
        if not (0 <= new_row < self.rows and 0 <= new_col < self.cols):
            return False
        
        # Prevent moving through death tiles
        if self.board[new_row][new_col] == 11:
            return False
        
        # First move must be from board edge
        if state.current_position is None:
            return (new_row == 0 or new_row == self.rows - 1 or 
                    new_col == 0 or new_col == self.cols - 1)
        
        # Check move validity based on current position
        current_row, current_col = state.current_position
        
        # Orthogonal moves
        orthogonal_move = (
            (abs(new_row - current_row) == 1 and new_col == current_col) or
            (abs(new_col - current_col) == 1 and new_row == current_row)
        )
        
        # Diagonal moves (if diagonal power is active)
        diagonal_move = (
            state.can_move_diagonal and 
            abs(new_row - current_row) == 1 and 
            abs(new_col - current_col) == 1
        )
        
        # Prevent immediate backtracking
        if len(state.path) > 1 and state.path[-2] == (new_row, new_col):
            return False
        
        return orthogonal_move or diagonal_move
    
    def find_optimal_solutions(self) -> List[Dict]:
        # Initialize search
        initial_state = SearchState(
            board=self.board,
            current_position=None,
            flipped_tiles=set(),
            collected_goals=set(),
            next_goal=1,
            powers_used_set=set(),
            can_move_diagonal=False,
            extra_life_available=False,
            can_select_any_goal=False,
            path=[],
            tiles_flipped=0
        )
        
        # Priority queue for state exploration
        states_to_explore = []
        heapq.heappush(states_to_explore, initial_state)
        
        best_solution = None
        min_tiles_flipped = float('inf')
        
        # Explored states to prevent revisiting
        explored_states = set()
        explored_count = 0
        max_explored = 500000  # Increased exploration limit
        
        while states_to_explore and explored_count < max_explored:
            current_state = heapq.heappop(states_to_explore)
            explored_count += 1
            
            # Goal reached
            if len(current_state.collected_goals) == 5:
                if current_state.tiles_flipped < min_tiles_flipped:
                    best_solution = current_state
                    min_tiles_flipped = current_state.tiles_flipped
                continue
            
            # Generate next possible moves
            next_states = self.generate_next_states(current_state)
            
            for next_state in next_states:
                # Avoid revisiting states
                state_key = self.get_state_key(next_state)
                if state_key not in explored_states:
                    explored_states.add(state_key)
                    heapq.heappush(states_to_explore, next_state)
        
        # Convert to desired output format
        if best_solution:
            return [{
                "tiles_flipped": best_solution.tiles_flipped,
                "powers_used": list(best_solution.powers_used_set),
                "path": list(best_solution.path)
            }]
        
        return []
    
    def generate_next_states(self, current_state: SearchState) -> List[SearchState]:
        next_states = []
        
        # Define possible move directions
        move_directions = [
            (0, 1),   # right
            (0, -1),  # left
            (1, 0),   # down
            (-1, 0)   # up
        ]
        
        # If diagonal movement power is active, add diagonal moves first
        if current_state.can_move_diagonal:
            diagonal_directions = [
                (1, 1),    # down-right
                (1, -1),   # down-left
                (-1, 1),   # up-right
                (-1, -1)   # up-left
            ]
            move_directions = diagonal_directions + move_directions
        
        # Determine current position (start from board edge if no current position)
        current_pos = current_state.current_position or (0, 0)
        
        for d_row, d_col in move_directions:
            new_row = current_pos[0] + d_row
            new_col = current_pos[1] + d_col
            
            # Check if move is valid
            if self.is_valid_move(current_state, new_row, new_col):
                # Create a new state for this move
                new_state = copy.deepcopy(current_state)
                
                # Flip tile if not already flipped
                if (new_row, new_col) not in new_state.flipped_tiles:
                    new_state.flipped_tiles.add((new_row, new_col))
                    new_state.tiles_flipped += 1
                
                new_state.current_position = (new_row, new_col)
                new_state.path.append((new_row, new_col))
                
                # Apply tile effect for newly flipped tile
                tile_value = self.board[new_row][new_col]
                new_state = self.apply_tile_effect(new_state, (new_row, new_col), tile_value)
                
                next_states.append(new_state)
        
        return next_states
    
    def apply_tile_effect(self, state, pos, tile_value):
    # Stepping stone (0) - no effect
        if tile_value == 0:
            return state
        
        # Flower tiles (1-5)
        if 1 <= tile_value <= 5:
            # Check if flower can be collected
            if state.can_select_any_goal:
                # Out-of-order power allows collecting the next flower regardless of order
                state.collected_goals.add(tile_value)
                state.can_select_any_goal = False
                state.powers_used_set.add(9)
                state.next_goal = self.get_next_required_goal(state)
            elif tile_value == state.next_goal:
                state.collected_goals.add(tile_value)
                state.next_goal = self.get_next_required_goal(state)
            else:
                # Cannot collect out of order
                return state
        
        # Power-up tiles
        elif tile_value == 8:  # Diagonal
            state.can_move_diagonal = True
            state.powers_used_set.add(8)
        
        elif tile_value == 9:  # Out of Order
            if not state.can_select_any_goal:
                state.can_select_any_goal = True
                state.powers_used_set.add(9)
        
        elif tile_value == 7:  # Extra Life
            state.extra_life_available = True
            state.powers_used_set.add(7)
        
        elif tile_value == 10:  # Warp
            state.powers_used_set.add(10)
        
        return state
    
    def get_next_required_goal(self, state: SearchState) -> int:
        for goal in range(1, 6):
            if goal not in state.collected_goals:
                return goal
        return 5  # All goals collected
    
    def get_state_key(self, state: SearchState) -> Tuple:
        return (
            state.current_position,
            frozenset(state.flipped_tiles),
            frozenset(state.collected_goals),
            state.next_goal,
            state.can_move_diagonal,
            state.extra_life_available,
            state.can_select_any_goal
        )

def solve_maze(board):
    solver = SolutionFinder(board)
    return solver.find_optimal_solutions()

def main(json_file, date=None):
    # Read JSON file
    with open(json_file, 'r') as f:
        board_data = json.load(f)
    
    # If no specific date is provided, use the first (and likely only) date in the file
    if date is None:
        if len(board_data) == 1:
            date = list(board_data.keys())[0]
        else:
            print("Please specify a date. Available dates:")
            print(list(board_data.keys()))
            return
    
    # Get the board for the specified date
    if date not in board_data:
        print(f"No board found for date: {date}")
        print("Available dates:")
        print(list(board_data.keys()))
        return
    
    board = board_data[date]['board']

    print(f"Solving Maze for {date}:")
    for row in board:
        print(row)
    # print("\nOptimal Solutions:")

    solutions = solve_maze(board)

    if not solutions:
        print("No solutions found.")
        return

    solution = solutions[0]
    print("Optimal Solution:")
    print("Tiles Flipped:", solution['tiles_flipped'])
    print("Powers Used:", solution['powers_used'])
    print("Path:", solution['path'])

if __name__ == "__main__":
    # Allow running with command-line arguments
    if len(sys.argv) < 2:
        print("Usage: python script.py <path_to_json_file> [date]")
        sys.exit(1)
    
    json_file = sys.argv[1]
    date = sys.argv[2] if len(sys.argv) > 2 else None
    
    main(json_file, date)