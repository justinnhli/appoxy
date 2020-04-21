import json
from os.path import basename, dirname, join as join_path
from typing import Any, Tuple, List, Dict

from flask import Blueprint, render_template, request

from .dyna_prog import Districts, State, Trace, gerrymander, state_as_districts

APP_NAME = basename(dirname(__file__))

app = Blueprint(
    APP_NAME,
    APP_NAME,
    url_prefix=('/' + APP_NAME),
    static_folder='static',
    static_url_path=join_path('/static', APP_NAME),
    template_folder='templates',
)


Coord = Tuple[int, int]
CoordDistrict = Tuple[Coord, ...]
CoordDistricts = Tuple[CoordDistrict, ...]


@app.route('/')
def root():
    # type: () -> str
    return render_template(join_path(APP_NAME, 'index.html'))


def index_to_coord(index, state):
    # type: (int, State) -> Coord
    return (index // state.cols, index % state.cols)


def districts_to_map(state, districts):
    # type: (State, Districts) -> Dict[str, Any]
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


def to_jsonable(trace):
    # type: (Trace) -> Dict[str, Any]
    return {
        'depth': trace.depth,
        'state': districts_to_map(trace.state, state_as_districts(trace.state)),
        'calls': [
            {
                'first_district': districts_to_map(trace.state, (first_district,)),
                'sub_trace': to_jsonable(sub_trace),
            } for first_district, sub_trace in trace.calls
        ],
        'partitions': [
            districts_to_map(trace.state, partition)
            for partition in trace.partitions
        ],
    }


@app.route('/solve', methods=['POST'])
def solve():
    # type: () -> str
    data = json.loads(request.get_data())

    demographics = data['demographics']
    num_rows = len(demographics)
    num_cols = len(demographics[0])

    grid = ''.join(''.join(row) for row in demographics)
    grid_size = sum(1 for char in grid if char in 'BR')
    # FIXME check divisibility here
    district_size = grid_size // data['num_districts']

    state = State(num_rows, num_cols, grid)
    trace = gerrymander(state, district_size)
    return json.dumps(to_jsonable(trace))
