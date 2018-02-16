"""A web app for interactive GUI-based information extraction."""

import re
from functools import total_ordering
from itertools import compress
from os.path import basename, join as join_path
import json

from flask import Blueprint, send_from_directory, jsonify, request

CODE2NAME = {
    "AMST": "American Studies",
    "ARAB": "Arabic",
    "ART": "Art History & Visual Arts",
    "BICH": "Biochemistry",
    "BIO": "Biology",
    "CHEM": "Chemistry",
    "CHIN": "Chinese",
    "CLAS": "Classical Studies",
    "COGS": "Cognitive Science",
    "CSLC": "Comparative Studies in Literature and Culture",
    "COMP": "Computer Science",
    "CTSJ": "Critical Theory & Social Justice",
    "CSP": "Cultural Studies Program",
    "DWA": "Diplomacy & World Affairs",
    "ECON": "Economics",
    "EDUC": "Education",
    "ENGL": "English",
    "FREN": "French",
    "GEO": "Geology",
    "GERM": "German",
    "GRK": "Greek",
    "HIST": "History",
    "JAPN": "Japanese",
    "KINE": "Kinesiology",
    "LATN": "Latin",
    "LLAS": "Latino/a & Latin American Studies",
    "LING": "Linguistics",
    "MAC": "Media Arts & Culture",
    "MATH": "Mathematics",
    "MUSC": "Music",
    "MUSA": "Music Applied Study",
    "PHIL": "Philosophy",
    "PHYS": "Physics",
    "POLS": "Politics",
    "PSYC": "Psychology",
    "RELS": "Religious Studies",
    "RUSN": "Russian",
    "SOC": "Sociology",
    "SPAN": "Spanish & French Studies",
    "THEA": "Theater",
    "UEP": "Urban & Environmental Policy",
    "WRD": "Writing & Rhetoric",
}
"""dict [str -> str]: A dict that maps department codes to department names."""

NAME2CODE = dict((text, code) for code, text in CODE2NAME.items())
"""dict [str -> str]: A dict that maps department names to department codes."""


@total_ordering
class CourseDescription:

    """A class to represent a course's catalog description

    Attributes:
        department (str): Course department as a short code.
        number (str): Course number as a string, since letters are allowed.
        text (str): List of lines in the course description.

    """

    def __init__(self, dept_code, number, text):
        self.dept_code = dept_code
        self.number = number
        self.text = text

    def __str__(self):
        return "{} {}".format(self.dept_code, self.number)

    def __lt__(self, other):
        return str(self) < str(other)


def run_insert_text(text, description):
    """Determine the text to be inserted.

    Args:
        text (str): The text to insert.
        description (CourseDescription): The course to be matched against.

    Returns:
        str: Text to be inserted.
    """
    if text.startswith('"'):
        return text[1:-1]
    elif text == 'dept-code':
        return description.dept_code
    elif text == 'dept-name':
        return CODE2NAME[description.dept_code]
    else:
        assert False
        return None


def run_text(text, description):
    """Identifies the indices of matching text in the lines.

    Args:
        text (str): The text to identify the index of.
        description (CourseDescription): The course to be matched against.

    Returns:
        list: List of list of (start, end) index positions.
    """
    result = []
    for line in description.text:
        line_result = []
        if text.startswith('"'):
            index = line.find(text[1:-1])
            while index != -1:
                end = index + len(text) - 2
                line_result.append([index, end])
                index = line.find(text[1:-1], end)
        elif text == 'any-digit':
            for match in re.finditer('[0-9]+', line):
                line_result.append([match.start(), match.end()])
        elif text == 'lower-case':
            for match in re.finditer('[a-z]+', line):
                line_result.append([match.start(), match.end()])
        elif text == 'upper-case':
            for match in re.finditer('[A-Z]+', line):
                line_result.append([match.start(), match.end()])
        elif text == 'three-digits':
            for match in re.finditer('[0-9]{3}', line):
                line_result.append([match.start(), match.end()])
        elif text == 'dept-code':
            for match in re.finditer(description.dept_code, line):
                line_result.append([match.start(), match.end()])
        elif text == 'dept-name':
            for match in re.finditer(CODE2NAME[description.dept_code], line):
                line_result.append([match.start(), match.end()])
        result.append(line_result)
    return result


def run_location(tokens, description):
    """Identifies the indices of matching text in the lines.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        list: List of list of index positions.
    """
    indices = run_text(tokens[1], description)
    result = []
    if tokens[0] == 'before':
        for line_indices in indices:
            result.append([start for start, end in line_indices])
    elif tokens[0] == 'after':
        for line_indices in indices:
            result.append([end for start, end in line_indices])
    return result


def run_range(tokens, description):
    """Identifies the indices of matching text in the lines.

    The result is a list of pairs of indices that bracket the selected range.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        list: List of list of index positions.
    """
    indices = run_location(tokens[1:], description)
    if tokens[0] == 'start':
        return [[0, min(line_indices, default=len(line))] for line, line_indices in zip(description.text, indices)]
    elif tokens[0] == 'end':
        return [[max(line_indices, default=0), len(line)] for line, line_indices in zip(description.text, indices)]
    else:
        assert False
        return None


