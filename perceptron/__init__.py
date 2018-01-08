'''
Graphical explanation of perceptron training
'''

from flask import Blueprint, send_from_directory

perceptron = Blueprint(__name__, __name__, url_prefix=('/' + __name__))


@perceptron.route('/')
def root():
    return send_from_directory(__name__, 'perceptron.html')
