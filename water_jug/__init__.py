'''
Problem space demo on the water jug puzzle
'''

from os.path import dirname

from flask import Blueprint, send_from_directory

water_jug = Blueprint(__name__, __name__, url_prefix=('/' + __name__))


@water_jug.route('/')
def root():
    return send_from_directory(__name__, 'water-jug.html')
