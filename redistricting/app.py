import json
from os.path import basename, dirname, join as join_path
from time import time

from flask import Blueprint, render_template, request

from .redistricting import json_to_graph, Cell, ObjectiveWalker, solve_optimally, create_district_map

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
    return render_template(join_path(APP_NAME, 'index.html'))


@app.route('/solve', methods=['POST'])
def solve():
    data = json.loads(request.get_data())
    graph = json_to_graph(data['demographics'])
    if not data['use_demographics']:
        defaults = {
            'population': 1,
            'races': [100, 100, 100, 100],
        }
        for node_id in graph:
            cell = graph.nodes[node_id]['cell']
            if cell.red_percent > cell.blue_percent:
                new_cell = Cell(*cell._replace(parties=[100, 0], **defaults))
            elif cell.red_percent < cell.blue_percent:
                new_cell = Cell(*cell._replace(parties=[0, 100], **defaults))
            else:
                new_cell = Cell(*cell._replace(**defaults))
            graph.nodes[node_id]['cell'] = new_cell
    num_rows = len(data['demographics'])
    num_cols = len(data['demographics'][0])
    num_districts = data['num_districts']
    metric = ObjectiveWalker().parse(data['objective'])
    result = []
    start = time()
    for partition in solve_optimally(graph, num_districts, metric):
        districts = create_district_map(partition)
        borders = []
        for row in range(num_rows):
            for col in range(1, num_cols):
                if districts[(row, col - 1)] != districts[(row, col)]:
                    borders.append(f'{row}-{col - 1}-{row}-{col}')
        for col in range(num_cols):
            for row in range(1, num_rows):
                if districts[(row - 1, col)] != districts[(row, col)]:
                    borders.append(f'{row - 1}-{col}-{row}-{col}')
        result.append({
            'districts': partition,
            'borders': borders,
        })
    print(f'solved {num_rows}x{num_cols} {time() - start}')
    return json.dumps(result)
