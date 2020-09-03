// On load
$(function () {
    "use strict";
    var $input = $("#input");
    var $rhs = $("#rhs");

    function draw() {
        var network = $input.val();
        $.post("/memograph/parse", network).done(function(response) {
            $rhs.empty();
            if (response.substring(0, 5) === "ERROR") {
                $rhs.append($('<pre><code>' + response + '</code></pre>'));
            } else {
                $rhs.append(Viz(response));
            }
        });
        saveNetwork(network);
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

    function loadNetwork() {
        var hash = deparam(location.hash.substr(1));
        if (hash["network"] !== undefined) {
            $input.val(window.atob(hash["network"]));
        }
    }

    function saveNetwork(network) {
        location.hash = param({"network": window.btoa(network)});
    }

    function main() {
        loadNetwork();

        $("#drawButton").click(draw);
        $(window).on("hashchange", function() {
            loadNetwork();
        });
        saveNetwork();

        draw();
    }

    main();
});
