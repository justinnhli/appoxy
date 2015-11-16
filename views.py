#!/usr/bin/env python3

from os.path import exists as file_exists, join as join_path

from flask import abort, Flask, render_template_string, send_from_directory, url_for

from bayes import bayes
from info_ret import info_ret
from perceptron import perceptron
from water_jug import water_jug

app = Flask(__name__)
app.register_blueprint(bayes)
app.register_blueprint(info_ret)
app.register_blueprint(perceptron)
app.register_blueprint(water_jug)

@app.route('/<sub>/<file>')
def resources(sub, file):
    if file.split('.')[-1] in ('css', 'js'):
        return send_from_directory(sub, file)
    else:
        return abort(404)

@app.route('/')
def root():
    template = '''
    <html>
        <body>
            <ul>
                {% for text, url in links %}
                <li><a href="{{ url }}">{{ text }}</a></li>
                {% endfor %}
            </ul>
        </body>
    </html>
    '''
    links = []
    for rule in app.url_map.iter_rules():
        if rule.endpoint in ('root', 'static', 'css', 'js'):
            continue
        if not rule.endpoint.endswith('.root'):
            continue
        link = rule.endpoint.replace('.root', '')
        url = url_for(rule.endpoint, **(rule.defaults or {}))
        links.append((link, url))
    links = sorted(links)
    print(links)
    return render_template_string(template, links=links)

if __name__ == '__main__':
    app.run(debug=True)
    #app.run()
