// tourstats.js
// plugin for scripts
// Update tournaments stats with:
// require("tourstats.js").updateTourStats

var tourwinners, tourstats, tourrankingsbytier;

function updateTourStats(tier, time, winner, num, purgeTime, noPoints) {
    var numToPoints = function() {
        if (noPoints) return 0;
        // First index: points for 1-7 players,
        // Second index: points for 8-15 players,
        // Third index: points for 16-31 players,
        // Fourth index: points for 32-63 players,
        // Fifth index: points for 64+ players
        var pointsDistributions = {
            "1v1 Challenge Cup": [0, 0, 0, 0, 1],
            "Challenge Cup": [0, 0, 0, 1, 2],
            "1v1 Gen 5": [0, 0, 0, 0, 1],
            "Metronome": [0, 0, 0, 0, 0],
            "Monotype": [0, 0, 1, 2, 3],
            "default": [0, 1, 2, 4, 6],
        }
        var d = pointsDistributions[tier in pointsDistributions ? tier : "default"];
        if (num < 8) return d[0];
        else if (8 <= num && num < 16) return d[1];
        else if (16 <= num && num < 32) return d[2];
        else if (32 <= num && num < 64) return d[3];
        else return d[4];    };    var isEmptyObject = function(o) {
        for (var k in o) {
            if (o.hasOwnProperty(k)) {
                return false;
            }
        }
        return true;
    };
    var points = numToPoints();
    if (purgeTime === undefined)
        purgeTime = 60*60*24*31; // 31 days
    time = parseInt(time); // in case time is date or string
    winner = winner.toLowerCase();
    tourwinners.push([tier, time, num, winner]);
    //if (points > 0) {

        if (tourstats[winner] === undefined) {
            tourstats[winner] = {'points': 0, 'details': []};
        }
        tourstats[winner].points += points;
        tourstats[winner].details.push([tier, time, num]);

        if (tourrankingsbytier[tier] === undefined) {
            tourrankingsbytier[tier] = {};
        }
        if (tourrankingsbytier[tier][winner] === undefined) {
            tourrankingsbytier[tier][winner] = 0;
        }
        tourrankingsbytier[tier][winner] += points;

        var jsonObject = {};
        jsonObject.tourwinners = tourwinners
        jsonObject.tourstats = tourstats
        jsonObject.tourrankingsbytier = tourrankingsbytier
        sys.writeToFile('tourstats.json', JSON.stringify(jsonObject));
    //}

    var player;
    while (tourwinners.length > 0 && (parseInt(tourwinners[0][1]) + purgeTime) < time) {
        tier = tourwinners[0][0];
        points = numToPoints(tourwinners[0][2]);
        player = tourwinners[0][3];

        //tourstats[player] can be undefined, as 0 points tourwinners still are registered and script used to not record any tour stats f or them
        if (tourstats[player] != undefined) {
            tourstats[player].points -= points;
            tourstats[player].details.pop();
            if (tourstats[player].points == 0) {
                delete tourstats[player];
            }
            tourrankingsbytier[tier][player] -= points;
            if (tourrankingsbytier[tier][player] == 0) {
                delete tourrankingsbytier[tier][player];
                if (isEmptyObject(tourrankingsbytier[tier])) {
                    delete tourrankingsbytier[tier];
                }
            }
        }
        tourwinners.pop();
    }
}

function init() {
    tourwinners = [];
    tourstats = {};
    tourrankingsbytier = {};
    try {
        var jsonObject = JSON.parse(sys.getFileContent('tourstats.json'));
        tourwinners = jsonObject.tourwinners;
        tourstats = jsonObject.tourstats;
        tourrankingsbytier = jsonObject.tourrankingsbytier;
    } catch (err) {
        print('Could not read tourstats, initing to null stats.');
        print('Error: ' + err);
    }
}