def run_filter(tokens, description):
    """Identifies whether the lines contain the indicated text

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        list: List of list of index positions.
    """
    indices = run_text(tokens[-1], description)
    if tokens[1] == 'contain':
        indicator = [(True if line_indices else False) for line_indices in indices]
    elif tokens[1] == 'start with':
        indicator = [any(start == 0 for start, end in line_indices) for line_indices in indices]
    elif tokens[1] == 'end with':
        ends = [max((end for start, end in line_indices), default=-1) for line_indices in indices]
        lengths = [len(text) for text in description.text]
        indicator = [index == length for index, length in zip(ends, lengths)]
    if tokens[0] == 'do':
        return indicator
    elif tokens[0] == 'do not':
        return [not b for b in indicator]
    else:
        assert False
        return None


def run_select(tokens, description):
    """Select the lines that match the filter.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        CourseDescription: A new CourseDescription with only the selected lines
            present in the text.
    """
    return CourseDescription(
        description.dept_code,
        description.number,
        list(compress(description.text, run_filter(tokens[1:], description))),
    )


def run_split(tokens, description):
    """Splits the lines at the designed location.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        CourseDescription: A new CourseDescription with lines split into
            multiple lines in the text.
    """
    indices = run_location(tokens[1:], description)
    new_text = []
    for line, line_indices in zip(description.text, indices):
        line_indices = [0] + line_indices + [len(line)]
        for start, end in zip(line_indices[:-1], line_indices[1:]):
            new_text.append(line[start:end])
    return CourseDescription(
        description.dept_code,
        description.number,
        new_text,
    )


def run_insert(tokens, description):
    """Insert text into the lines at the designed location.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        CourseDescription: A new CourseDescription with additional text inserted
            into each line.
    """
    indices = run_location(tokens[1:-1], description)
    inserted_text = run_insert_text(tokens[-1], description)
    new_text = []
    for line, line_indices in zip(description.text, indices):
        new_line = line
        for index in sorted(line_indices, reverse=True):
            new_line = new_line[:index] + inserted_text + new_line[index + 1:]
        new_text.append(new_line)
    return CourseDescription(
        description.dept_code,
        description.number,
        new_text,
    )


def run_delete(tokens, description):
    """Delete text from each line.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        CourseDescription: A new CourseDescription with text deleted from each
            line.
    """
    indices = run_range(tokens[1:], description)
    return CourseDescription(
        description.dept_code,
        description.number,
        [line[:start] + line[end:] for line, (start, end) in zip(description.text, indices)],
    )


def run_replace(tokens, description):
    """Replace text from each line.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be matched against.

    Returns:
        CourseDescription: A new CourseDescription with text deleted from each
            line.
    """
    replaced_text = run_text(tokens[1], description)
    inserted_text = run_insert_text(tokens[2], description)
    new_text = []
    for line, line_indices in zip(description.text, replaced_text):
        new_line = line
        for start, end in sorted(line_indices, reverse=True):
            new_line = new_line[:start] + inserted_text + new_line[end:]
        new_text.append(new_line)
    return CourseDescription(
        description.dept_code,
        description.number,
        new_text,
    )


def dispatch_transform(transform, description):
    """Dispatch the transformation to appropriate functions.

    Args:
        tokens (list): A list of strings, serialized from the GUI.
        description (CourseDescription): The course to be modified.

    Returns:
        CourseDescription: The transformed CourseDescription.
    """
    if transform[0] == 'select':
        return run_select(transform, description)
    elif transform[0] == 'split':
        return run_split(transform, description)
    elif transform[0] == 'insert':
        return run_insert(transform, description)
    elif transform[0] == 'delete':
        return run_delete(transform, description)
    elif transform[0] == 'replace':
        return run_replace(transform, description)
    else:
        assert False
        return None


def get_catalog(departments):
    """Read the catalog data file.

    Args:
        departments (list): A list of strings, indicating the departments to be
            included in the result.

    Returns:
        list of CourseDescription
    """
    catalog = []
    with open(join_path(__name__, 'data', 'catalog.txt')) as fd:
        for description in fd.read().strip().split('\n\n'):
            lines = description.strip().splitlines()
            dept_code, number, _ = lines[0].strip().split(' ', maxsplit=2)
            if dept_code in departments:
                catalog.append(CourseDescription(dept_code, number, description.splitlines()))
    return catalog


info_ret = Blueprint(__name__, __name__, url_prefix=('/' + __name__))


@info_ret.route('/')
def root():
    return send_from_directory(join_path(__name__, 'templates'), 'index.html')


@info_ret.route('/static/<filename>')
def static(filename):
    return send_from_directory(join_path(__name__, 'static'), basename(filename))


@info_ret.route('/process', methods=['POST'])
def process():
    json_data = json.loads(request.data.decode('utf-8'))
    transforms = json_data['transforms']
    departments = json_data['departments']
    catalog = get_catalog(departments)
    for transform in transforms:
        catalog = [dispatch_transform(transform, description) for description in catalog]
    result = list([old.text, new.text] for old, new in zip(get_catalog(departments), catalog))
    return jsonify({'data': result})


if __name__ == '__main__':
    info_ret.run(debug=True)
