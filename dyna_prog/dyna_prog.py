"""A dynamic programming gerrymandering optimizer."""

from collections import namedtuple

from typing import Any, Generator, Tuple, List, Set, Dict

State = namedtuple('State', 'rows, cols, grid')

Index = int
IntDistrict = Tuple[Index, ...]
IntDistricts = Tuple[IntDistrict, ...]

Coord = Tuple[int, int]
CoordDistrict = Tuple[Coord, ...]
CoordDistricts = Tuple[CoordDistrict, ...]

CacheKey = Tuple[State, int]


def populated_neighbors(index, state):
    # type: (Index, State) -> List[Index]
    result = [index - state.cols, index + state.cols]
    if index % state.cols != 0:
        result.append(index - 1)
    if (index + 1) % state.cols != 0:
        result.append(index + 1)
    return [index for index in result if 0 <= index < len(state.grid) and state.grid[index] != '-']


def all_first_districts(state, size):
    # type: (State, int) -> Generator[IntDistrict, None, None]

    tried = set() # type: Set[IntDistrict]

    def all_first_districts_of_size(frontier, district):
        # type: (Set[Index], Tuple[Index, ...]) -> Generator[IntDistrict, None, None]
        for index in sorted(frontier):
            new_district = tuple(sorted([*district, index]))
            if new_district in tried:
                continue
            tried.add(new_district)
            if len(new_district) == size:
                yield new_district
            else:
                yield from all_first_districts_of_size(
                    (frontier | set(populated_neighbors(index, state))) - set(new_district),
                    new_district,
                )

    root_index = min(state.grid.find('B'), state.grid.find('R'))
    if root_index == -1:
        return
    yield from all_first_districts_of_size(set([root_index]), tuple())


def is_connected(state):
    # type: (State) -> bool
    root_index = min(state.grid.find('B'), state.grid.find('R'))
    if root_index == -1:
        return True
    visited = set() # type: Set[Index]
    frontier = [root_index]
    while frontier:
        index = frontier.pop(0)
        if index in visited:
            continue
        visited.add(index)
        frontier.extend(populated_neighbors(index, state))
    return len(visited) == sum(1 for char in state.grid if char in 'BR')


def remove_district(state, district):
    # type: (State, IntDistrict) -> State
    indices = set(district)
    return State(
        state.rows,
        state.cols,
        ''.join(('-' if i in indices else c) for i, c in enumerate(state.grid)),
    )


def score_partition(partition, state):
    # type: (IntDistricts, State) -> Tuple[int, int]
    wins = 0
    draws = 0
    half = len(partition[0]) / 2
    for district in partition:
        district_count = sum(
            1 for index in district
            if state.grid[index] == 'B'
        )
        if district_count > half:
            wins += 1
        elif district_count == half:
            draws += 1
    return (wins, draws)


def state_as_districts(state):
    # type: (State) -> IntDistricts
    return (
        tuple(index for index, char in enumerate(state.grid) if char != '-'),
    )


def index_to_coord(index, state):
    # type: (Index, State) -> Coord
    return (index // state.cols, index % state.cols)


def districts_to_map(state, districts):
    # type: (State, IntDistricts) -> Dict[str, Any]
    district_map = {} # type: Dict[Coord, int]
    coord_districts = [] # type: List[CoordDistrict]
    for district_id, district in enumerate(districts):
        coord_district = tuple(index_to_coord(index, state) for index in district)
        for coord in coord_district:
            district_map[coord] = district_id
        coord_districts.append(coord_district)
    borders = [] # type: List[str]
    for row in range(state.rows):
        for col in range(1, state.cols):
            if district_map.get((row, col - 1), -1) != district_map.get((row, col), -1):
                borders.append(f'{row}-{col - 1}-{row}-{col}')
    for col in range(state.cols):
        for row in range(1, state.rows):
            if district_map.get((row - 1, col), -1) != district_map.get((row, col), -1):
                borders.append(f'{row - 1}-{col}-{row}-{col}')
    return {
        'districts': tuple(coord_districts),
        'borders': borders,
    }


def gerrymander(state, district_size, cache, trace, depth=0):
    # type: (State, int, Dict[CacheKey, List[IntDistricts]], Dict[str, Any], int) -> Generator[IntDistricts, None, None]
    trace['depth'] = depth
    trace['state'] = districts_to_map(state, state_as_districts(state))
    trace['calls'] = [] # type: List[Dict[str, Any]]
    trace['partitions'] = [] # type: List[Dict[str, Any]]
    cache_key = (state, district_size)
    if cache_key not in cache:
        partitions = set()
        if sum(1 for char in state.grid if char in 'BR') == district_size:
            partitions.add(state_as_districts(state))
        else:
            for first_district in all_first_districts(state, district_size):
                next_state = remove_district(state, first_district)
                if not is_connected(next_state):
                    continue
                sub_trace = {} # type: Dict[str, Any]
                sub_partitions = gerrymander(next_state, district_size, cache, sub_trace, depth + 1)
                trace['calls'].append({
                    'first_district': districts_to_map(state, (first_district,)),
                    'sub_trace': sub_trace,
                })
                for sub_partition in sub_partitions:
                    partitions.add(tuple(sorted((first_district, ) + sub_partition)))
        partitions_list = sorted(partitions)
        scores = [score_partition(partition, state) for partition in partitions_list]
        best_score = max(scores)
        cache[cache_key] = [
            partition for partition, score
            in zip(partitions_list, scores)
            if score == best_score
        ]
    trace['partitions'] = list(districts_to_map(state, partition) for partition in cache[cache_key])
    yield from cache[cache_key]
