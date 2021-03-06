from os.path import basename, dirname, join as join_path

from flask import Blueprint, render_template, request, redirect, url_for

from .memograph import MemographWalker, memory_to_dot

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

@app.route('/index.html')
def index():
    return redirect(url_for('.root'))


@app.route('/syntax.html')
def syntax():
    return render_template(join_path(APP_NAME, 'syntax.html'))


@app.route('/parse', methods=['POST'])
def parse():
    text = request.get_data(as_text=True)
    try:
        mem_parser = MemographWalker()
        return memory_to_dot(*mem_parser.parse(text))
    except (KeyError, ValueError, SyntaxError) as err:
        return 'ERROR ' + str(err)
