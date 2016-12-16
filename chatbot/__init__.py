'''
An ELIZA style chatbot, with editor
'''

from flask import Blueprint, send_from_directory

chatbot = Blueprint(__name__, __name__, url_prefix=('/'+__name__))

@chatbot.route('/')
def root():
    return send_from_directory(__name__, 'chatbot.html')