var commandHandlers = {
    viewtiers: function viewtiers(src, command, commandData, channel) {
        var cycleLength = 12;
        var a = [];
        for (var i = tourwinners.length-1; i >= tourwinners.length-cycleLength && i >= 0; --i) {
            a.push(tourwinners[i][0]);
        }
        tourneybot.sendChanMessage(src, "Recently played tiers are: " + a.join(", "));
    },
    lastwinners: function lastwinners(src, command, commandData, channel) {
        // tourwinners.push([tier, time, num, winner]);
        var cycleLength = 12;
        var now = sys.time();
        for (var i = tourwinners.length-1; i >= tourwinners.length-cycleLength && i >= 0; --i) {
            var dayDiff = parseInt((now-tourwinners[i][1])/(60*60*24));
            sys.sendHtmlMessage(src, "<timestamp/>" + tourwinners[i][3] + green("won on")+ tourwinners[i][0] + green("tournament with") + tourwinners[i][2] + green("entrants") + (dayDiff > 1 ? '' + dayDiff + green("days ago") : dayDiff == 1 ? green("yesterday") : dayDiff == 0 ? green('today') : green('in the future')), channel);
        }
    },
    tourrankings: function tourrankings(src, command, commandData, channel) {
        var list = [];
        for (var p in tourstats) {
            list.push([tourstats[p].points, p]);
        }
        list.sort(function(a,b) { return b[0] - a[0] ; });
        sendChanMessage(src, "*** Global tourney points ***");
        if (list.length > 0) {
            for (var i in list) {
                if (i == 10) break;
                var data = list[i];
                var pos = parseInt(i)+1;
                sys.sendHtmlMessage(src, "<timestamp/><b>" + pos + ".</b> " + data[1] + " <b>-</b> " + data[0] + " points", channel);
            }
        } else {
            sendChanMessage(src, "No tourney wins!");
        }
    },
    tourranking: function tourranking(src, command, commandData, channel) {
        if (commandData === undefined) {
            rankingbot.sendChanMessage(src, "You must specify tier!");
            return;
        }
        var rankings;
        var tierName;
        for (var t in tourrankingsbytier) {
            if (t.toLowerCase() == commandData.toLowerCase()) {
                tierName = t;
                rankings = tourrankingsbytier[t];
                break;
            }
        }
        if (tierName === undefined) {
            rankingbot.sendChanMessage(src, "No statistics exist for that tier!");
            return;
        }
        var list = [];
        for (var p in rankings) {
            list.push([rankings[p], p]);
        }
        list.sort(function(a,b) { return b[0] - a[0] ; });
        sendChanMessage(src, "*** "+tierName+" tourney points ***");
        if (list.length > 0) {
            for (var i in list) {
                if (i == 10) break;
                var data = list[i];
                var pos = parseInt(i)+1;
                sys.sendHtmlMessage(src, "<timestamp/><b>" + pos + ".</b> " + data[1] + " <b>-</b> " + data[0] + " points", channel);
            }
        } else {
            sendChanMessage(src, "No tourney wins in this tier!");
        }
    },
    tourdetails: function tourdetails(src, command, commandData, channel) {
        if (commandData === undefined) {
            rankingbot.sendChanMessage(src, "You must specify user!");
            return;
        }
        function green(s) {
            return " <span style='color:#3daa68'><b>"+s+"</b></span> ";
        }
        var name = commandData.toLowerCase();
        if (name in tourstats) {
            sendChanMessage(src, "*** Tournament details for user " + commandData);
            var points = tourstats[name].points;
            var details = tourstats[name].details;
            var now = sys.time();
            for (var i in details) {
                var dayDiff = parseInt((now-details[i][1])/(60*60*24));
                sys.sendHtmlMessage(src, "<timestamp/>" + green("Win on")+ details[i][0] + green("tournament with") + details[i][2] + green("entrants") + (dayDiff > 1 ? '' + dayDiff + green("days ago") : dayDiff == 1 ? green("yesterday") : dayDiff == 0 ? green('today') : green('in the future')), channel);
            }
        } else {
            rankingbot.sendChanMessage(src, commandData+" has not won any tournaments recently.");
        }
    },

    writetourstats: function writetourstats(src, command, commandData, channel) {
        var jsonObject = {};
        jsonObject.tourwinners = tourwinners
        jsonObject.tourstats = tourstats
        jsonObject.tourrankingsbytier = tourrankingsbytier
        sys.writeToFile('tourstats.json', JSON.stringify(jsonObject));
        sys.sendMessage(src, 'Tournament stats were saved!', channel);
    },
    reloadtourstats: function reloadtourstats(src, command, commandData, channel) {
        try {
            var jsonObject = JSON.parse(sys.getFileContent('tourstats.json'));
            tourwinners = jsonObject.tourwinners;
            tourstats = jsonObject.tourstats;
            tourrankingsbytier = jsonObject.tourrankingsbytier;
            sys.sendMessage(src, 'Tournament stats were reloaded!', channel);
        } catch (err) {
            sys.sendMessage(src, 'Reloading tournament stats failed!', channel);
            print('Could not read tourstats, initing to null stats.');
            print('Error: ' + err);
        }
    },
    resettourstats: function resettourstats(src, command, commandData, channel) {
        tourwinners = [];
        tourstats = {};
        tourrankings = {};
        tourrankingsbytier = {};
        sys.sendAll('Tournament winners were cleared!');
    }
}
commandHandlers.writetourstats.authRequired = 3;
commandHandlers.reloadtourstats.authRequired = 3;
commandHandlers.resettourstats.authRequired = 3;

var utilities = require("utilities.js");
function handleCommand(src, message, channel) {
    var cmd = utilities.as_command(message); 
    if (cmd.command in commandHandlers) {
        sys.sendMessage(src, "Running command {0} with auth level {1}".format(cmd.command, sys.auth(src)), channel);
        if (commandHandlers[cmd.command].authRequired > sys.auth(src)) {
            sys.sendMessage(src, "You do not have sufficient authority to run this command", channel);
        } else {
            commandHandlers[cmd.command](cmd.parameter)
        }
        return true;
    }
}

var commandHelp = [
    "/viewtiers: Shows the recently played tournaments, which can't be started currently.",
    "/tourrankings: Shows recent tournament winners.",
    "/tourranking [tier]: Shows recent tourney winners in a specific tier.",
    "/tourdetails [name]: Shows a user's tourney stats.",
    "/lastwinners: Shows details about recent tournaments.",
    "/writetourstats: Forces a writing of tour stats to tourstats.json.",
    "/reloadtourstats: Forces a reload of tour stats from tourstats.json.",
    "/resettourstats: Resets tournament winners."
];

function showCommands(src, topic, channel) {
    if (topic == "tourstats") {
        for (var i = 0; i < commandHelp.length; ++i)
            sys.sendMessage(src, commandHelp[i], channel); 
    }
}

exports.init = init;
exports.updateTourStats = updateTourStats;
exports.handleCommand = handleCommand;
exports["help-string"] = "tourstats: See commands for tournament statistics!";
exports.onHelp = showCommands;