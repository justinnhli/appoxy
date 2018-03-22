"use strict";

var NUM_RULES = 0;
var RULE_NUM = [];
var NUM_CONDITIONS = [];

function clear_stdout() {
    $("#stdout").empty();
}

function stdout(message) {
    $("#stdout").append(message + "\n");
}

function stderr(message) {
    $("#stderr").append(message + "\n");
}

function addCondition(ruleNum) {
    var ruleName = "rule" + ruleNum;
    var condName = ruleName + "cond" + NUM_CONDITIONS[ruleNum];
    var html = "";
    html += "<li id=\"" + condName + "\">\n";
    html += "    The <select id=\"" + condName + "jug\">";
    html += "        <option value=\"large_jug\">large</option>";
    html += "        <option value=\"small_jug\">small</option>";
    html += "    </select> jug <select id=\"" + condName + "state\">";
    html += "        <option value=\"is_full\">is full</option>";
    html += "        <option value=\"has_space\">has space</option>";
    html += "        <option value=\"has_water\">has water</option>";
    html += "        <option value=\"is_empty\">is empty</option>";
    html += "    </select>";
    html += "    <button onclick=\"deleteCondition(" + ruleNum + ", " + NUM_CONDITIONS[ruleNum] + ")\">Delete</button>";
    html += "</li>";
    NUM_CONDITIONS[ruleNum] += 1;
    $("#" + ruleName + "conds").append($(html));
}

function deleteCondition(ruleNum, condNum) {
    NUM_CONDITIONS[ruleNum] -= 1;
    $("#rule" + ruleNum + "cond" + condNum).remove();
}

function addRule() {
    var ruleNum = NUM_RULES;
    var ruleName = "rule" + ruleNum;
    var html = "";
    html += "<tr id=\"" + ruleName + "\">";
    html += "    <td>";
    html += "        <h3>Rule " + (ruleNum + 1) + " <button onclick=\"deleteRule(" + ruleNum + ")\">Delete</button></h3>";
    html += "        <p><strong>Conditions</strong></p>";
    html += "        <ol id=\"" + ruleName + "conds\">";
    html += "        </ol>";
    html += "        <button onclick=\"addCondition(" + ruleNum + ")\">Add another condition</button>";
    html += "    </td><td>";
    html += "        <h3>&nbsp;</h3>";
    html += "        <p><strong>Action</strong></p>";
    html += "        <select id=\"" + ruleName + "action\">";
    html += "            <option value=\"empty_large\">The agent should empty the large jug.</option>";
    html += "            <option value=\"empty_small\">The agent should empty the small jug.</option>";
    html += "            <option value=\"fill_large\">The agent should fill the large jug.</option>";
    html += "            <option value=\"fill_small\">The agent should fill the small jug.</option>";
    html += "            <option value=\"pour_large_small\">The agent should pour the large jug into the small jug.</option>";
    html += "            <option value=\"pour_small_large\">The agent should pour the small jug into the large jug.</option>";
    html += "        </select>";
    html += "    </td>";
    html += "</tr>";
    NUM_RULES += 1;
    $("#ruletable").append($(html));
    NUM_CONDITIONS.push(0);
    addCondition(ruleNum);
}

function deleteRule(ruleNum) {
    NUM_CONDITIONS[ruleNum] = 0;
    $("#rule" + ruleNum).remove();
}

function init() {
    addRule();
}

