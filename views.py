#!/usr/bin/env python3

from flask import Flask, render_template_string, send_from_directory, url_for

from bayes import bayes
from perceptron import perceptron
from water_jug import water_jug

app = Flask(__name__)
app.register_blueprint(bayes)
app.register_blueprint(perceptron)
app.register_blueprint(water_jug)

@app.route('/css/<file>')
def css(file):
    return send_from_directory('css', file)

@app.route('/js/<file>')
def js(file):
    return send_from_directory('js', file)

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
