/*global
    $, Math, NUM_NEURONS, Number, Viz, clear_log, create_dot, log, run, toggle_pattern
*/
var NUM_NEURONS = 9;

function create_patterns() {
    var init = document.getElementById("init");
    init.innerHTML = '<tr><th>Neuron</th><th>Pattern 0<br>(Click to change)</th><th>Pattern 1<br>(Click to change)</th><th>Initial Weight</th></tr>';
    for (var i = 0; i < NUM_NEURONS; i++) {
        var row = '';
        row += `<tr><td>Neuron ${i+1}</td>`;
        var light = Math.floor(2 * Math.random());
        if (light === 0) {
            row += `<td id="neuron${i+1}pattern0" class="black" onclick="toggle_pattern(this);">&nbsp;</td>`;
        } else {
            row += `<td id="neuron${i+1}pattern0" class="white" onclick="toggle_pattern(this);">&nbsp;</td>`;
        }
        light = Math.floor(2 * Math.random());
        if (light === 0) {
            row += `<td id="neuron${i+1}pattern1" class="black" onclick="toggle_pattern(this);">&nbsp;</td>`;
        } else {
            row += `<td id="neuron${i+1}pattern1" class="white" onclick="toggle_pattern(this);">&nbsp;</td>`;
        }
        row += `<td><select id="weight${i+1}">`;
        var selected = Math.floor(4 * Math.random() - 2);
        for (var j = -2; j < 3; j++) {
            if (j === selected) {
                row += `<option selected="selected">${j/2}</option>`;
            } else {
                row += `<option>${j/2}</option>`;
            }
        }
        row += '</select></td></tr>';
        init.innerHTML += row;
    }
}

function toggle_pattern(td) {
    "use strict";
    var cell = $(td);
    if (cell.hasClass("white")) {
        cell.removeClass("white");
        cell.addClass("black");
    } else if (cell.hasClass("black")) {
        cell.removeClass("black");
        cell.addClass("white");
    } else {
        cell.addClass("black");
    }
}

function log(html) {
    "use strict";
    $("#log").append(html);
}

function clear_log() {
    "use strict";
    $("#log").empty();
}

function create_dot(activity, weights, activations, total, threshold, output) {
    "use strict";
    var i = 0;
    var dot = "";
    dot += "digraph {";
    dot += "    rankdir=LR";
    dot += "";
    dot += "    node [shape=square, style=filled, label=\"\"]";
    dot += "";
    for (i = 0; i < NUM_NEURONS; i += 1) {
        dot += "    n" + i + " [fillcolor=" + (activity[i] ? "white" : "black") + "]";
    }
    dot += "";
    dot += "    node [shape=box, style=\"\"]";
    dot += "";
    dot += "    sum [label=\"ADD UP\"]";
    dot += "    threshold [label=\"> " + threshold + "?\"]";
    dot += "    output [shape=none, fontsize=24, label=\"" + output + "\"]";
    dot += "";
    for (i = 0; i < NUM_NEURONS; i += 1) {
        dot += "    n" + i + " -> sum [label=\"" + activity[i] + " * " + weights[i].toFixed(1) + " = " + activations[i].toFixed(1) + "\"]";
    }
    dot += "";
    dot += "    sum -> threshold [label=\"" + total.toFixed(1) + "\"]";
    dot += "    threshold -> output";
    dot += "}";
    return dot;
}

