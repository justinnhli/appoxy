"""A re-districting solver."""

import math
import json
from collections import namedtuple
from pathlib import Path

import networkx as nx

from pegparse import create_parser_from_file, ASTWalker

EBNF_FILE = Path(__file__).parent.joinpath('objective.ebnf')

BASE = 'http://polytrope.com/district/sandbox.html'

class Cell(namedtuple('_Cell', 'row, col, active, population, parties, races')):

    @property
    def votes_red(self):
        return self.parties[0] > self.parties[1]

    @property
    def votes_blue(self):
        return self.parties[1] > self.parties[0]

    @property
    def votes_purple(self):
        return self.parties[1] == self.parties[0]

    @property
    def red_percent(self):
        return self.parties[0] / 100

    @property
    def red_votes(self):
        return self.red_percent * self.population

    @property
    def blue_percent(self):
        return self.parties[1] / 100

    @property
    def blue_votes(self):
        return self.blue_percent * self.population

    @property
    def asian_percent(self):
        return self.races[0] / 100

    @property
    def black_percent(self):
        return self.races[1] / 100

    @property
    def caucasian_percent(self):
        return self.races[2] / 100

    @property
    def hispanic_percent(self):
        return self.races[3] / 100

    @property
    def asian_population(self):
        return round(self.races[0] * self.population / 100)

    @property
    def black_population(self):
        return round(self.races[1] * self.population / 100)

    @property
    def caucasian_population(self):
        return round(self.races[2] * self.population / 100)

    @property
    def hispanic_population(self):
        return round(self.races[3] * self.population / 100)


def json_to_graph(graph_json):
    graph = nx.Graph()
    for row_id, row in enumerate(graph_json):
        for col_id, population in enumerate(row):
            if population == {}:
                continue
            graph.add_node(
                (row_id, col_id),
                cell=Cell(
                    row_id,
                    col_id,
                    population['active'],
                    population['population'],
                    population['parties'],
                    population['races'],
                ),
            )
    for (node_row, node_col) in graph:
        if (node_row - 1, node_col) in graph:
            graph.add_edge((node_row, node_col), (node_row - 1, node_col))
        if (node_row + 1, node_col) in graph:
            graph.add_edge((node_row, node_col), (node_row + 1, node_col))
        if (node_row, node_col - 1) in graph:
            graph.add_edge((node_row, node_col), (node_row, node_col - 1))
        if (node_row, node_col + 1) in graph:
            graph.add_edge((node_row, node_col), (node_row, node_col + 1))
    return graph


def graph_to_json(graph, exclusions=None):
    if exclusions is None:
        exclusions = set()
    elif not isinstance(exclusions, set):
        exclusions = set(exclusions)
    max_row = max(coord[0] for coord in graph)
    max_col = max(coord[1] for coord in graph)
    rows = []
    for row_id in range(max_row + 1):
        row = []
        for col_id in range(max_col + 1):
            node_id = (row_id, col_id)
            if node_id in graph and node_id not in exclusions:
                cell = graph.nodes[node_id]['cell']
                row.append(dict(cell._asdict()))
            else:
                row.append({})
        rows.append(row)
    return json.dumps(rows)


def all_first_districts_of_size(graph, size):

    visited = set()

    def _all_first_districts_of_size(remaining, district, frontier):
        if remaining <= 0:
            yield tuple(sorted(district))
        else:
            for node in frontier:
                new_district = district | set([node])
                hashable_district = tuple(sorted(new_district))
                if hashable_district in visited:
                    continue
                visited.add(hashable_district)
                cell = graph.nodes[node]['cell']
                if cell.active:
                    population = cell.population
                else:
                    population = 0
                if remaining < population:
                    yield tuple(sorted(district))
                    yield tuple(sorted(new_district))
                else:
                    yield from _all_first_districts_of_size(
                        remaining - population,
                        new_district,
                        (frontier | set(graph.neighbors(node))) - set(district),
                    )

    if not any(graph.nodes[node]['cell'].active for node in graph):
        return None
    root_node = min(node for node in graph if graph.nodes[node]['cell'].active)
    return _all_first_districts_of_size(size, set(), set([root_node]))


