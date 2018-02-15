#!/usr/bin/env python3

from collections import namedtuple, defaultdict
from os.path import join as join_path, dirname, abspath
from copy import deepcopy

from pegparse import create_parser_from_file, ASTWalker

EBNF_FILE = join_path(dirname(abspath(__file__)), 'c-like.ebnf')

CodeBlock = namedtuple('CodeBlock', ['entrance', 'exits'])


class LineOfCode:

    def __init__(self, line_num, column, source, var, used):
        self.line_num = line_num
        self.column = column
        self.source = source
        self.var = var
        self.used = used

    @property
    def var_name(self):
        return '{}_{}_{}'.format(self.var, self.line_num, self.column)


class DataflowWalker(ASTWalker):

    def __init__(self):
        parser = create_parser_from_file(EBNF_FILE)
        super().__init__(parser, 'Program')
        self.edges = []
        self.lines = {}
        self.line_num = 1

    def parse_Program(self, ast, results):
        for before, after in zip(results[:-1], results[1:]):
            for exit_line in before.exits:
                self.edges.append([exit_line.line_num, after.entrance.line_num])
        return CodeBlock(results[0].entrance, results[-1].exits)

    def parse_IfElse(self, ast, results):
        condition, true_block, false_block = results
        condition.source = 'if ' + condition.source
        self.edges.append([condition.line_num, true_block.entrance.line_num])
        self.edges.append([condition.line_num, false_block.entrance.line_num])
        return CodeBlock(condition, [true_block.entrance, false_block.entrance])

    def parse_If(self, ast, results):
        condition, true_block = results
        condition.source = 'if ' + condition.source
        self.edges.append([condition.line_num, true_block.entrance.line_num])
        return CodeBlock(condition, [condition, true_block.entrance])

    def parse_Loop(self, ast, results):
        condition, body = results
        condition.source = 'while ' + condition.source
        self.edges.append([condition.line_num, body.entrance.line_num])
        for exit_line in body.exits:
            self.edges.append([exit_line.line_num, condition.line_num])
        return CodeBlock(condition, [condition])

    def parse_Condition(self, ast, results):
        used = set()
        has_nested = False
        for result in results:
            if isinstance(result, LineOfCode):
                used |= result.used
                has_nested = True
            else:
                used.add(result)
        if has_nested:
            line = LineOfCode(self.line_num - 1, ast.column, ast.match, None, used)
        else:
            line = LineOfCode(self.line_num, ast.column, ast.match, None, used)
            self.line_num += 1
        self.lines[line.line_num] = line
        return line

    def parse_BasicBlock(self, ast, results):
        for before, after in zip(results[:-1], results[1:]):
            self.edges.append([before.line_num, after.line_num])
        return CodeBlock(results[0], [results[-1]])

    def parse_Assignment(self, ast, results):
        if len(ast.first_descendant('AssignmentOperator').match) > 1:
            used = set(results)
        else:
            used = set(results[1:])
        line = LineOfCode(self.line_num, ast.column, ast.match, results[0], set(used))
        self.line_num += 1
        self.lines[line.line_num] = line
        return line

    def parse_FunctionCall(self, ast, results):
        line = LineOfCode(self.line_num, ast.column, ast.match, None, set(results[1:]))
        self.line_num += 1
        self.lines[line.line_num] = line
        return line

    def parse_Variable(self, ast, results):
        return ast.match

def upwards_exposure(parser):
    upwards = defaultdict(set)
    for line_num, line in sorted(parser.lines.items(), reverse=True):
        upwards[line_num] |= line.used
    changed = True
    while changed:
        changed = False
        for line_num, line in sorted(parser.lines.items(), reverse=True):
            for var in upwards[line_num]:
                for src, dest in parser.edges:
                    if dest == line_num and var != parser.lines[src].var and var not in upwards[src]:
                        upwards[src].add(var)
                        changed = True
    return upwards

def local_definitions(parser):
    db = defaultdict(set)
    for line_num, line in parser.lines.items():
        if line.var:
            db[line_num] = set([line.var_name])
    return db

