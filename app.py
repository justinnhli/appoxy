#!/usr/bin/env python3

from collections import namedtuple
from importlib import import_module
from pathlib import Path

from flask import abort, Flask, render_template, send_from_directory, url_for, redirect

IGNORE_DIRS = ['blueprint_template', 'static', 'templates']

app = Flask(__name__)

modules = {}

for module_path in Path(__file__).expanduser().resolve().parent.glob('*/__init__.py'):
    module_name = module_path.parent.name
    if module_name in IGNORE_DIRS:
        continue
    module = import_module(module_name)
    modules[module_name] = module
    app.register_blueprint(getattr(module, module_name))


@app.route('/static/<filename>')
def resources(filename):
    if filename.split('.')[-1] in ('css', 'js'):
        if filename == 'jquery.js':
            return redirect('https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js', code=302)
        else:
            return send_from_directory('static', filename)
    else:
        return abort(404)


@app.route('/<applet>/static/<filename>')
def get_app_resource(applet, filename):
    if filename.split('.')[-1] in ('css', 'js'):
        print(applet)
        return send_from_directory(f'{applet}/static', filename)
    else:
        return abort(404)


@app.route('/')
def root():
    Applet = namedtuple('Applet', ('name', 'url', 'doc'))
    applets = {}
    for rule in app.url_map.iter_rules():
        if not rule.endpoint.endswith('.root'):
            continue
        name = rule.endpoint.replace('.root', '').split('.')[0]
        url = url_for(rule.endpoint)
        doc = modules[name].__doc__
        doc = doc.strip().splitlines()[0]
        applets[name] = Applet(name, url, doc)
    return render_template('index.html', applets=sorted(applets.items()))


if __name__ == '__main__':
    app.run(host='0.0.0.0')
