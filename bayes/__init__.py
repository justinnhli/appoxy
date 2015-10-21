from os.path import dirname

from flask import Blueprint, request

from .bayesnet import BayesNet, HTML

bayes = Blueprint(__name__, __name__, url_prefix=('/'+__name__))

@bayes.route('/')
def root():
    return HTML

@bayes.route('/parse', methods=['POST'])
def parse():
    bayes = request.get_data(as_text=True)
    net = BayesNet(bayes)
    if net.has_errors:
        return net.error
    else:
        return net.dot()
