"""Jeopardy! board creator and player."""

from os.path import dirname

from flask import Blueprint, send_from_directory

jeopardy = Blueprint(__name__, __name__, url_prefix=('/'+__name__))

@jeopardy.route('/')
def root():
    return send_from_directory(__name__, 'jeopardy.html')
