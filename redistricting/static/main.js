// on load
$(function () {
    'use strict';
    var DEFAULT_BOARD = [
        ['R', 'R', 'B', 'B', 'B'],
        ['R', 'R', 'B', 'B', 'B'],
        ['R', 'R', 'B', 'B', 'B']
    ];
    var LOADING = false;
    var SAVING = false;
    var DEMOGRAPHICS = [];
    var BORDERS = [];
    var OBJECTIVE = [];
    var SOLUTION_DEMOGRAPHICS = [];
    var SOLUTION_USE_DEMOGRAPHICS = false;
    var SOLUTIONS = [];
    var SELECTED_ROW = 0;
    var SELECTED_COL = 0;

    var PARTIES = ['red', 'blue'];
    var RACES = ['asian', 'black', 'caucasian', 'hispanic'];

    const MAIN_PREFIX = 'main';

    function copy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function get_num_rows() {
        return parseInt($('#num-rows').val());
    }

    function get_num_cols() {
        return parseInt($('#num-cols').val());
    }

    function use_demographics() {
        return $('#mode-control').prop('checked');
    }

    function rand_range(min, max) {
        return min + Math.floor(Math.random() * (max - min));
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substring(1);
    }

    function create_population(active, preference) {
        var population = rand_range(100, 2000);
        var red_percent = 0;
        if (preference === 'R') {
            red_percent = rand_range(51, 100);
        } else if (preference === 'B') {
            red_percent = rand_range(0, 50);
        } else if (preference === 'P') {
            red_percent = 50;
        } else {
            red_percent = 50;
            while (red_percent === 50) {
                red_percent = rand_range(0, 100);
            }
        }
        var parties = [red_percent, 100 - red_percent];
        var raw_races = [
            rand_range(0, 100),
            rand_range(0, 100),
            rand_range(0, 100),
            rand_range(0, 100)
        ];
        var sum_races = raw_races[0] + raw_races[1] + raw_races[2] + raw_races[3];
        var races = [];
        for (var i = 0; i < raw_races.length; i += 1) {
            races.push(Math.round(100 * raw_races[i] / sum_races));
        }
        var sum_races = races[0] + races[1] + races[2] + races[3];
        races[races.length - 1] += 100 - sum_races;
        return {
            'active': active,
            'population': population,
            'parties': parties,
            'races': races
        };
    }

    function create_board() {
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        var from_default = (DEMOGRAPHICS.length === 0);
        var new_pop = [];
        for (var row = 0; row < num_rows; row += 1) {
            var new_pop_row = [];
            for (var col = 0; col < num_cols; col += 1) {
                if (from_default && row < DEFAULT_BOARD.length && col < DEFAULT_BOARD[0].length) {
                    new_pop_row.push(create_population(true, DEFAULT_BOARD[row][col]));
                } else if (row < DEMOGRAPHICS.length && col < DEMOGRAPHICS[0].length) {
                    new_pop_row.push(DEMOGRAPHICS[row][col]);
                } else {
                    new_pop_row.push(create_population(false, null));
                }
            }
            new_pop.push(new_pop_row);
        }
        DEMOGRAPHICS = new_pop;
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        var new_borders = [];
        for (var i = 0; i < BORDERS.length; i += 1) {
            var border = BORDERS[i];
            if ($('#' + MAIN_PREFIX + '-' + border).length > 0) {
                new_borders.push(border);
            }
        }
        BORDERS = new_borders;
        populate_num_districts();
        display_main_districts();
    }

    function compute_districts(demographics, borders, id_prefix) {
        var parents = {};

        function find_rep(cell) {
            var rep = cell;
            while (parents[rep] !== rep) {
                rep = parents[rep];
            }
            return rep;
        }

        function compress(cell, rep) {
            if (parents[cell] !== cell) {
                compress(parents[cell], rep);
            }
            parents[cell] = rep;
        }

        function union(cell1, cell2) {
            var rep = find_rep(cell1);
            compress(cell1, rep);
            compress(cell2, rep);
        }

        for (var row = 0; row < demographics.length; row += 1) {
            for (var col = 0; col < demographics[0].length; col += 1) {
                var cell_id = row + '-' + col;
                parents[cell_id] = cell_id;
            }
        }
        // vertical borders
        for (var row = 0; row < demographics.length; row += 1) {
            for (var col = 1; col < demographics[0].length; col += 1) {
                if (!borders.includes(row + '-' + (col - 1) + '-' + row + '-' + col)) {
                    union(row + '-' + (col - 1), row + '-' + col);
                }
            }
        }
        // horizontal borders
        for (var col = 0; col < demographics[0].length; col += 1) {
            for (var row = 1; row < demographics.length; row += 1) {
                if (!borders.includes((row - 1) + '-' + col + '-' + row + '-' + col)) {
                    union((row - 1)+ '-' + col, row + '-' + col);
                }
            }
        }

        var members = {};
        for (var row = 0; row < demographics.length; row += 1) {
            for (var col = 0; col < demographics[0].length; col += 1) {
                var cell_id = row + '-' + col;
                var rep = find_rep(cell_id);
                if (rep in members) {
                    members[rep].push(cell_id);
                } else {
                    members[rep] = [cell_id];
                }
            }
        }
        var partition = [];
        var reps = Array.from(Object.keys(members));
        for (var i = 0; i < reps.length; i += 1) {
            var coords = [];
            for (var j = 0; j < members[reps[i]].length; j += 1) {
                var cell_id = members[reps[i]][j].split('-');
                var row = parseInt(cell_id[0]);
                var col = parseInt(cell_id[1]);
                coords.push([row, col]);
            }
            partition.push(coords);
        }
        return partition;
    }

    function create_cell(demographics, id_prefix, row, col, toggleable) {
        var td = $('<td>');
        td.addClass('cell');
        if (!demographics[row][col]['active']) {
            td.addClass('empty-cell');
        } else {
            var parties = demographics[row][col]['parties'];
            if (parties[0] > parties[1]) {
                td.addClass('red-cell');
            } else if (parties[1] > parties[0]) {
                td.addClass('blue-cell');
            } else if (parties[0] === parties[1]) {
                td.addClass('purple-cell');
            }
        }

        td.attr('id', id_prefix + '-' + row + '-' + col);
        var span = $('<span>');
        span.addClass('dot');
        if (toggleable) {
            td.hover(cell_on_hover);
            td.click(cell_on_click);
            td.mouseleave(cell_on_mouseleave);
            span.click(dot_on_click);
        }
        td.append($('<div>').append(span));
        return td;
    }

    function create_row(demographics, id_prefix, toggleable, row, num_cols) {
        var tr = $('<tr>');
        for (var col = 0; col < num_cols; col += 1) {
            var border_id = id_prefix + '-' + row + '-' + (col - 1) + '-' + row + '-' + col;
            if (col === 0) {
                tr.append('<td class="border vertical-border active"></td>')
            } else if (toggleable) {
                tr.append('<td class="border vertical-border border-toggle inactive" id="' + border_id + '"></td>');
            } else {
                tr.append('<td class="border vertical-border" id="' + border_id + '"></td>');
            }
            tr.append(create_cell(demographics, id_prefix, row, col, toggleable));
        }
        tr.append('<td class="border vertical-border active"></td>');
        return tr;
    }

    function create_horizontal_border(id_prefix, toggleable, num_cols) {
        var row = -1;
        if (arguments.length === 4) {
            row = arguments[3];
        }
        var html = '<tr><td></td>';
        for (var col = 0; col < num_cols; col += 1) {
            var border_id = id_prefix + '-' + row + '-' + col + '-' + (row + 1) + '-' + col;
            if (row === -1) {
                html += '<td class="border horizontal-border active"><div></div></td>';
            } else if (toggleable) {
                html += '<td class="border horizontal-border border-toggle inactive" id="' + border_id + '"><div>';
                for (var i = 0; i < 50; i++) {
                    html += '&nbsp;'
                }
                html += '</div></td>';
            } else {
                html += '<td class="border horizontal-border" id="' + border_id + '"><div></div></td>';
            }
            html += '<td></td>';
        }
        html += '</tr>';
        return html;
    }

    function show_district_winners(map, demographics, borders, id_prefix) {
        var districts = compute_districts(demographics, borders, id_prefix);
        for (var i = 0; i < districts.length; i += 1) {
            var district = districts[i];
            var balance = 0;
            var count = 0
            for (var j = 0; j < district.length; j += 1) {
                var row_col = district[j];
                var row = row_col[0];
                var col = row_col[1];
                if (!demographics[row][col]['active']) {
                    continue
                }
                var parties = demographics[row][col]['parties'];
                count += 1;
                if (parties[0] > parties[1]) {
                    balance += 1;
                } else if (parties[1] > parties[0]) {
                    balance -= 1;
                }
            }
            var new_class = '';
            if (count === 0) {
                new_class = 'empty-district';
            } else if (balance > 0) {
                new_class = 'red-district';
            } else if (balance < 0) {
                new_class = 'blue-district';
            } else {
                new_class = 'purple-district';
            }
            for (var j = 0; j < district.length; j += 1) {
                var cell = map.find('#' + id_prefix + '-' + district[j][0] + '-' + district[j][1]);
                cell.removeClass('empty-district');
                cell.removeClass('red-district');
                cell.removeClass('blue-district');
                cell.removeClass('purple-district');
                cell.addClass(new_class);
            }
        }
    }

    function color_borders(map, demographics, borders, id_prefix) {
        // vertical borders
        for (var row = 0; row < demographics.length; row += 1) {
            for (var col = 1; col < demographics[0].length; col += 1) {
                var border_id = row + '-' + (col - 1) + '-' + row + '-' + col;
                if (!borders.includes(border_id)) {
                    var cell_id = id_prefix + '-' + row + '-' + col;
                    var classes = map.find('#' + cell_id).attr('class').split(' ');
                    for (var i = 0; i < classes.length; i += 1) {
                        if (classes[i].endsWith('-district')) {
                            map.find('#' + id_prefix + '-' + border_id).addClass(classes[i]);
                        }
                    }
                }
            }
        }
        // horizontal borders
        for (var col = 0; col < demographics[0].length; col += 1) {
            for (var row = 1; row < demographics.length; row += 1) {
                var border_id = (row - 1) + '-' + col + '-' + row + '-' + col;
                if (!borders.includes(border_id)) {
                    var cell_id = id_prefix + '-' + row + '-' + col;
                    var classes = map.find('#' + cell_id).attr('class').split(' ');
                    for (var i = 0; i < classes.length; i += 1) {
                        if (classes[i].endsWith('-district')) {
                            map.find('#' + id_prefix + '-' + border_id).addClass(classes[i]);
                        }
                    }
                }
            }
        }
    }

    function create_map(demographics, borders, id_prefix) {
        var toggleable = (id_prefix === MAIN_PREFIX);
        var num_rows = demographics.length;
        var num_cols = demographics[0].length;
        var table = $('<table class="electoral-map" id="' + id_prefix + '-map">');
        if (id_prefix !== MAIN_PREFIX) {
            table.addClass('solution-map');
        }
        table.append(create_horizontal_border(id_prefix, toggleable, num_cols));
        for (var row = 0; row < num_rows; row += 1) {
            table.append(create_row(demographics, id_prefix, toggleable, row, num_cols));
            if (row === num_rows - 1) {
                table.append(create_horizontal_border(id_prefix, toggleable, num_cols));
            } else {
                table.append(create_horizontal_border(id_prefix, toggleable, num_cols, row));
            }
        }
        show_district_winners(table, demographics, borders, id_prefix);
        for (var border_index = 0; border_index < borders.length; border_index += 1) {
            var border = table.find('#' + id_prefix + '-' + borders[border_index]);
            if (border.length > 0) {
                border_toggle(border, true);
            }
        }
        if (toggleable) {
            table.find('.border-toggle').click(border_on_click);
        } else {
            color_borders(table, demographics, borders, id_prefix);
        }
        return table;
    }

    function solve() {
        var objective = read_objective_function();
        var data = {
            'num_districts': parseInt($('#num-districts').val()),
            'demographics': DEMOGRAPHICS,
            'use_demographics': use_demographics(),
            'objective': objective
        };
        SOLUTION_DEMOGRAPHICS = copy(DEMOGRAPHICS);
        SOLUTION_USE_DEMOGRAPHICS = use_demographics();
        var solutions_title = $('#solutions');
        solutions_title.html(
            'Solving for ' + objective.substr(objective.indexOf(" ") + 1) + ' (this may take a minute...)'
        );
        solutions_title.show()
        $('#solutions-table').empty();
        $.post('/redistricting/solve', JSON.stringify(data))
            .done(function(response) {
                if (Object.keys(response).length === 0) {
                    $('#solutions').html('Invalid parameters');
                    return;
                }
                solutions_title.html('Optimized into ' + objective.substr(objective.indexOf(" ") + 1));
                SOLUTIONS = JSON.parse(response);
                create_solutions_table()
            })
            .fail(function () {
                $('#solutions').html('Optimization failed (took too long)');
            });
    }

    function create_solutions_table() {
        var table = $('#solutions-table');
        var row_html = '<tr>';
        row_html += '<th>#</th>';
        row_html += '<th>Partition</th>';
        row_html += '<th># Districts (R/B)</th>';
        row_html += '<th>Min/Mean/Max Population</th>';
        // row_html += '<th>Efficiency Gap</th>';
        row_html += '</tr>';
        table.append(row_html);

        if (SOLUTIONS.length > 100) {
            $('#solutions').append(' (showing 100 of ' + SOLUTIONS.length + ')');
        }

        for (var solution_id = 0; solution_id < SOLUTIONS.length; solution_id += 1) {

            if (solution_id >= 100) {
                break;
            }

            var solution_prefix = 's' + solution_id;

            var districts = SOLUTIONS[solution_id]['districts'];
            var partition_borders = SOLUTIONS[solution_id]['borders'];
            var red_districts = 0;
            var blue_districts = 0;
            var populations = [];
            for (var district_id = 0; district_id < districts.length; district_id += 1) {
                var district = districts[district_id];
                var district_pop = 0;
                var red_pop = 0;
                var blue_pop = 0;
                for (var j = 0; j < district.length; j += 1) {
                    var row = district[j][0];
                    var col = district[j][1];
                    var cell = SOLUTION_DEMOGRAPHICS[row][col];
                    if (!cell['active']) {
                        continue
                    }
                    if (SOLUTION_USE_DEMOGRAPHICS) {
                        district_pop += cell['population'];
                        red_pop += cell['parties'][0] * cell['population'] / 100;
                        blue_pop += cell['parties'][1] * cell['population'] / 100;
                    } else {
                        district_pop += 1;
                        if (cell['parties'][0] > cell['parties'][1]) {
                            red_pop += 1;
                        } else if (cell['parties'][1] > cell['parties'][0]) {
                            blue_pop += 1;
                        }
                    }

                }
                if (red_pop > blue_pop) {
                    red_districts += 1;
                } else if (blue_pop > red_pop) {
                    blue_districts += 1;
                }
                populations.push(district_pop);
            }

            var tr = $('<tr class="solution-row">');
            // solution ID
            tr.append($('<td>')
                .append('<span class="solution-number">Solution #' + (solution_id + 1) + '</span><br>(')
                .append($('<span class="districts-toggle" id="' + solution_prefix + '-toggle">show district stats</span>')
                    .click(expand_solution_districts)
                )
                .append(')')
            );
            // map
            var solution_map = create_map(SOLUTION_DEMOGRAPHICS, partition_borders, solution_prefix);
            solution_map.click(load_solution).addClass('clickable-solution');
            tr.append($('<td>').append(solution_map))
            // # districts (red/blue)
            tr.append('<td>' + districts.length + ' (' + red_districts + '/' + blue_districts + ')</td>')
            // mean size
            var min_pop = -1;
            var max_pop = -1;
            var total_pop = 0;
            for (var j = 0; j < populations.length; j += 1) {
                var pop = populations[j];
                if (min_pop < 0 || pop < min_pop) {
                    min_pop = pop;
                }
                if (max_pop < 0 || pop > max_pop) {
                    max_pop = pop;
                }
                total_pop += pop;
            }
            tr.append('<td>' + min_pop + ' / ' + Math.round(total_pop / districts.length) + ' / ' + max_pop + '</td>')
            // efficiency gap
            //tr.append('<td></td>')
            table.append(tr);

            var districts_row = $('<tr id="' + solution_prefix + '-districts-row">')
                .append($('<td colspan="1">'))
                .append($('<td colspan="3">').append(create_districts_table(SOLUTION_DEMOGRAPHICS, districts, partition_borders, SOLUTION_USE_DEMOGRAPHICS, solution_id)))
                .hide();
            table.append(districts_row);
        }
    }

    function create_districts_table(demographics, districts, borders, use_demographics, solution_id) {
        var table = $('<table class="districts-table">');

        var row_html = '<tr>';
        row_html += '<th></th>';
        row_html += '<th></th>';
        row_html += '<th>Population (R/B)</th>';
        row_html += '<th>Demographics</th>';
        row_html += '</tr>';
        table.append(row_html);

        for (var district_id = 0; district_id < districts.length; district_id += 1) {
            var district = districts[district_id];
            var demo_copy = copy(demographics);
            var district_str = [];
            var population = 0;
            var red_pop = 0;
            var blue_pop = 0;
            for (var j = 0; j < district.length; j += 1) {
                var row = district[j][0];
                var col = district[j][1];
                district_str.push(row + '-' + col);
                var cell = demo_copy[row][col];
                if (!cell['active']) {
                    continue
                }
                if (use_demographics) {
                    population += cell['population'];
                    red_pop += cell['parties'][0] * cell['population'] / 100;
                    blue_pop += cell['parties'][1] * cell['population'] / 100;
                } else {
                    population += 1;
                    if (cell['parties'][0] > cell['parties'][1]) {
                        red_pop += 1;
                    } else if (cell['parties'][1] > cell['parties'][0]) {
                        blue_pop += 1;
                    }
                }
            }
            var district_prefix = 's' + solution_id + 'd' + district_id;
            for (var row = 0; row < demo_copy.length; row += 1) {
                for (var col = 0; col < demo_copy[0].length; col += 1) {
                    if (!district_str.includes(row + '-' + col)) {
                        demo_copy[row][col]['active'] = false;
                    }
                }
            }

            var tr= $('<tr>');
            tr.append('<td>District ' + (district_id + 1) + '</td>');
            tr.append($('<td>').append(create_map(demo_copy, borders, district_prefix)));
            tr.append('<td>' + population + ' (' + Math.round(red_pop) + '/' + Math.round(blue_pop) + ')</td>');
            if (use_demographics) {
                var races = [0, 0, 0, 0];
                for (var j = 0; j < district.length; j += 1) {
                    var row = district[j][0];
                    var col = district[j][1];
                    var cell = demographics[row][col];
                    for (var race_id = 0; race_id < RACES.length; race_id += 1) {
                        races[race_id] += cell['races'][race_id] * cell['population'] / 100;
                    }
                }
                tr.append($('<ul style="text-align:left;">')
                    .append('<li>Asian: ' + Math.round(100 * races[0] / population) + '%</li>')
                    .append('<li>Black: ' + Math.round(100 * races[1] / population)+ '%</li>')
                    .append('<li>Caucasian: ' + Math.round(100 * races[2] / population) + '%</li>')
                    .append('<li>Hispanic: ' + Math.round(100 * races[3] / population) + '%</li>'));

            } else {
                tr.append('<td>N/A</td>')
            }

            table.append(tr);
        }
        return table
    }

    function populate_num_districts() {
        var num_districts_selector = $('#num-districts');
        var curr_num_districts = parseInt(num_districts_selector.val());
        var board_size = 0;
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                if (DEMOGRAPHICS[row][col]['active']) {
                    board_size += 1;
                }
            }
        }
        if (board_size === 0) {
            board_size = num_rows * num_cols;
        }
        var selected = false;
        num_districts_selector.empty();
        for (var factor = 1; factor < board_size + 1; factor += 1) {
            if (factor > 2 && (!selected || factor === curr_num_districts)) {
                num_districts_selector.append('<option selected>' + factor + '</option>');
                selected = true;
            } else {
                num_districts_selector.append('<option>' + factor + '</option>');
            }
        }
    }

    function border_toggle(border) {
        var border_id = border.attr('id');
        var turn_on = false;
        if (arguments.length === 1) {
            turn_on = (border.css('background-color') !== 'rgb(0, 0, 0)');
        } else {
            turn_on = arguments[1];
        }
        if (turn_on) {
            border.removeClass('inactive');
            border.addClass('active');
            if (border_id.startsWith(MAIN_PREFIX)) {
                var parts = border_id.split('-');
                var row1 = parts[1];
                var col1 = parts[2];
                var row2 = parts[3];
                var col2 = parts[4];
                var border_coord = row1 + '-' + col1 + '-' + row2 + '-' + col2;
                if (!BORDERS.includes(border_coord)) {
                    BORDERS.push(border_coord);
                }
            }
        } else {
            border.removeClass('active');
            border.addClass('inactive');
            if (border_id.startsWith(MAIN_PREFIX)) {
                var parts = border_id.split('-');
                var row1 = parts[1];
                var col1 = parts[2];
                var row2 = parts[3];
                var col2 = parts[4];
                var border_coord = row1 + '-' + col1 + '-' + row2 + '-' + col2;
                if (BORDERS.includes(border_coord)) {
                    BORDERS.splice(BORDERS.indexOf(border_coord), 1);
                }
            }
        }
    }

    function size_on_change() {
        var control = $(this);
        var new_size = parseInt(control.val());
        if (Number.isNaN(new_size)) {
            if (control.attr('id').endsWith('rows')) {
                control.val(DEMOGRAPHICS.length);
            } else {
                control.val(DEMOGRAPHICS[0].length);
            }
            return;
        }
        if (new_size < 2) {
            control.val(2);
        } else if (new_size > 5) {
            control.val(5);
        }
        create_board();
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        save_demographics();
    }

    function clear_population_on_click() {
        BORDERS = [];
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                DEMOGRAPHICS[row][col]['active'] = false;
            }
        }
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        populate_num_districts();
        display_main_districts();
        save_demographics();
    }

    function randomize_population_on_click() {
        BORDERS = [];
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                DEMOGRAPHICS[row][col] = create_population(true, null);
            }
        }
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        populate_num_districts();
        display_main_districts();
        save_demographics();
    }

    function clear_borders_on_click() {
        BORDERS = [];
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        display_main_districts();
        save_demographics();
    }

    function mode_on_change() {
        if (use_demographics()) {
            $('#demographic-info').show();
            $('#' + MAIN_PREFIX + '-' + SELECTED_ROW + '-' + SELECTED_COL).addClass('selected-cell');
            $('#main-map').addClass('use-demographics');
            display_demographics(SELECTED_ROW, SELECTED_COL);
        } else {
            $('#demographic-info').hide();
            $('#' + MAIN_PREFIX + '-' + SELECTED_ROW + '-' + SELECTED_COL).removeClass('selected-cell');
            $('#main-map').removeClass('use-demographics');
        }
        display_main_districts();
        save_demographics();
    }

    function display_main_districts() {
        var main_districts = $('#main-districts');
        main_districts.empty();
        main_districts.append(create_districts_table(
            DEMOGRAPHICS,
            compute_districts(DEMOGRAPHICS, BORDERS, MAIN_PREFIX),
            BORDERS,
            use_demographics(),
            MAIN_PREFIX
        ));
    }

    function border_on_click() {
        var border = $(this);
        border_toggle(border);
        show_district_winners($('#main-map'), DEMOGRAPHICS, BORDERS, MAIN_PREFIX);
        display_main_districts();
        save_demographics();
    }

    function cell_on_click() {
        if (!use_demographics()) {
            return;
        }
        var td = $(this);
        var row_col = td.attr('id').split('-');
        var row = parseInt(row_col[1]);
        var col = parseInt(row_col[2]);
        $('#' + MAIN_PREFIX + '-' + SELECTED_ROW + '-' + SELECTED_COL).removeClass('selected-cell');
        SELECTED_ROW = row;
        SELECTED_COL = col;
        td.addClass('selected-cell');
        display_demographics(row, col);
    }

    function cell_on_mouseleave() {
        if (!use_demographics()) {
            return;
        }
        display_demographics(SELECTED_ROW, SELECTED_COL);
        $('#' + MAIN_PREFIX + '-' + SELECTED_ROW + '-' + SELECTED_COL).addClass('selected-cell');
    }

    function cell_on_hover() {
        if (!use_demographics()) {
            return;
        }
        $('#' + MAIN_PREFIX + '-' + SELECTED_ROW + '-' + SELECTED_COL).removeClass('selected-cell');
        var td = $(this);
        var row_col = td.attr('id').split('-');
        var row = parseInt(row_col[1]);
        var col = parseInt(row_col[2]);
        display_demographics(row, col);
    }

    function display_demographics(row, col) {
        if (!use_demographics()) {
            return;
        }
        var cell = DEMOGRAPHICS[row][col];
        var info = $('#demographic-info');
        info.empty();
        info.append('<h3>Precinct ' + (row + 1) + '-' + (col + 1) + '</h3>');
        if (!cell['active']) {
            info.append('<p>Unpopulated</p>');
            return
        }
        info.append('<p><strong>Demographics</strong></p>')
        var slider_table = '<table id="demographic-slider-table">';
        slider_table += '<tr>';
        slider_table += '<th>Population</th>';
        slider_table += '<td class="demographic-readout-cell"><span id="population-readout">' + cell['population'] + '</span></td>';
        slider_table += '<td><input type="range" id="population-slider" min="100" max="2000" value="' + cell['population'] + '"></td>';
        slider_table += '</tr>';
        for (var i = 0; i < RACES.length; i += 1) {
            var race = RACES[i];
            slider_table += '<tr>';
            slider_table += '<td class="race-label-cell">&bull; ' + capitalize(race) + '</td>';
            slider_table += '<td class="demograhic-readout-cell"><span id="' + race + '-readout">(' + cell['races'][i] + '%)</span></td>';
            slider_table += '<td><input class="race-slider" type="range" id="' + race + '-slider" min="0" max="100" value="' + cell['races'][i] + '"></td>';
            slider_table += '</tr>';
        }
        slider_table += '<tr></tr>';
        slider_table += '<tr>';
        slider_table += '<th>Prior Results</th>';
        slider_table += '<td></td>';
        slider_table += '<td><input type="range" id="party-slider" min="0" max="100" value="' + cell['parties'][0] + '"></td>';
        slider_table += '</tr>';
        for (var i = 0; i < PARTIES.length; i += 1) {
            var party = PARTIES[i];
            slider_table += '<tr>';
            slider_table += '<td class="race-label-cell">&bull; ' + capitalize(party) + '</td>';
            slider_table += '<td class="demograhic-readout-cell"><span id="' + party + '-readout">(' + cell['parties'][i] + '%)</span></td>';
            slider_table += '<td></td>';
            slider_table += '</tr>';
        }
        slider_table += '</table>';
        slider_table = $(slider_table);
        slider_table.find('input#population-slider').on('change input', population_slider_on_change);
        slider_table.find('input.race-slider').on('change input', race_slider_on_change);
        slider_table.find('input#party-slider').on('change input', party_slider_on_change);
        info.append($('<p>')
            .append($(slider_table))
        );
    }

    function dot_on_click() {
        var cell = $(this).parent().parent();
        var row_col = cell.attr('id').split('-');
        var row = parseInt(row_col[1]);
        var col = parseInt(row_col[2]);
        var parties = DEMOGRAPHICS[row][col]['parties'];
        if (!DEMOGRAPHICS[row][col]['active']) {
            DEMOGRAPHICS[row][col]['active'] = true;
            if (parties[1] > parties[0]) {
                DEMOGRAPHICS[row][col]['parties'] = [parties[1], parties[0]];
            }
        } else if (parties[0] > parties[1]) {
            if (parties[0] > parties[1]) {
                DEMOGRAPHICS[row][col]['parties'] = [parties[1], parties[0]];
            }
        } else if (parties[1] > parties[0]) {
            DEMOGRAPHICS[row][col]['active'] = false;
        }
        populate_num_districts();
        var new_cell = $(create_cell(DEMOGRAPHICS, MAIN_PREFIX, row, col, true));
        cell.replaceWith(new_cell);
        show_district_winners($('#main-map'), DEMOGRAPHICS, BORDERS, MAIN_PREFIX);
        display_demographics(row, col);
        display_main_districts()
        save_demographics();
    }

    function population_slider_on_change() {
        var slider = $(this);
        $('#population-readout').html(slider.val());
        DEMOGRAPHICS[SELECTED_ROW][SELECTED_COL]['population'] = parseInt(slider.val());
        save_demographics();
    }

    function race_slider_on_change() {
        var slider = $(this);
        var race = slider.attr('id').split('-')[0];
        var order = [];
        if (race === 'hispanic') {
            order = RACES.slice(0, RACES.length - 1).reverse();
        } else {
            var index = RACES.indexOf(race);
            for (var i = 1; i < RACES.length; i += 1) {
                order.push(RACES[(index + i) % RACES.length]);
            }
        }
        var total = 0;
        for (var i = 0; i < RACES.length; i += 1) {
            total += parseInt($('#' + RACES[i] + '-slider').val());
        }
        if (total < 100) {
            var to_change = $('#' + order[0] + '-slider');
            to_change.val(parseInt(to_change.val()) + (100 - total));
        } else if (total > 100) {
            for (var i = 0; i < order.length; i += 1) {
                var to_change = $('#' + order[i] + '-slider');
                var curr_value = parseInt(to_change.val());
                if (curr_value > (total - 100)) {
                    to_change.val(curr_value - (total - 100));
                    break;
                } else {
                    to_change.val(0);
                    total -= curr_value;
                }
            }
        }
        var cell = DEMOGRAPHICS[SELECTED_ROW][SELECTED_COL];
        for (var i = 0; i < RACES.length; i += 1) {
            var race = RACES[i];
            var value = parseInt($('#' + race + '-slider').val());
            $('#' + race + '-readout').html('(' + value + '%)');
            cell['races'][i] = value;
        }
        save_demographics();
    }

    function party_slider_on_change() {
        var slider = $(this);
        $('#red-readout').html('(' + slider.val() + '%)');
        $('#blue-readout').html('(' + (100 - slider.val()) + '%)');
        DEMOGRAPHICS[SELECTED_ROW][SELECTED_COL]['parties'][0] = parseInt(slider.val());
        DEMOGRAPHICS[SELECTED_ROW][SELECTED_COL]['parties'][1] = 100 - parseInt(slider.val());
        var cell = $('#main-' + SELECTED_ROW + '-' + SELECTED_COL);
        var new_cell = $(create_cell(DEMOGRAPHICS, MAIN_PREFIX, SELECTED_ROW, SELECTED_COL, true));
        cell.replaceWith(new_cell);
        show_district_winners($('#main-map'), DEMOGRAPHICS, BORDERS, MAIN_PREFIX);
        //display_demographics(row, col);
        display_main_districts()
        save_demographics();
    }

    function expand_solution_districts() {
        var span = $(this);
        var solution_prefix = span.attr('id').split('-')[0];
        if (span.html().startsWith('show')) {
            span.empty();
            span.append('hide district stats');
        } else {
            span.empty();
            span.append('show district stats');
        }
        $('#' + solution_prefix + '-districts-row').toggle();
    }

    function load_solution() {
        var solution_id = parseInt($(this).attr('id').split('-')[0].substring(1));
        DEMOGRAPHICS = copy(SOLUTION_DEMOGRAPHICS);
        BORDERS = copy(SOLUTIONS[solution_id]['borders']);
        $('#num-rows').val(DEMOGRAPHICS.length);
        $('#num-cols').val(DEMOGRAPHICS[0].length);
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        populate_num_districts();
        display_main_districts();
        window.scrollTo(0, 0);
        save_demographics();
    }

    function attach_events() {
        $('#num-rows').change(size_on_change);
        $('#num-cols').change(size_on_change);
        $('#clear-population').click(clear_population_on_click);
        $('#randomize-population').click(randomize_population_on_click);
        $('#clear-borders').click(clear_borders_on_click);
        $('#mode-control').change(mode_on_change);
        $('#solve').click(solve);
        $(window).on('hashchange', window_on_hashchange);
    }

    function window_on_hashchange() {
        if (SAVING) {
            return;
        }
        window.location.reload();
    }

    // objective function

    function create_objective_function() {
        var minmax_select = $('<select>')
            .append('<option>minimizing</option>')
            .append('<option>maximizing</option>')
            .change(update_objective_function);
        var obj_func = $('#objective-function')
            .append($('<span>')
                .append('Create ')
                .append($('<select id="num-districts">'))
                .append(' districts while ')
                .append(minmax_select)
                .append(' the number of ')
                .append($('<select id="root-entity">')
                    .append('<option>districts</option>')
                    .append('<option>precincts</option>')
                )
                .append(' that ')
            )
            .append('.');
        obj_func.find('#root-entity')
            .change(root_entity_on_change)
            .change(update_objective_function)
            .trigger('change');
        obj_func.find('#num-districts').change(update_objective_function);
        populate_num_districts();
    };

    function root_entity_on_change() {
        var select = $(this);
        select.nextAll().remove();
        select.parent().append(' ');
        var new_clause = null;
        if (select.val().startsWith('districts')) {
            new_clause = create_district_condition();
        } else {
            new_clause = create_precinct_condition();
        }
        select.parent().append(new_clause);
        $(new_clause.find('select')[0]).trigger('change');
    }

    function create_district_condition() {
        var compare_select = create_compare_word();
        var entity_select = $('<select>')
            .append('<option>voters who</option>')
            .append('<option>precincts that</option>');
        var span = $('<span>')
            .append(' have ')
            .append($('<span>')
                .append(compare_select)
                .append('<span> </span>')
                .append(entity_select)
                .append(' ')
            );
        compare_select
            .change(district_condition_on_change)
            .change(update_objective_function)
            .trigger('change');
        entity_select
            .change(district_condition_on_change)
            .change(update_objective_function)
            .trigger('change');
        return span;
    }

    function district_condition_on_change() {
        var parent_span = $(this).parent();
        var grandparent_span = parent_span.parent();
        parent_span.nextAll().remove();
        var selects = parent_span.find('select');
        var compare_val = $(selects[0]).val();
        var entity_val = $(selects[1]).val();
        if (compare_val === '') {
            parent_span.find('span').html(' ');
            if (entity_val.startsWith('voters')) {
                grandparent_span.append(create_demographic_attribute());
            } else {
                grandparent_span.append(create_precinct_condition());
            }
        } else {
            if (entity_val.startsWith('voters')) {
                parent_span.find('span').html(' ');
                grandparent_span.append(create_demographic_comparison());
            } else {
                var indent = '&nbsp;'.repeat(10);
                parent_span.find('span').html('<br>' + indent);
                grandparent_span.append($('<span>')
                    .append(create_precinct_condition())
                    .append('<br>than/as <br>' + indent + 'precincts that ')
                    .append(create_precinct_condition())
                );
            }
        }
    }

    function create_precinct_condition() {
        var compare_select = create_compare_word();
        var entity_select = $('<select>')
            .append('<option>voters who</option>')
            .append('<option>neighboring precincts that</option>');
        var span = $('<span>')
            .append(' have ')
            .append($('<span>')
                .append(compare_select)
                .append('<span> </span>')
                .append(entity_select)
                .append(' ')
            );
        compare_select
            .change(precinct_condition_on_change)
            .change(update_objective_function)
            .trigger('change');
        entity_select
            .change(precinct_condition_on_change)
            .change(update_objective_function)
            .trigger('change');
        return span;
    }

    function precinct_condition_on_change() {
        var parent_span = $(this).parent();
        var grandparent_span = parent_span.parent();
        parent_span.nextAll().remove();
        var selects = parent_span.find('select');
        var compare_val = $(selects[0]).val();
        var entity_val = $(selects[1]).val();
        if (compare_val === '') {
            parent_span.find('span').html(' ');
            if (entity_val.startsWith('voters')) {
                grandparent_span.append(create_demographic_attribute());
            } else {
                grandparent_span.append(create_neighbor_attribute());
            }
        } else {
            if (entity_val.startsWith('voters')) {
                parent_span.find('span').html(' ');
                grandparent_span.append(create_demographic_comparison());
            } else {
                var half_indent = '&nbsp;'.repeat(10);
                var indent = '&nbsp;'.repeat(20);
                parent_span.find('span').html('<br>' + indent);
                grandparent_span.append($('<span>')
                    .append(create_neighbor_attribute())
                    .append('<br>' + half_indent + 'than/as <br>' + indent + 'neighboring precincts that ')
                    .append(create_neighbor_attribute())
                );
            }
        }
    }

    function create_neighbor_attribute() {
        return $('<select>')
            .append('<option>are in the same district</option>')
            .append('<option>are in a different district</option>')
            .change(update_objective_function);
    }

    function create_demographic_comparison() {
        return $('<span>')
            .append(create_demographic_attribute())
            .append(' than/as voters who ')
            .append(create_demographic_attribute());
    }

    function create_demographic_attribute() {
        return $('<select>')
            .append('<option>are Caucasian</option>')
            .append('<option>are Black</option>')
            .append('<option>are Asian</option>')
            .append('<option>are Hispanic</option>')
            .append('<option>vote Red</option>')
            .append('<option>vote Blue</option>')
            .change(update_objective_function);
    }

    function create_compare_word() {
        return $('<select>')
            .append('<option></option>')
            .append('<option>more</option>')
            .append('<option>fewer</option>')
            .append('<option>the same number of</option>')
            .change(update_objective_function);
    }

    function update_objective_function() {
        var selects = $('#objective-function select');
        OBJECTIVE = [];
        for (var i = 0; i < selects.length; i += 1)  {
            OBJECTIVE.push($(selects[i]).val());
        }
        save_demographics();
    }

    function read_objective_function() {
        var text = $('#objective-function').html();
        text = text.replace(new RegExp('<select.*?</select>', 'g'), 'FIXME');
        text = text.replace(new RegExp('<[^>]*>', 'g'), ' ');
        text = text.replace(new RegExp('&nbsp;', 'g'), ' ');
        var selects = $('#objective-function select');
        for (var i = 0; i < selects.length; i += 1)  {
            text = text.replace('FIXME', $(selects[i]).val());
        }
        text = text.replace(new RegExp(' +', 'g'), ' ');
        text = text.replace(' .', '.');
        return text.trim();
    }

    // URL

    function param(obj) {
        return $.param(obj, false);
    }

    function deparam(str) {
        var obj = {};
        str.replace(/([^=&]+)=([^&]*)/g, function(m, key, value) {
            obj[decodeURIComponent(key)] = decodeURIComponent(value);
        });
        return obj;
    }

    function load_demographics() {
        var hashed_obj = deparam(location.hash.substr(1));
        if (hashed_obj['demographics'] !== undefined) {
            DEMOGRAPHICS = JSON.parse(atob(hashed_obj['demographics']));
            BORDERS = JSON.parse(atob(hashed_obj['borders']));
            $('#mode-control').prop('checked', JSON.parse(atob(hashed_obj['use_demographics'])));
            $('#num-rows').val(DEMOGRAPHICS.length);
            $('#num-cols').val(DEMOGRAPHICS[0].length);
            $('#main-map-container').empty();
            $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
            populate_num_districts();
            display_main_districts();
            var objective = JSON.parse(atob(hashed_obj['objective']));
            for (var i = 0; i < objective.length; i += 1) {
                $($('#objective-function select')[i]).val(objective[i]).trigger('change');
            }
        }
    }

    function save_demographics() {
        if (LOADING) {
            return;
        }
        SAVING = true;
        location.hash = param({
            'demographics': btoa(JSON.stringify(DEMOGRAPHICS)),
            'borders': btoa(JSON.stringify(BORDERS)),
            'use_demographics': btoa(JSON.stringify(use_demographics())),
            'objective': btoa(JSON.stringify(OBJECTIVE))
        });
        window.setTimeout(function () { SAVING = false ; }, 5000);
    }

    function main() {
        LOADING = true;
        create_board();
        attach_events();
        create_objective_function();
        load_demographics();
        mode_on_change();
        LOADING = false;
    }

    main();
});
