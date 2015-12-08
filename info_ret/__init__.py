from os.path import dirname

from flask import Blueprint, request, send_from_directory

from .ir_parser import run_program_on_descriptions

info_ret = Blueprint(__name__, __name__, url_prefix=('/'+__name__))

@info_ret.route('/')
def root():
    return send_from_directory(__name__, 'gui.html')

@info_ret.route('/process', methods=['POST'])
def process():
    program = request.form['program']
    departments = set(department for department in request.form['departments'].split('|') if department)
    if not departments:
        return ''
    mapping = run_program_on_descriptions(program, departments)
    if mapping is None:
        return '<span style="color:#A40000;">Your program has syntax errors, likely because you manually changed the code.<br>Please check your dropbown boxes for errors.</span>'
    html = ['<table id="results">']
    html.append('<tr>')
    html.append('<th>Catalog Description</th>')
    html.append('<th>Extracted Information</th>')
    html.append('</tr>')
    for course, outputs in sorted(mapping.items()):
        html.append('<tr>')
        html.append('<td>{}</td>'.format(course.text.replace('\n', '<br>')))
        html.append('<td><ul>')
        html.append(''.join('<li>{}</li>'.format(transformed.text) for transformed in outputs))
        html.append('</ul></td>')
        html.append('</tr>')
    html.append('</table>')
    return ''.join(html)
