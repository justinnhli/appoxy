"""A dynamic programming gerrymandering optimizer."""

from typing import Any, Generator, Tuple, NamedTuple, List, Set, Dict

District = Tuple[int, ...]
Districts = Tuple[District, ...]

State = NamedTuple('State', (('rows', int), ('cols', int), ('grid', str)))
RecursiveCall = NamedTuple('RecursiveCall', (('first_district', District), ('sub_trace', 'Trace')))
Trace = NamedTuple('Trace', (
    ('depth', int),
    ('state', State),
    ('calls', List[RecursiveCall]),
    ('partitions', List[Districts]),
))

CacheKey = Tuple[State, int]


def populated_neighbors(index, state):
    # type: (int, State) -> List[int]
    result = [index - state.cols, index + state.cols]
    if index % state.cols != 0:
        result.append(index - 1)
    if (index + 1) % state.cols != 0:
        result.append(index + 1)
    return [index for index in result if 0 <= index < len(state.grid) and state.grid[index] != '-']


def first_populated_block(state):
    # type: (State) -> int
    indices = [state.grid.find(char) for char in 'BR']
    return min(index for index in indices if index != -1)


def all_first_districts(state, size):
    # type: (State, int) -> Generator[District, None, None]

    tried = set() # type: Set[District]

    def all_first_districts_of_size(frontier, district):
        # type: (Set[int], Tuple[int, ...]) -> Generator[District, None, None]
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

    root_index = first_populated_block(state)
    if root_index == -1:
        return
    yield from all_first_districts_of_size(set([root_index]), tuple())


def is_connected(state):
    # type: (State) -> bool
    root_index = first_populated_block(state)
    if root_index == -1:
        return True
    visited = set() # type: Set[int]
    frontier = [root_index]
    while frontier:
        index = frontier.pop(0)
        if index in visited:
            continue
        visited.add(index)
        frontier.extend(populated_neighbors(index, state))
    return len(visited) == sum(1 for char in state.grid if char in 'BR')


def remove_district(state, district):
    # type: (State, District) -> State
    indices = set(district)
    return State(
        state.rows,
        state.cols,
        ''.join(('-' if i in indices else c) for i, c in enumerate(state.grid)),
    )


def score_partition(partition, state):
    # type: (Districts, State) -> Tuple[int, int]
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
    # type: (State) -> Districts
    return (
        tuple(index for index, char in enumerate(state.grid) if char != '-'),
    )


def gerrymander(state, district_size):
    # type: (State, int) -> Trace

    def _gerrymander(state, district_size, cache, depth=0):
        # type: (State, int, Dict[CacheKey, List[Districts]], int) -> Trace
        cache_key = (state, district_size)
        calls = [] # type: List[RecursiveCall]
        if cache_key not in cache:
            partitions = set()
            if sum(1 for char in state.grid if char in 'BR') == district_size:
                partitions.add(state_as_districts(state))
            else:
                for first_district in all_first_districts(state, district_size):
                    next_state = remove_district(state, first_district)
                    if not is_connected(next_state):
                        continue
                    sub_trace = _gerrymander(next_state, district_size, cache, depth + 1)
                    calls.append(RecursiveCall(first_district, sub_trace))
                    for sub_partition in sub_trace.partitions:
                        partitions.add(tuple(sorted((first_district, ) + sub_partition)))
            partitions_list = sorted(partitions)
            scores = [score_partition(partition, state) for partition in partitions_list]
            best_score = max(scores)
            cache[cache_key] = [
                partition for partition, score
                in zip(partitions_list, scores)
                if score == best_score
            ]
        return Trace(depth, state, calls, cache[cache_key])

    return _gerrymander(state, district_size, {})
