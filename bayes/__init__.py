'''
Bayesian network editor and calculator
'''

from flask import Blueprint, send_from_directory, request

from .bayesnet import BayesNet

bayes = Blueprint(__name__, __name__, url_prefix=('/'+__name__))

@bayes.route('/')
def root():
    return send_from_directory(__name__, 'bayesnet.html')

@bayes.route('/parse', methods=['POST'])
def parse():
    bayes = request.get_data(as_text=True)
    net = BayesNet(bayes)
    if net.has_errors:
        return net.error
    else:
        return net.dot()