function run() {
    "use strict";
    clear_log();
    var learning_rate = $("#learning_rate").val();
    var threshold = $("#threshold").val();
    var pattern = 0;
    var activity = [];
    var weights = [];
    var activations = [];
    var activation = 0;
    var total = 0;
    var output = 0;
    var graph = null;
    var html = "";
    var trial = 0;
    var change = 0;
    var correct = [false, false];
    var done = false;
    var i = 0;
    for (i = 0; i < NUM_NEURONS; i += 1) {
        weights.push(Number($("#weight" + (i + 1)).val()));
    }
    while (!done && trial < 100) {
        html = "<div>";
        html += "<h2>Trial " + (trial + 1) + "</h2>";
        // randomly select a pattern to present
        pattern = 0;
        if ($("#random").prop("checked")) {
            pattern = (Math.random() < 0.5 ? 0 : 1);
        } else {
            pattern = trial % 2;
        }
        activity = [];
        for (i = 0; i < NUM_NEURONS; i += 1) {
            if ($("#neuron" + (i + 1) + "pattern" + pattern).hasClass("white")) {
                activity.push(1);
            } else {
                activity.push(0);
            }
        }
        // for each neuron, calculate its activation = activity * weight
        activations = [];
        total = 0;
        for (i = 0; i < NUM_NEURONS; i += 1) {
            activation = activity[i] * weights[i];
            activations.push(activation);
            total += activation;
        }
        // compare to threshold
        output = 0;
        if (total >= threshold) {
            output = 1;
        } else {
            output = 0;
        }
        html += "<table class=\"trial\">";
        html += "<tr>";
        html += "<th>Input Pattern " + pattern + "</th>";
        html += "<th>Weights</th>";
        html += "<th>Multiplied</th>";
        html += "<th>Network classifies it as</th></tr>";
        html += "<tr>";
        html += "<td>";
        for (i = 0; i < NUM_NEURONS; i += 1) {
            if (activity[i]) {
                html += "<div class=\"input white\">1</div>";
            } else {
                html += "<div class=\"input black\">0</div>";
            }
        }
        html += "</td>";
        html += "<td>";
        for (i = 0; i < NUM_NEURONS; i += 1) {
            html += "<div>" + weights[i].toFixed(1) + "</div>";
        }
        html += "</td>";
        html += "<td>";
        for (i = 0; i < NUM_NEURONS; i += 1) {
            html += "<div>" + activations[i].toFixed(1) + "</div>";
        }
        html += "</td>";
        html += "<td>";
        graph = Viz(create_dot(activity, weights, activations, total, threshold, output));
        html += graph;
        html += "</td>";
        html += "</tr>";
        html += "</table>";
        html += "<p>";
        html += "The input is Pattern " + pattern + ", and the ANN thinks it is Pattern " + output + ". ";
        if (pattern === output) {
            // if correct, set correct* to true
            correct[pattern] = true;
            html += "The ANN is <strong>CORRECT</strong>, so the weights do not need to be adjusted.";
            html += "</p>";
        } else {
            // if incorrect, for each neuron, new weight = old weight + (active * difference * learning rate)
            html += "The ANN is <strong>INCORRECT</strong>; the weights will be adjusted:";
            html += "</p>";
            html += "<table>";
            html += "<tr><th>Neuron</th><th>Active</th><th>Old Weight</th><th>Change<br>(active * difference * learning rate)</th><th>New Weight</th></tr>";
            for (i = 0; i < NUM_NEURONS; i += 1) {
                html += "<tr>";
                html += "<td>Neuron " + (i + 1) + "</td>";
                html += "<td>" + activity[i] + "</td>";
                html += "<td>" + weights[i].toFixed(1) + "</td>";
                change = activity[i] * (pattern - output) * learning_rate;
                html += "<td>";
                html += activity[i] + " * ";
                html += "(" + pattern + " - " + output + ") * ";
                html += learning_rate + " = ";
                html += change;
                html += "</td>";
                weights[i] += change;
                html += "<td>" + weights[i].toFixed(1) + "</td>";
                html += "</tr>";
            }
            html += "</table></br>";
            // if incorrect, set both correct* to false
            correct[0] = false;
            correct[1] = false;
        }
        html += '</div>';
        log($(html));
        log($("<hr>"));
        done = correct[0] && correct[1];
        trial += 1;
    }
    if (trial >= 100) {
        log($("<h2>Failed to converge after 100 trials, stopping.</h2>"));
    } else {
        log($("<h2>Both patterns predicted successfully, stopping.</h2>"));
    }
}
