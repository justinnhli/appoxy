// On load
$(function () {
    "use strict";
    var $src = $("#src");
    var $cfg = $("#cfg");
    var $usage = $("#usage");
    var $reachability = $("#reachability");
    var $liveness = $("#liveness");

    function main() {
        loadSource();
        if ($src.val().trim() === "") {
            var defaultSource = [
                "n = 13;",
                "",
                "i = 2;",
                "prime = 1;",
                "while (prime && (i < sqrt(n))) {",
                "    if (n % i == 0) {",
                "        prime = 0;",
                "    }",
                "    i += 1;",
                "}",
                "",
                "print(prime);"
            ];
            $src.val(defaultSource.join("\n"));
        }
        saveSource();

        $("#analyze").click(analyze);

        analyze();
    }

    function analyze() {
        saveSource();
        // clear all results
        $cfg.empty();
        $usage.empty();
        $reachability.empty();
        $liveness.empty();
        // display control flow graph
        $.post("/liveness/cfg", $src.val()).done(function(response) {
            if (response === "Syntax Error") {
                $cfg.append(response);
            } else {
                $cfg.append(Viz(response));
            }
        });
        // calculate usage
        $.post("/liveness/usage", $src.val()).done(function(response) {
            $usage.append(response);
        });
        // calculate reachability
        $.post("/liveness/reachability", $src.val()).done(function(response) {
            $reachability.append(response);
        });
        // calculate liveness
        $.post("/liveness/liveness", $src.val()).done(function(response) {
            $liveness.append(response);
        });
    }

    function loadSource() {
        var hash = deparam(location.hash.substr(1));
        if (hash["source"] !== undefined) {
            $src.val(window.atob(hash["source"]));
        }
    }

    function saveSource() {
        location.hash = param({"source": window.btoa($src.val())});
    }

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

    main();

});
