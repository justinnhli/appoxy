/*global
NUM_TRANSFORMS 
    */
var NUM_TRANSFORMS = 0;

if(typeof(String.prototype.trim) === 'undefined')
{
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

function init() {
    add_transform();
}

function empty_transforms() {
    $('#transforms').empty();
    NUM_TRANSFORMS = 0;
}

// FIXME each transform needs a delete button
function add_transform() {
    var transform_id = NUM_TRANSFORMS + 1;
    var list_item = $('<li></li>');
    var html = '<select id="transform' + transform_id + '_operation" onchange="change_operation_adaptor(this);">';
    html += '<option>select</option>';
    html += '<option>break apart</option>';
    html += '<option>insert</option>';
    html += '<option>delete</option>';
    html += '<option>replace</option>';
    html += '</select>';
    operation = $(html);
    $('#transforms').append(list_item);
    list_item.append(operation);
    change_to_select(operation, transform_id);
    NUM_TRANSFORMS += 1;
    return transform_id;
}

function change_operation_adaptor(e) {
    var operation = $(e);
    change_operation(operation);
}

function change_operation(operation) {
    var transform_id = Number(operation.prop('id').split('_')[0].substr(9));
    operation.nextAll().remove();
    if (operation.val() === 'select') {
        change_to_select(operation, transform_id);
    } else if (operation.val() === 'break apart') {
        change_to_break(operation, transform_id);
    } else if (operation.val() === 'insert') {
        change_to_insert(operation, transform_id);
    } else if (operation.val() === 'delete') {
        change_to_delete(operation, transform_id);
    } else if (operation.val() === 'replace') {
        change_to_replace(operation, transform_id);
    }
}

function change_to_select(operation, transform_id) {
    var transform = operation.parent();
    var html = '<span> text that </span>';
    transform.append(html);
    html = '<select id="transform' + transform_id + '_negation">';
    html += '<option>does</option>';
    html += '<option>does not</option>';
    html += '</select>';
    transform.append($(html));
    html = '<select id="transform' + transform_id + '_selector">';
    html += '<option>contain</option>';
    html += '<option>start with</option>';
    html += '<option>end with</option>';
    html += '</select>';
    transform.append($(html));
    add_text(transform, transform_id, 'text', true);
}

function change_to_break(operation, transform_id) {
    var transform = operation.parent();
    add_location(transform, transform_id, 'text');
}

function change_to_insert(operation, transform_id) {
    var transform = operation.parent();
    add_location(transform, transform_id, 'locator_text');
    add_text(transform, transform_id, 'text', false);
}

function change_to_delete(operation, transform_id) {
    var transform = operation.parent();
    var html = '<select id="transform' + transform_id + '_range">';
    html += '<option>until</option>';
    html += '<option>from</option>';
    html += '</select>';
    transform.append(html);
    add_location(transform, transform_id, 'text');
}

function change_to_replace(operation, transform_id) {
    var transform = operation.parent();
    add_text(transform, transform_id, 'before', true);
    transform.append($('<span> with </span>'));
    add_text(transform, transform_id, 'after', false);
}

function add_location(parent, transform_id, text_description) {
    var html = '<select id="transform' + transform_id + '_location">';
    html += '<option>before</option>';
    html += '<option>after</option>';
    html += '</select>';
    parent.append($(html));
    add_text(parent, transform_id, text_description, true);
}

function add_text(parent, transform_id, description, matching) {
    var html = '<select onchange="text_on_change(this);" id="transform' + transform_id + '_' + description + '">';
    if (matching) {
	html += '<option>Number</option>';
	html += '<option>Capital Letter</option>';
        html += '<option>Three Digits</option>';
    }
    html += '<option>Department Name</option>';
    html += '<option>Department Code</option>';
    html += '<option>(Other)</option>';
    html += '</select>';
    parent.append($(html));
    html = '<input type="text" id="transform' + transform_id + '_' + description + '_custom" disabled value="">';
    parent.append($(html));
}

function text_on_change(e) {
    var text = $(e);
    $('#' + text.attr('id') + '_custom').prop('disabled', (text.val() !== '(Other)'));
}

function parse_source() {
    var i;
    var tokens;
    var transform_id;
    var operation;
    empty_transforms();
    lines = $('#source').val().trim().split('\n');
    for (i = 0; i < lines.length; i += 1) {
        tokens = lines[i].split('\t');
        operation = tokens[0];
        transform_id = add_transform();
        $('#transform' + transform_id + '_operation').val(tokens[0]);
        change_operation($('#transform' + transform_id + '_operation'));
        if (operation === 'select') {
            parse_select(tokens, transform_id);
        } else if (operation === 'break apart') {
            parse_break(tokens, transform_id);
        } else if (operation === 'insert') {
            parse_insert(tokens, transform_id);
        } else if (operation === 'delete') {
            parse_delete(tokens, transform_id);
        } else if (operation === 'replace') {
            parse_replace(tokens, transform_id);
        }
    }
}

function parse_select(tokens, transform_id) {
    $('#transform' + transform_id + '_negation').val(tokens[1]);
    $('#transform' + transform_id + '_selector').val(tokens[2]);
    parse_text(tokens, 3, transform_id, 'text');
}

function parse_break(tokens, transform_id) {
    parse_location(tokens, 1, transform_id, 'text');
}

function parse_insert(tokens, transform_id) {
    var index = parse_location(tokens, 1, transform_id, 'locator_text');
    parse_text(tokens, index + 1, transform_id, 'text');
}

function parse_delete(tokens, transform_id) {
    $('#transform' + transform_id + '_range').val(tokens[1]);
    parse_location(tokens, 2, transform_id, 'text');
}

function parse_replace(tokens, transform_id) {
    var index = parse_text(tokens, 1, transform_id, 'before');
    parse_text(tokens, index + 1, transform_id, 'after');
}

function parse_location(tokens, index, transform_id, description) {
    $('#transform' + transform_id + '_location').val(tokens[index]);
    return parse_text(tokens, index + 1, transform_id, description);
}

function parse_text(tokens, index, transform_id, description) {
    if (tokens[index] === '') {
        $('#transform' + transform_id + '_' + description).val(tokens[index + 1]);
        $('#transform' + transform_id + '_' + description + '_custom').val('');
        return index + 1;
    } else {
        $('#transform' + transform_id + '_' + description).val('(Other)');
        $('#transform' + transform_id + '_' + description + '_custom').val(tokens[index]).prop('disabled', false);
        return index;
    }
}

function update_source() {
    var i;
    var num_transforms = $('#transforms').children('li').length;
    var selector;
    var operation;
    var result = '';
    for (i = 0; i < num_transforms; i += 1) {
        selector = $('#transform' + (i + 1) + '_operation');
        operation = selector.val();
        if (operation === 'select') {
            result += update_select(selector.parent(), i + 1) + '\n';
        } else if (operation === 'break apart') {
            result += update_break(selector.parent(), i + 1) + '\n';
        } else if (operation === 'insert') {
            result += update_insert(selector.parent(), i + 1) + '\n';
        } else if (operation === 'delete') {
            result += update_delete(selector.parent(), i + 1) + '\n';
        } else if (operation === 'replace') {
            result += update_replace(selector.parent(), i + 1) + '\n';
        }
    }
    $('#source').val(result.trim());
}

function update_select(list_item, transform_id) {
    var result = 'select\t';
    result += $('#transform' + transform_id + '_negation').val() + '\t';
    result += $('#transform' + transform_id + '_selector').val() + '\t';
    result += update_text($('#transform' + transform_id + '_text'));
    return result;
}

function update_break(list_item, transform_id) {
    var result = 'break apart\t';
    result += update_location($('#transform' + transform_id + '_location'));
    return result;
}

function update_insert(list_item, transform_id) {
    var result = 'insert\t';
    result += update_location($('#transform' + transform_id + '_location')) + '\t';
    result += update_text($('#transform' + transform_id + '_text'));
    return result;
}

function update_delete(list_item, transform_id) {
    var result = 'delete\t';
    result += $('#transform' + transform_id + '_range').val() + '\t';
    result += update_location($('#transform' + transform_id + '_location'));
    return result;
}

function update_replace(list_item, transform_id) {
    var result = 'replace\t';
    result += update_text($('#transform' + transform_id + '_before')) + '\t';
    result += update_text($('#transform' + transform_id + '_after'));
    return result;
}

function update_location(select) {
    return select.val() + '\t' + update_text(select.next());
}

function update_text(select) {
    var custom_text = select.next();
    if (select.val() === '(Other)') {
        return custom_text.val();
    } else {
        return '\t' + select.val();
    }
}

function run() {
    var i;
    var departments = $('.department');
    var department;
    var result = '';
    update_source();
    for (i = 0; i < departments.length; i += 1) {
        department = $(departments[i]);
        if (department.prop('checked')) {
            result += department.val() + '|';
        }
    }
    $.post('/info_ret/process', {program:$('#source').val(), departments:result}).done(function(response) {
        $('#results').empty();
        $('#results').append(response);
    });
}
