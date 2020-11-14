// on load
$(function () {
    'use strict';
    var DEFAULT_BOARD = [
        ['R', 'R', 'R', 'B', 'B'],
        ['R', 'R', 'R', 'B', 'B'],
        ['R', 'R', 'R', 'B', 'B']
    ];
    var LOADING = false;
    var SAVING = false;
    var DEMOGRAPHICS = [];
    var BORDERS = [];
    var OBJECTIVE = [];
    var SOLUTION_DEMOGRAPHICS = [];
    var SOLUTIONS = [];
    var SELECTED_ROW = 0;
    var SELECTED_COL = 0;

    var PARTIES = ['red', 'blue'];

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

    function rand_range(min, max) {
        return min + Math.floor(Math.random() * (max - min));
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substring(1);
    }

    function create_population(active, preference) {
        if (!active) {
            return '-';
        } else if (Math.random() < 0.5) {
            return 'R';
        } else {
            return 'B';
        }
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
        if (demographics[row][col] === '-') {
            td.addClass('empty-cell');
        } else if (demographics[row][col] === 'R') {
            td.addClass('red-cell');
        } else {
            td.addClass('blue-cell');
        }

        td.attr('id', id_prefix + '-' + row + '-' + col);
        var span = $('<span>');
        span.addClass('dot');
        if (toggleable) {
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
                if (demographics[row][col] === '-') {
                    continue
                }
                count += 1;
                if (demographics[row][col] === 'R') {
                    balance += 1;
                } else if (demographics[row][col] === 'B') {
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
        var table = null;
        if (id_prefix === '') {
            table = $('<table class="electoral-map">');
        } else {
            table = $('<table class="electoral-map" id="' + id_prefix + '-map">');
        }
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
        color_borders(table, demographics, borders, id_prefix);
        return table;
    }

    function solve() {
        var data = {
            'num_districts': parseInt($('#num-districts').val()),
            'demographics': DEMOGRAPHICS,
        };
        SOLUTION_DEMOGRAPHICS = copy(DEMOGRAPHICS);
        var trace_table = $('#trace-list');
        trace_table.empty();
        $.post('/dyna_prog/solve', JSON.stringify(data))
            .done(function(response) {
                trace_table.empty();
                response = JSON.parse(response);
                create_trace_list(response, $('#trace-list'));
            })
            .fail(function () {
                $('#solutions').html('Optimization failed (took too long)');
            });
    }

    function create_districts_demographics(districts) {
        var demo_copy = copy(SOLUTION_DEMOGRAPHICS);
        var district_str = [];
        for (var district_id = 0; district_id < districts.length; district_id += 1) {
            var district = districts[district_id];
            for (var j = 0; j < district.length; j += 1) {
                var row = district[j][0];
                var col = district[j][1];
                district_str.push(row + '-' + col);
            }
        }
        for (var row = 0; row < demo_copy.length; row += 1) {
            for (var col = 0; col < demo_copy[0].length; col += 1) {
                if (!district_str.includes(row + '-' + col)) {
                    demo_copy[row][col] = '-';
                }
            }
        }
        return demo_copy;
    }

    function create_trace_list(trace, list) {
        var calls = trace['calls'];
        if (calls.length == 0) {
            var li = $('<li>');
            li.append($('<h3>Only one district remaining: </h3>'));
            var map = create_map(
                create_districts_demographics(trace['state']['districts']),
                trace['state']['borders'],
                ''
            ).addClass('partition');
            li.append(map)
            li.append($('<h3> (base case)</h3>'));
            list.append(li);
        } else {
            var li = $('<li>');
            li.append($('<h3>Solving </h3>'))
            li.append(create_map(
                create_districts_demographics(trace['state']['districts']),
                trace['state']['borders'],
                ''
            ).addClass('partition'));
            var trace_toggle = $('<a href="">toggle trace</a>');
            trace_toggle.click(function (event) {
                $('#' + trace['id']).toggle();
                return false;
            });
            li.append(' (').append(trace_toggle).append(')');
            list.append(li);

            var child_list = $('<ul class="first-districts">');
            for (var i = 0; i < calls.length; i++) {
                var call = calls[i];
                var child = $('<li>');

                child.append($('<h3>Trying </h3>'));
                child.append(create_map(
                    create_districts_demographics(call['first_district']['districts']),
                    call['first_district']['borders'],
                    ''
                ).addClass('partition'));
                child.append($('<h3> as the first district and recursing on </h3>'));
                child.append(create_map(
                    create_districts_demographics(call['trace']['state']['districts']),
                    call['trace']['state']['borders'],
                    ''
                ).addClass('partition'));
                var call_id = call['trace']['id'] + '-call';
                var trace_toggle = $('<a href="">toggle trace</a>').attr('id', call_id + '-toggle');
                trace_toggle.click(function (event) {
                    var toggle_id = event.target.id;
                    $('#' + event.target.id.substring(0, toggle_id.length - 7)).toggle();
                    return false;
                });
                child.append(' (').append(trace_toggle).append(')');
                child_list.append(child);

                var subtable = $('<ul class="trace">');
                create_trace_list(call['trace'], subtable);
                subtable.attr('id', call['trace']['id'] + '-call').toggle();
                child_list.append($('<li>').append(subtable));

                child = $('<li>');
                child.append('<h3>Candidate Gerrymanders: </h3>');
                for (var j = 0; j < call['partitions'].length; j++) {
                    child.append(create_map(
                        create_districts_demographics(call['partitions'][j]['districts']),
                        call['partitions'][j]['borders'],
                        ''
                    ).addClass('partition'));
                    child.append('&nbsp;');
                }
                child_list.append(child)
            }
            var list_item = $('<li>').append(child_list);
            list_item.toggle();
            list_item.attr('id', trace['id']);
            list.append(list_item);

            var child = $('<li>');
            child.append('<h3>All Candidate Gerrymanders: </h3>');
            for (var i = 0; i < trace['all_partitions'].length; i++) {
                child.append(create_map(
                    create_districts_demographics(trace['all_partitions'][i]['districts']),
                    trace['all_partitions'][i]['borders'],
                    ''
                ).addClass('partition'));
                child.append('&nbsp;');
            }
            list.append(child);

            var child = $('<li>');
            child.append('<h3>Best Gerrymanders: </h3>');
            for (var i = 0; i < trace['best_partitions'].length; i++) {
                child.append(create_map(
                    create_districts_demographics(trace['best_partitions'][i]['districts']),
                    trace['best_partitions'][i]['borders'],
                    ''
                ).addClass('partition'));
                child.append('&nbsp;');
            }
            list.append(child);

        }
    }

    function populate_num_districts() {
        var num_districts_selector = $('#num-districts');
        var curr_num_districts = parseInt(num_districts_selector.val());
        var board_size = 0;
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                if (DEMOGRAPHICS[row][col] !== '-') {
                    board_size += 1;
                }
            }
        }
        if (board_size === 0) {
            board_size = num_rows * num_cols;
        }
        var selected = false;
        num_districts_selector.empty();
        for (var factor = 1; factor < board_size; factor++) {
            if (board_size % factor !== 0) {
                continue;
            }
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
                DEMOGRAPHICS[row][col] = '-';
            }
        }
        $('#main-map-container').empty();
        $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
        populate_num_districts();
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
        save_demographics();
    }

    function dot_on_click() {
        var cell = $(this).parent().parent();
        var row_col = cell.attr('id').split('-');
        var row = parseInt(row_col[1]);
        var col = parseInt(row_col[2]);
        if (DEMOGRAPHICS[row][col] === '-') {
            DEMOGRAPHICS[row][col] = 'R';
        } else if (DEMOGRAPHICS[row][col] === 'R') {
            DEMOGRAPHICS[row][col] = 'B';
        } else {
            DEMOGRAPHICS[row][col] = '-';
        }
        populate_num_districts();
        var new_cell = $(create_cell(DEMOGRAPHICS, MAIN_PREFIX, row, col, true));
        cell.replaceWith(new_cell);
        show_district_winners($('#main-map'), DEMOGRAPHICS, BORDERS, MAIN_PREFIX);
        save_demographics();
    }

    function attach_events() {
        $('#num-rows').change(size_on_change);
        $('#num-cols').change(size_on_change);
        $('#clear-population').click(clear_population_on_click);
        $('#randomize-population').click(randomize_population_on_click);
        $('#solve').click(solve);
        $(window).on('hashchange', window_on_hashchange);
    }

    function window_on_hashchange() {
        if (SAVING) {
            return;
        }
        window.location.reload();
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
            $('#num-rows').val(DEMOGRAPHICS.length);
            $('#num-cols').val(DEMOGRAPHICS[0].length);
            $('#main-map-container').empty();
            $('#main-map-container').append(create_map(DEMOGRAPHICS, BORDERS, MAIN_PREFIX));
            populate_num_districts();
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
        });
        window.setTimeout(function () { SAVING = false ; }, 5000);
    }

    function main() {
        LOADING = true;
        create_board();
        attach_events();
        load_demographics();
        LOADING = false;
    }

    main();
});
