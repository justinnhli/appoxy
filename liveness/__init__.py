'''Control flow graph and liveness analysis demo.'''

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
        return control_flow_graph(source)
    except SyntaxError:
        return 'Syntax Error'

def htmlize_var(var):
    if '_' in var:
        return '{}<sub>{},{}</sub>'.format(*var.split('_'))
    else:
        return var

@liveness.route('/usage', methods=['POST'])
def generate_usage():
    source = request.get_data(as_text=True).rstrip()
    parser = DataflowWalker()
    parser.parse(source)
    u = upwards_exposure(parser)
    db = local_definitions(parser)
    pb = available_definitions(parser)
    html = []
    html.append('<table>')
    html.append('<tr><th>#</th><th>Source</th><th>U</th><th>DB</th><th>PB</th></tr>')
    for line_num in sorted(parser.lines):
        html.append('<tr><td>{}</td><td><code>{}</code></td><td>{}</td><td>{}</td><td>{}</td></tr>'.format(
            line_num,
            parser.lines[line_num].source,
            '{' + ', '.join(htmlize_var(var) for var in sorted(u[line_num])) + '}',
            '{' + ', '.join(htmlize_var(var) for var in sorted(db[line_num])) + '}',
            '{' + ', '.join(htmlize_var(var) for var in sorted(pb[line_num])) + '}',
        ))
    html.append('</table>')
    return ''.join(html)

@liveness.route('/reachability', methods=['POST'])
def generate_reachability():
    source = request.get_data(as_text=True).rstrip()
    parser = DataflowWalker()
    parser.parse(source)
    html = []
    html.append('<table>')
    for i, (r, a) in enumerate(reachability(source)):
        html.append('<tr><th colspan="4" class="noleft noright notop" style="text-align:left;">Iteration {}</th></tr>'.format(i))
        html.append('<tr><th>#</th><th>Source</th><th>R</th><th>A</th></tr>')
        for line_num in sorted(parser.lines):
            html.append('<tr><td>{}</td><td><code>{}</code></td><td>{}</td><td>{}</td></tr>'.format(
                line_num,
                parser.lines[line_num].source,
                '{' + ', '.join(htmlize_var(var) for var in sorted(r[line_num])) + '}',
                '{' + ', '.join(htmlize_var(var) for var in sorted(a[line_num])) + '}',
            ))
        html.append('<tr><th colspan="4" class="noleft noright nobottom">&nbsp;<br>&nbsp;</th></tr>')
    html.append('</table>')
    return ''.join(html)

@liveness.route('/liveness', methods=['POST'])
def generate_liveness():
    source = request.get_data(as_text=True).rstrip()
    parser = DataflowWalker()
    parser.parse(source)
    u = upwards_exposure(parser)
    r, _ = reachability(source)[-1]
    l = calculate_liveness(source)
    html = []
    html.append('<table>')
    html.append('<tr><th>#</th><th>Source</th><th>R</th><th>U</th><th>L</th></tr>')
    for line_num in sorted(parser.lines):
        html.append('<tr><td>{}</td><td><code>{}</code></td><td>{}</td><td>{}</td><td>{}</td></tr>'.format(
            line_num,
            parser.lines[line_num].source,
            '{' + ', '.join(htmlize_var(var) for var in sorted(r[line_num])) + '}',
            '{' + ', '.join(htmlize_var(var) for var in sorted(u[line_num])) + '}',
            '{' + ', '.join(htmlize_var(var) for var in sorted(l[line_num])) + '}',
        ))
    html.append('</table>')
    return ''.join(html)
