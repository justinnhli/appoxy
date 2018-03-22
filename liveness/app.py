import re
from collections import namedtuple
from os.path import basename, dirname, join as join_path

from flask import Blueprint, send_from_directory, request, render_template

from .liveness import control_flow_graph, DataflowWalker, upwards_exposure, local_definitions, available_definitions, reachability, liveness as calculate_liveness

APP_NAME = basename(dirname(__file__))

app = Blueprint(
    APP_NAME,
    APP_NAME,
    url_prefix=('/' + APP_NAME),
    static_folder='static',
    static_url_path=join_path('/static', APP_NAME),
    template_folder='templates',
)

LocalInfo = namedtuple('LocalInfo', ['exposed', 'defined', 'available'])


@app.route('/')
def root():
    return render_template(join_path(APP_NAME, 'index.html'))


@app.route('/cfg', methods=['POST'])
def draw_cfg():
    source = request.get_data(as_text=True)
    try:
        analysis = DataflowWalker().parse(source)
        return control_flow_graph(analysis)
    except SyntaxError:
        return 'Syntax Error'


@app.route('/usage', methods=['POST'])
def generate_usage():
    source = request.get_data(as_text=True).rstrip()
    try:
        analysis = DataflowWalker().parse(source)
    except SyntaxError:
        return '<p class="center">Syntax Error</p>'
    u = upwards_exposure(analysis)
    db = local_definitions(analysis)
    pb = available_definitions(analysis)
    return '<table class="center">' + create_html_table_rows(analysis, ['U', 'DB', 'PB'], [u, db, pb]) + '</table>'


@app.route('/reachability', methods=['POST'])
def generate_reachability():
    source = request.get_data(as_text=True).rstrip()
    try:
        analysis = DataflowWalker().parse(source)
    except SyntaxError:
        return '<p class="center">Syntax Error</p>'
    html = []
    html.append('<table class="center">')
    for i, (r, a) in enumerate(reachability(analysis)):
        html.append('<tr><th colspan="4" class="iteration">Iteration {}</th></tr>'.format(i))
        html.append(create_html_table_rows(analysis, ['A', 'R'], [a, r]))
        html.append('<tr><th colspan="4" class="separator">&nbsp;<br>&nbsp;</th></tr>')
    html.append('</table>')
    return ''.join(html)


@app.route('/liveness', methods=['POST'])
def generate_liveness():
    source = request.get_data(as_text=True).rstrip()
    try:
        analysis = DataflowWalker().parse(source)
    except SyntaxError:
        return '<p class="center">Syntax Error</p>'
    u = upwards_exposure(analysis)
    r, _ = reachability(analysis)[-1]
    l = calculate_liveness(analysis)
    return '<table class="center">' + create_html_table_rows(analysis, ['R', 'U', 'L'], [r, u, l]) + '</table>'


def htmlize_var(var):
    if '_' in var:
        return '{}<sub>{}</sub>'.format(*var.split('_'))
    else:
        return var


def create_html_table_rows(analysis, header, data):
    html = []
    html.append('<tr>' + ''.join('<th>{}</th>'.format(head) for head in ['#', 'Source', *header]) + '</tr>')
    for line_num in sorted(analysis.lines):
        row_values = [line_num, '<code>' + analysis.lines[line_num].source + '</code>']
        for column in data:
            variables = [htmlize_var(var) for var in sorted(column[line_num])]
            row_values.append('{' + ', '.join(variables) + '}')
        html.append('<tr>' + ''.join('<td>{}</td>'.format(value) for value in row_values) + '</tr>')
    return ''.join(html)