def available_definitions(parser):
    variables = defaultdict(set)
    for line in parser.lines.values():
        if line.var:
            variables[line.var].add(line.var_name)
    pb = defaultdict(set)
    for line_num, line in parser.lines.items():
        pb[line_num] = set.union(*(values for key, values in variables.items() if key != line.var))
    return pb


def reachability_old(source):
    parser = DataflowWalker()
    parser.parse(source)
    u = upwards_exposure(parser)
    db = local_definitions(parser)
    pb = available_definitions(parser)
    r = defaultdict(set)
    a = defaultdict(set)
    changed = True
    iteration = 0
    while changed:
        changed = False
        iteration += 1
        for line_num in parser.lines.keys():
            # update a
            old_a = a[line_num]
            a[line_num] = db[line_num].union(r[line_num].intersection(pb[line_num]))
            if old_a != a[line_num]:
                changed = True
            # update r
            old_r = r[line_num]
            new_r = set()
            for pred, succ in parser.edges:
                if succ == line_num:
                    new_r |= a[pred]
            r[line_num] = new_r
            if old_r != new_r:
                changed = True
        '''
        print(20 * '=')
        print(iteration)
        print()
        print('R:')
        print('\n'.join('{}: {}'.format(k, v) for k, v in sorted(r.items())))
        print()
        print('A:')
        print('\n'.join('{}: {}'.format(k, v) for k, v in sorted(a.items())))
        print()
        '''
    return r, a
        

def reachability(source):
    parser = DataflowWalker()
    parser.parse(source)
    u = upwards_exposure(parser)
    db = local_definitions(parser)
    pb = available_definitions(parser)
    r_s = [defaultdict(set)]
    a_s = [defaultdict(set)]
    changed = True
    iteration = 0
    while changed:
        changed = False
        r = deepcopy(r_s[-1])
        a = deepcopy(a_s[-1])
        iteration += 1
        for line_num in parser.lines.keys():
            # update a
            old_a = a[line_num]
            a[line_num] = db[line_num].union(r[line_num].intersection(pb[line_num]))
            if old_a != a[line_num]:
                changed = True
            # update r
            old_r = r[line_num]
            new_r = set()
            for pred, succ in parser.edges:
                if succ == line_num:
                    new_r |= a[pred]
            r[line_num] = new_r
            if old_r != new_r:
                changed = True
        if changed:
            r_s.append(r)
            a_s.append(a)
    l = defaultdict(set)
    for line_num in sorted(parser.lines.keys()):
        for reachable_var in r[line_num]:
            for exposed_var in u[line_num]:
                if reachable_var.startswith(exposed_var + '_'):
                    l[line_num].add(reachable_var)
    return list(zip(r_s, a_s))

def control_flow_graph(source):
    parser = DataflowWalker()
    parser.parse(source)
    lines = []
    lines.append('digraph {')
    for line_num, line in sorted(parser.lines.items()):
        lines.append('    {} [label="{}: {}"]'.format(line_num, line_num, line.source))
    for src, dest in parser.edges:
        lines.append('    {} -> {}'.format(src, dest))
    lines.append('}')
    return '\n'.join(lines)

def liveness(source):
    parser = DataflowWalker()
    parser.parse(source)
    u = upwards_exposure(parser)
    r, _ = reachability(source)[-1]
    l = defaultdict(set)
    for line_num in sorted(parser.lines.keys()):
        for reachable_var in r[line_num]:
            for exposed_var in u[line_num]:
                if reachable_var.startswith(exposed_var + '_'):
                    l[line_num].add(reachable_var)
    return l
    '''
    print(20 * '=')
    print('L:')
    print('\n'.join('{}: {}'.format(k, v) for k, v in sorted(l.items())))
    print()
    '''

def main():
    import sys
    with open(sys.argv[1]) as fd:
        source = fd.read()
        print(control_flow_graph(source))
    reachability(sys.argv[1])


if __name__ == '__main__':
    main()
