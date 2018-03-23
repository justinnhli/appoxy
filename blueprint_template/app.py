from os.path import basename, dirname, join as join_path

from flask import Blueprint, render_template

from .code import say_hello

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


@app.route('/hello')
def hello():
    return say_hello()