function runAgent() {
    clear_stdout();

    stdout("<h3>RULES</h3>");
    for (var ruleNum = 0; ruleNum < NUM_RULES; ruleNum += 1) {
        if (NUM_CONDITIONS[ruleNum] === 0) {
            continue;
        }
        stdout("Rule " + (ruleNum + 1));
        stdout("    if");
        for (var condNum = 0; condNum < NUM_CONDITIONS[ruleNum]; condNum += 1) {
            var message = "        the ";
            message += $("#rule" + ruleNum + "cond" + condNum + "jug").val();
            message += " jug ";
            message += $("#rule" + ruleNum + "cond" + condNum + "state").val();
            message = message.replace("_jug", "");
            message = message.replace("_", " ");
            stdout(message);
        }
        stdout("    then");
        switch ($("#rule" + ruleNum + "action").val()) {
            case "empty_large":
                stdout("        empty the large jug");
                break;
            case "empty_small":
                stdout("        empty the small jug");
                break;
            case "fill_large":
                stdout("        fill the large jug");
                break;
            case "fill_small":
                stdout("        fill the small jug");
                break;
            case "pour_large_small":
                stdout("        pour the large jug into the small jug");
                break;
            case "pour_small_large":
                stdout("        pour the small jug into the large jug");
                break;
        }
    }

    var smallcap = Number($("#smallsize").val());
    var smallvol = 0;
    var largecap = Number($("#largesize").val());
    var largevol = 0;
    var goalvol = Number($("#target").val());
    var prevState = [smallvol, largevol];
    var step = 0;

    for (step = 0; step < 100; step += 1) {
        var smallspace = smallcap - smallvol;
        var largespace = largecap - largevol;

        stdout("<h3>STEP " + (step + 1) + "</h3>");
        stdout("<strong>Current state</strong>:");
        stdout("    Small Jug: " + smallvol + "/" + smallcap);
        stdout("    Large Jug: " + largevol + "/" + largecap);

        stdout("<strong>Checking Rules:</strong>");

        var matchingRules = [];
        var ruleNum = 0;
        var ruleName = "";
        for (ruleNum = 0; ruleNum < NUM_RULES; ruleNum += 1) {
            if (NUM_CONDITIONS[ruleNum] === 0) {
                continue;
            }
            ruleName = "rule" + ruleNum;
            stdout("    Checking Rule " + (ruleNum + 1));

            var match = true;
            for (var condNum = 0; match && condNum < NUM_CONDITIONS[ruleNum]; condNum += 1) {
                var selectJug = "#" + ruleName + "cond" + condNum + "jug";
                var selectState = "#" + ruleName + "cond" + condNum + "state";

                var jugString = "";
                var jugvol = 0;
                var jugspace = 0;
                switch ($(selectJug).val()) {
                    case "small_jug":
                        jugString = "small";
                        jugvol = smallvol;
                        jugspace = smallspace;
                        break;
                    case "large_jug":
                        jugString = "large";
                        jugvol = largevol;
                        jugspace = largespace;
                        break;
                    default:
                        var text = "UNKNOWN JUG \"" + $(selectJug).val() + "\"";
                        text += " IN CONDITION " + (condNum + 1);
                        text += " OF RULE " + (ruleNum + 1) + "; stopping...";
                        alert(text);
                        return;
                }

                var conditionMessage = "        Condition " + (condNum + 1) + "... ";
                switch ($(selectState).val()) {
                    case "is_full":
                        if (jugspace === 0) {
                            conditionMessage += "matches, the " + jugString + " jug is full";
                        } else {
                            conditionMessage += "does NOT match, the " + jugString + " jug is NOT full";
                            match = false;
                        }
                        break;
                    case "has_space":
                        if (jugspace !== 0) {
                            conditionMessage += "matches, the " + jugString + " jug has space";
                        } else {
                            conditionMessage += "does NOT match, the " + jugString + " jug does NOT have space";
                            match = false;
                        }
                        break;
                    case "has_water":
                        if (jugvol !== 0) {
                            conditionMessage += "matches, the " + jugString + " jug has water";
                        } else {
                            conditionMessage += "does NOT match, the " + jugString + " jug does NOT have water";
                            match = false;
                        }
                        break;
                    case "is_empty":
                        if (jugvol === 0) {
                            conditionMessage += "matches, the " + jugString + " jug is empty";
                        } else {
                            conditionMessage += "does NOT match, the " + jugString + " jug is NOT empty";
                            match = false;
                        }
                        break;
                    default:
                        var text = "UNKNOWN JUG STATE \"" + $(selectState).val() + "\"";
                        text += " IN CONDITION " + (condNum + 1);
                        text += " OF RULE " + (ruleNum + 1) + "; stopping...";
                        alert(text);
                        return;
                }

                stdout(conditionMessage);
                if (!match) {
                    stdout("        Skipping remaining conditions.");
                    break;
                }
            }

            if (match) {
                stdout("        <strong>Rule " + (ruleNum + 1) + " matches!</strong>");
                matchingRules.push(ruleNum);
            } else {
                stdout("        <strong>Rule " + (ruleNum + 1) + " does not match.</strong>");
            }
        }

        if (matchingRules.length < 1) {
            stdout("<strong>No rules match; stopping...</strong>");
            return;
        } else if (matchingRules.length > 1) {
            stdout("<strong>Multiple rules match; stopping...</strong>");
            return;
        }

        ruleNum = matchingRules.pop();
        ruleName = "rule" + ruleNum;
        var selectAction = "#" + ruleName + "action";

        var actionMessage = "Applying Rule " + (ruleNum + 1) + ": ";

        switch ($(selectAction).val()) {
            case "empty_large":
                largevol = 0;
                actionMessage += "empty large jug";
                break;
            case "empty_small":
                smallvol = 0;
                actionMessage += "empty small jug";
                break;
            case "fill_large":
                largevol = largecap;
                actionMessage += "fill large jug";
                break;
            case "fill_small":
                smallvol = smallcap;
                actionMessage += "fill small jug";
                break;
            case "pour_large_small":
                if (largevol > (smallcap - smallvol)) {
                    largevol -= (smallcap - smallvol);
                    smallvol = smallcap;
                } else {
                    smallvol += largevol;
                    largevol = 0;
                }
                actionMessage += "pour water from large jug into small jug";
                break;
            case "pour_small_large":
                if (smallvol > (largecap - largevol)) {
                    smallvol -= (largecap - largevol);
                    largevol = largecap;
                } else {
                    largevol += smallvol;
                    smallvol = 0;
                }
                actionMessage += "pour water from small jug into large jug";
                break;
            default:
                text = "UNKNOWN ACTION \"" + $(selectACTION).val() + "\"";
                text += " OF RULE " + (ruleNum + 1) + "; stopping...";
                alert(text);
                return;
        }

        stdout(actionMessage);

        stdout("<strong>Current state</strong>:");
        stdout("    Small Jug: " + smallvol + "/" + smallcap);
        stdout("    Large Jug: " + largevol + "/" + largecap);

        if (prevState[0] === smallvol && prevState[1] === largevol) {
            stdout("<strong>The state has not changed; stopping...</strong>");
            return;
        } else {
            prevState = [smallvol, largevol];
        }

        stdout("");

        if (smallvol === goalvol) {
            stdout("<strong>The small jug has the desired volume!</strong>");
            return;
        } else if (largevol === goalvol) {
            stdout("<strong>The large jug has the desired volume!</strong>");
            return;
        }
    }

    if (step === 100) {
        stdout("<h3>Puzzle unsolved after 100 steps; stopping...</h3>");
    }
}
