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
    var SOLUTION_DEMOGRAPHICS = [];

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

    function create_population(active, preference) {
        if (preference !== null) {
            return preference;
        } else if (!active) {
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
        var new_demo = [];
        for (var row = 0; row < num_rows; row += 1) {
            var new_demo_row = [];
            for (var col = 0; col < num_cols; col += 1) {
                if (from_default && row < DEFAULT_BOARD.length && col < DEFAULT_BOARD[0].length) {
                    new_demo_row.push(create_population(true, DEFAULT_BOARD[row][col]));
                } else if (row < DEMOGRAPHICS.length && col < DEMOGRAPHICS[0].length) {
                    new_demo_row.push(DEMOGRAPHICS[row][col]);
                } else {
                    new_demo_row.push(create_population(false, null));
                }
            }
            new_demo.push(new_demo_row);
        }
        DEMOGRAPHICS = new_demo;
        $('#main-map-container').html(create_map(DEMOGRAPHICS, [], MAIN_PREFIX));
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
        var td = $('<td class="cell">');
        if (demographics[row][col] === '-') {
            td.addClass('empty-cell');
        } else if (demographics[row][col] === 'R') {
            td.addClass('red-cell');
        } else {
            td.addClass('blue-cell');
        }

        td.attr('id', id_prefix + '-' + row + '-' + col);
        var span = $('<span class="dot">');
        if (toggleable) {
            span.click(dot_on_click);
        }
        return td.append($('<div>').append(span));
    }

    function create_row(demographics, id_prefix, toggleable, row, num_cols) {
        var tr = $('<tr>');
        for (var col = 0; col < num_cols; col += 1) {
            var border_id = id_prefix + '-' + row + '-' + (col - 1) + '-' + row + '-' + col;
            if (col === 0) {
                tr.append('<td class="border vertical-border active"></td>');
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
                cell.removeClass('empty-district red-district blue-district purple-district').addClass(new_class);
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
        var table = $('<table class="electoral-map">');
        if (id_prefix !== '') {
            table.attr('id', id_prefix + '-map');
        }
        if (id_prefix !== MAIN_PREFIX) {
            table.addClass('partition');
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
                border.removeClass('inactive');
                border.addClass('active');
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
        var trace_list = $('#trace-list');
        trace_list.html('Solving; this will take a moment...');
        $.post('/dyna_prog/solve', JSON.stringify(data))
            .done(function(response) {
                trace_list.empty();
                response = JSON.parse(response);
                create_trace_list(response, $('#trace-list'));
            })
            .fail(function () {
                trace_list.html('Optimization failed (took too long)');
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
        var calls = trace.calls;

        var list_item = $('<li>');
        list_item.append('Gerrymandering ').append(create_map(
            create_districts_demographics(trace.state.districts),
            trace.state.borders,
            ''
        )).append(' into ' + trace.num_districts + ' districts');
        if (trace.num_districts == 1) {
            list_item.append(' (base case)');
        } else {
            list_item.append(' (').append(
                $('<a href="">toggle trace</a>').click(function (event) {
                    $('#' + trace.id).toggle();
                    return false;
                })
            ).append(')');
        }
        list.append(list_item);

        var child_list = $('<ul class="first-districts">');
        if (trace.num_districts % 2 == 0) {
            child_list.addClass('even');
        } else {
            child_list.addClass('odd');
        }
        for (var i = 0; i < calls.length; i++) {
            var call = calls[i];
            var div = $('<div>');

            div.append('Trying ').append(create_map(
                create_districts_demographics(call.first_district.districts),
                call.first_district.borders,
                ''
            )).append(' as the first district and recursing on ').append(create_map(
                create_districts_demographics(call.trace.state.districts),
                call.trace.state.borders,
                ''
            )).append(' (').append(
                $('<a href="">toggle trace</a>').attr('id', call.trace.id + '-call-toggle').click(function (event) {
                    $('#' + event.target.id.substring(0, event.target.id.length - 7)).toggle();
                    return false;
                })
            ).append(')<br>');

            var sublist = $('<ul class="trace">');
            create_trace_list(call.trace, sublist);
            div.append($('<div>').attr('id', call.trace.id + '-call').append(sublist).toggle());

            div.append('Candidate Gerrymanders: ');
            for (var j = 0; j < call.partitions.length; j++) {
                div.append(create_map(
                    create_districts_demographics(call.partitions[j].districts),
                    call.partitions[j].borders,
                    ''
                )).append('&nbsp;');
            }

            child_list.append($('<li>').append(div));
        }
        list.append($('<li>').attr('id', trace.id).append(child_list).toggle());

        list_item = $('<li>').append('All Candidate Gerrymanders: ');
        for (var i = 0; i < trace.all_partitions.length; i++) {
            list_item.append(create_map(
                create_districts_demographics(trace.all_partitions[i].districts),
                trace.all_partitions[i].borders,
                ''
            )).append('&nbsp;');
        }
        list.append(list_item);

        list_item = $('<li>').append('Best Gerrymanders: ');
        for (var i = 0; i < trace.best_partitions.length; i++) {
            list_item.append(create_map(
                create_districts_demographics(trace.best_partitions[i].districts),
                trace.best_partitions[i].borders,
                ''
            )).append('&nbsp;');
        }
        list.append(list_item);
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
        $('#main-map-container').html(create_map(DEMOGRAPHICS, [], MAIN_PREFIX));
        save_demographics();
    }

    function clear_population_on_click() {
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                DEMOGRAPHICS[row][col] = '-';
            }
        }
        $('#main-map-container').html(create_map(DEMOGRAPHICS, [], MAIN_PREFIX));
        populate_num_districts();
        save_demographics();
    }

    function randomize_population_on_click() {
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                DEMOGRAPHICS[row][col] = create_population(true, null);
            }
        }
        $('#main-map-container').html(create_map(DEMOGRAPHICS, [], MAIN_PREFIX));
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
        cell.replaceWith(create_cell(DEMOGRAPHICS, MAIN_PREFIX, row, col, true));
        show_district_winners($('#main-map'), DEMOGRAPHICS, [], MAIN_PREFIX);
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

    function bound_range(value, min, max) {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        } else {
            return value;
        }
    }

    function load_demographics() {
        var hashed_obj = deparam(location.hash.substr(1));
        if (hashed_obj.demographics !== undefined) {
            var num_rows = bound_range(hashed_obj.rows, 2, 5);
            var num_cols = bound_range(hashed_obj.cols, 2, 5);
            var demo_str = hashed_obj.demographics;
            var new_demo = [];
            for (var row = 0; row < num_rows; row += 1) {
                var new_demo_row = [];
                for (var col = 0; col < num_cols; col += 1) {
                    new_demo_row.push(demo_str[row * num_cols + col]);
                }
                new_demo.push(new_demo_row);
            }
            DEMOGRAPHICS = new_demo;
            $('#num-rows').val(num_rows);
            $('#num-cols').val(num_cols);
            $('#main-map-container').html(create_map(DEMOGRAPHICS, [], MAIN_PREFIX));
            populate_num_districts();
        }
    }

    function save_demographics() {
        if (LOADING) {
            return;
        }
        SAVING = true;
        var demo_str = '';
        var num_rows = get_num_rows();
        var num_cols = get_num_cols();
        for (var row = 0; row < num_rows; row += 1) {
            for (var col = 0; col < num_cols; col += 1) {
                demo_str += DEMOGRAPHICS[row][col];
            }
        }
        location.hash = param({
            'rows': num_rows,
            'cols': num_cols,
            'demographics': demo_str,
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