SubSolution = namedtuple('SubSolution', 'score, partitions')


def solve_optimally(graph, num_districts, metric_fn, cache=None):
    """Find the partition that maximizes the evaluation function.

    Parameters:
        graph (networkx.Graph): The electoral map.
        num_districts (int): The number of districts.
        metric_fn (Callable[Tuple[Tuple[Tuple[int,int]]], float]):
            A function that evaluates a partition.
        cache (Mapping[ Tuple[str, Tuple[int]], SubSolution ]):
            A cache of the optimal subsolutions.

    Yields:
        Tuple[ Tuple[ Tuple[int, int] ] ]:
            Partitions, each a tuple of coordinates.
    """
    if cache is None:
        cache = {}
    cache_key = (graph_to_json(graph), num_districts)
    if cache_key in cache:
        yield from cache[cache_key].partitions
        return
    graph_size = sum(
        graph.nodes[node]['cell'].population
        for node in graph
        if graph.nodes[node]['cell'].active
    )
    mean_size = graph_size / num_districts
    partitions = set()
    if num_districts == 1:
        partitions.add(tuple([tuple(sorted(graph.nodes))]))
    else:
        for district_size in set([math.floor(mean_size), math.ceil(mean_size)]):
            first_districts = all_first_districts_of_size(graph, district_size)
            if first_districts is None:
                continue
            for district in first_districts:
                sub_graph = json_to_graph(json.loads(graph_to_json(graph, exclusions=district)))
                if not (sub_graph and nx.is_connected(sub_graph)):
                    continue
                for sub_partition in solve_optimally(sub_graph, num_districts - 1, metric_fn, cache=cache):
                    partitions.add(tuple(sorted((district,) + sub_partition)))
    if not partitions:
        return
    for partition in partitions:
        districts = {}
        if partitions is not None:
            for district_id, district in enumerate(partition):
                for node in district:
                    districts[node] = district_id
        score = metric_fn(partition, graph, districts)
        if cache_key not in cache or score > cache[cache_key].score:
            cache[cache_key] = SubSolution(score, set([partition]))
        elif score == cache[cache_key].score:
            cache[cache_key].partitions.add(partition)
    yield from cache[cache_key].partitions


