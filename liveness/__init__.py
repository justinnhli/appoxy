"""Control flow graph and liveness analysis demo."""

import re
from collections import namedtuple

from flask import Blueprint, send_from_directory, request

from .liveness import control_flow_graph, DataflowWalker, upwards_exposure, local_definitions, available_definitions, reachability, liveness as calculate_liveness

liveness = Blueprint(__name__, __name__, url_prefix=('/' + __name__))

LocalInfo = namedtuple('LocalInfo', ['exposed', 'defined', 'available'])


@liveness.route('/')
def root():
    return send_from_directory(__name__, 'liveness.html')


@liveness.route('/cfg', methods=['POST'])
def draw_cfg():
    source = request.get_data(as_text=True)
    try:
        analysis = DataflowWalker().parse(source)
        return control_flow_graph(analysis)
    except SyntaxError:
        return 'Syntax Error'


@liveness.route('/usage', methods=['POST'])
def generate_usage():
    source = request.get_data(as_text=True).rstrip()
    analysis = DataflowWalker().parse(source)
    u = upwards_exposure(analysis)
    db = local_definitions(analysis)
    pb = available_definitions(analysis)
    return '<table>' + create_html_table_rows(analysis, ['U', 'DB', 'PB'], [u, db, pb]) + '</table>'


@liveness.route('/reachability', methods=['POST'])
def generate_reachability():
    source = request.get_data(as_text=True).rstrip()
    analysis = DataflowWalker().parse(source)
    html = []
    html.append('<table>')
    for i, (r, a) in enumerate(reachability(analysis)):
        html.append('<tr><th colspan="4" class="iteration">Iteration {}</th></tr>'.format(i))
        html.append(create_html_table_rows(analysis, ['A', 'R'], [a, r]))
        html.append('<tr><th colspan="4" class="separator">&nbsp;<br>&nbsp;</th></tr>')
    html.append('</table>')
    return ''.join(html)


@liveness.route('/liveness', methods=['POST'])
def generate_liveness():
    source = request.get_data(as_text=True).rstrip()
    analysis = DataflowWalker().parse(source)
    u = upwards_exposure(analysis)
    r, _ = reachability(analysis)[-1]
    l = calculate_liveness(analysis)
    return '<table>' + create_html_table_rows(analysis, ['R', 'U', 'L'], [r, u, l]) + '</table>'


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
