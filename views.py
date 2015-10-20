#!/usr/bin/env python3

from flask import Flask, request, send_from_directory

from bayes import BayesNet, HTML as bayes_html

app = Flask(__name__, static_url_path='')

@app.route('/bayes/')
def bayes():
    return bayes_html

@app.route('/bayes/parse', methods=['POST'])
def bayes_parse():
    bayes = request.get_data(as_text=True)
    net = BayesNet(bayes)
    if net.has_errors:
        return net.error
    else:
        return net.dot()

# TODO make general path for all /js/* and /css/*
@app.route('/js/viz.js')
def viz():
    return send_from_directory('js', 'viz.js')

@app.route('/ann.html')
def ann():
    return send_from_directory('.', 'ann.html')

if __name__ == '__main__':
    #app.run(debug=True)
    app.run()
