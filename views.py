#!/usr/bin/env python3

from collections import namedtuple
from importlib import import_module
from os import listdir
from os.path import dirname, isdir, realpath

from flask import abort, Flask, render_template, send_from_directory, url_for

IGNORE_DIRS = ('.git', 'templates', 'css', 'js')

app = Flask(__name__)

modules = {}
for module_name in listdir(dirname(realpath(__file__))):
    if isdir(module_name) and module_name not in IGNORE_DIRS:
        module = import_module(module_name)
        modules[module_name] = module
        app.register_blueprint(getattr(module, module_name))

@app.route('/<sub>/<file>')
def resources(sub, file):
    if file.split('.')[-1] in ('css', 'js'):
        return send_from_directory(sub, file)
    else:
        return abort(404)

@app.route('/')
def root():
    Applet = namedtuple('Applet', ('name', 'url', 'doc'))
    applets = {}
    for rule in app.url_map.iter_rules():
        if not rule.endpoint.endswith('.root'):
            continue
        name = rule.endpoint.replace('.root', '')
        url = url_for(rule.endpoint)
        doc = modules[name].__doc__
        applets[name] = Applet(name, url, doc)
    return render_template('index.html', applets=sorted(applets.items()))

if __name__ == '__main__':
    app.run(debug=True)
