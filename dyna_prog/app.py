import json
from os.path import basename, dirname, join as join_path
from typing import Any, Dict

from flask import Blueprint, render_template, request

from .dyna_prog import State, gerrymander

APP_NAME = basename(dirname(__file__))

app = Blueprint(
    APP_NAME,
    APP_NAME,
    url_prefix=('/' + APP_NAME),
    static_folder='static',
    static_url_path=join_path('/static', APP_NAME),
    template_folder='templates',
)


@app.route('/')
def root():
    # type: () -> str
    return render_template(join_path(APP_NAME, 'index.html'))


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
    trace = {} # type: Dict[str, Any]
    # list() is necessary here to force the generator to run
    list(gerrymander(state, district_size, {}, trace))
    return json.dumps(trace)