class ObjectiveWalker(ASTWalker):

    def __init__(self):
        super().__init__(create_parser_from_file(str(EBNF_FILE)), 'Objective')

    def _parse_Objective(self, ast, results):
        return (lambda partition, graph, districts: results[0] * results[1](partition, graph, districts))

    def _parse_MinMax(self, ast, results):
        if ast.match.startswith('min'):
            return -1
        else:
            return 1

    def _parse_DistrictObjective(self, ast, results):
        return (lambda partition, graph, districts: sum(results[0](district, graph, districts) for district in partition))

    def _parse_PrecinctObjective(self, ast, results):
        return (lambda partition, graph, districts:
            sum(
                results[0](graph.nodes[node_id]['cell'], graph, districts)
                for district in partition for node_id in district 
            )
        )

    def _parse_DistrictComparisonCondition(self, ast, results):
        func1 = (lambda district, graph, districts:
            sum(results[1](graph.nodes[node_id]['cell'], graph, districts) for node_id in district)
        )
        func2 = (lambda district, graph, districts:
            sum(results[2](graph.nodes[node_id]['cell'], graph, districts) for node_id in district)
        )
        if results[0] == 'more':
            return (lambda district, graph, districts: func1(district, graph, districts) > func2(district, graph, districts))
        elif results[0] == 'fewer':
            return (lambda district, graph, districts: func1(district, graph, districts) < func2(district, graph, districts))
        else:
            return (lambda district, graph, districts: func1(district, graph, districts) == func2(district, graph, districts))

    def _parse_DistrictAttributeCondition(self, ast, results):
        return (lambda district, graph, districts: results[0](district, graph, districts) > 0)

    def _parse_DistrictAttribute(self, ast, results):
        return (lambda district, graph, districts:
            sum(results[0](graph.nodes[node_id]['cell'], graph, districts) for node_id in district)
        )

    def _parse_PrecinctComparisonCondition(self, ast, results):
        if results[0] == 'more':
            return (lambda cell, graph, districts: results[1](cell, graph, districts) > results[2](cell, graph, districts))
        elif results[0] == 'fewer':
            return (lambda cell, graph, districts: results[1](cell, graph, districts) < results[2](cell, graph, districts))
        else:
            return (lambda cell, graph, districts: results[1](cell, graph, districts) == results[2](cell, graph, districts))

    def _parse_PrecinctAttributeCondition(self, ast, results):
        return (lambda cell, graph, districts: results[0](cell, graph, districts) > 0)

    def _parse_NeighborAttribute(self, ast, results):
        if 'same' in ast.match:
            return (lambda cell, graph, districts:
                sum(
                    1 for neighbor_id in graph.neighbors((cell.row, cell.col))
                    if districts[(cell.row, cell.col)] == districts[neighbor_id]
                )
            )
        else:
            return (lambda cell, graph, districts:
                sum(
                    1 for neighbor_id in graph.neighbors((cell.row, cell.col))
                    if districts[(cell.row, cell.col)] != districts[neighbor_id]
                )
            )

    def _parse_CompareWord(self, ast, results):
        return ast.match

    def _parse_Demographic(self, ast, results):
        if ast.match == 'are Asian':
            return (lambda cell, graph, districts: cell.asian_population)
        elif ast.match == 'are Black':
            return (lambda cell, graph, districts: cell.black_population)
        elif ast.match == 'are Caucasian':
            return (lambda cell, graph, districts: cell.caucasian_population)
        elif ast.match == 'are Hispanic':
            return (lambda cell, graph, districts: cell.hispanic_population)
        elif ast.match == 'vote Red':
            return (lambda cell, graph, districts: cell.red_votes)
        elif ast.match == 'vote Blue':
            return (lambda cell, graph, districts: cell.blue_votes)
        else:
            raise ValueError(f'Unknown demographic: {ast.match}')


def metric_gerrymander_r(partition, graph):
    total = 0
    for district in partition:
        red_votes = 0
        blue_votes = 0
        for node in district:
            cell = graph.nodes[node]['cell']
            red_votes += cell.red_votes
            blue_votes += cell.blue_votes
        if red_votes > blue_votes:
            total += 1
    return total


def metric_gerrymander_b(partition, graph):
    total = 0
    for district in partition:
        red_votes = 0
        blue_votes = 0
        for node in district:
            cell = graph.nodes[node]['cell']
            red_votes += cell.red_votes
            blue_votes += cell.blue_votes
        if blue_votes > red_votes:
            total += 1
    return total

def metric_competitive(partition, graph):
    total = 0
    for district in partition:
        red_votes = 0
        blue_votes = 0
        for node in district:
            cell = graph.nodes[node]['cell']
            red_votes += cell.red_votes
            blue_votes += cell.blue_votes
        if blue_votes == red_votes:
            total += 1
    return total


def metric_compact(partition, graph):
    # pylint: disable = unused-argument
    districts = {}
    for district_id, district in enumerate(partition):
        for node in district:
            districts[node] = district_id
    total = 0
    for row_id, col_id in graph:
        orig_district = districts[(row_id, col_id)]
        for neighbor_id in graph.neighbors((row_id, col_id)):
            if neighbor_id in districts and districts[neighbor_id] != orig_district:
                total -= 1
    return total
