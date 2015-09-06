var _und = require("underscore");
var fs = require("fs");

var http = require("http");
var express = require("express");
var Primus = require("primus.io");

var _deck = require("./deck");
var _player = require("./player");
var _table = require("./table");

// This serves static content on port 8888
var app = express();
var server = http.createServer(app);
var port = process.env.PORT || 8888;
server.listen(port);

app.use(app.router);
app.use(express.static(__dirname + "/assets"));

// production only
app.configure("production", function() {
    require("newrelic");
    app.get("*", function(req, res, next) {
        var reqType = req.headers["x-forwarded-proto"];
        reqType == 'https' ? next() : res.redirect("https://" + req.headers.host + req.url);
    });
});

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/assets/index.html");
});

// This is where we initialize the websocket for javascript callbacks
var primus = new Primus(server, {
    transformer: "sockjs",
    parser: "JSON"
});
console.log("Primus starting");

var players = {};
var tables = {};

var waiting_room = "waiting_room";

primus.on("connection", function(client) {
    //When someone connects put them in the waiting room
    client.join(waiting_room);

    //Let the new client know which tables are available
    console.log("Tables: " + JSON.stringify(_und.pluck(_und.values(tables), "id")));
    console.log("Clients: " + JSON.stringify(_und.pluck(primus.connections, "id")));
    _und.each(_und.values(tables), function(table) {
        if (table.round === 0) {
            client.send("addTableRow", table.safe());
        }
    });

    client.on("newPlayer", function(player_name, session) {
        var all_players = _und.values(players);
        //Search through all players and try to find one with the same session
        var old_player = _und.find(all_players, function(player) {
            return player.session == session;
        });
        if (old_player !== undefined) {
            player = makePlayer(client, player_name);
            //Keep the same session
            player.session = old_player.session;
        } else {
            //This will add the player to the global list of players
            player = makePlayer(client, player_name);
        }
        client.send("loggedIn", player.name, player.session);
        //Alert the user to tables that they were disconnected from
        _und.each(_und.values(tables), function(table) {
            var disconnected_players = _und.values(table.disconnected_players);
            var same_name = player_name in disconnected_players;
            var same_session = _und.where(disconnected_players, {
                "session": session
            }).length > 0;
            console.log(disconnected_players);
            if (same_name || same_session) {
                client.send("addTableRow", table.safe());
            }
        });
        console.log("Player " + player.name + " (" + player.session + ") logged in");
    });

    client.on("deletePlayer", function(player_name) {
        var all_names = _und.pluck(_und.values(players), "name");
        if (_und.contains(all_names, player_name)) {
            delete players[client.id];
            client.send("loggedOut", player_name);
            console.log(player_name + " (" + client.id + ") logged out");
        }
    });

    client.on("joinTable", joinTable);

    client.on("newTable", function(player_name) {
        var table = makeTable();
        //Tell all the clients in the waiting room that there is an update
        primus.room(waiting_room).send("addTableRow", table.safe());

        //Check to see if we successfully joined
        var did_join = joinTable(table.id, player_name);
        if (did_join === false) {
            primus.room(waiting_room).send("removeTableRow", table.id);
            //Delete the table if there was an error
            delete tables[table.id];
        }
    });

    function joinTable(table_id, player_name) {
        var player = players[client.id];
        if (player !== undefined && (table_id in tables)) {
            var table = tables[table_id];

            client.join(table.id);
            client.leave(waiting_room);

            //check to see if there is another player with the same name
            for (var i = 2; i <= 4; i++) {
                if (player.name in table.players) {
                    player.name = player.login_name + " (" + i + ")";
                }
            }

            //Tell this client to join the table
            client.send("joinTable", player.name);

            //Start the video chat - TODO: disconnection
            client.send("connectToChat", player.id, table.id);

            if (player.name in table.disconnected_players) {
                var old_player = table.disconnected_players[player.name];
                old_player.id = player.id;
                players[client.id] = old_player;

                table.players[player.name] = old_player;
                table.positions[old_player.position] = player.name;
                delete table.disconnected_players[player.name];

                client.send("restoreState", table.safe(), old_player);

            } else {
                player.table = table.id;

                table.players[player.name] = player;

                player.position = table.firstOpenPosition();
                table.positions[player.position] = player.name;
            }

            updateClientView(table);
            if (_und.size(table.players) >= 4) {
                //Start the round
                //We need to check here because players can disconnect and rejoin
                if (table.round === 0) {
                    //Do this to initialize scores
                    table.updateScores();
                    //Set the round to 1
                    table.nextRound();
                    primus.room(table.id).send("nextRound", table.safe());
                }
                //Remove the table from the list
                primus.room(waiting_room).send("removeTableRow", table.id);
            }
            return true;
        } else {
            return false;
        }
    }

    client.on("restorePlayState", function() {
        var player = players[client.id];
        if (player !== undefined) {
            var table = tables[player.table];
            if (table !== undefined) {
                client.send("restoringPlayState", table.safe(), table.played_cards);
            }
        }
    });

    // Individual table logic
    client.on("dealCards", function() {
        var player = players[client.id];
        var table = tables[player.table];
        var deck = table.deck;

        if (_und.size(player.hand) < 13) {
            var cards = deck.draw(13);
            player.addCards(cards);
            client.send("showCards", cards);
        } else {
            console.log("Player " + player.name + " already has 13 cards");
        }
    });

    client.on("skipPassCards", function() {
        var player = players[client.id];
        var table = tables[player.table];
        // Force the hand to start if we skip trading this round
        if (table.tradeMap() === null) {
            startPlaying(table);
        }
    });

    //Wait for all players to submit cards to trade
    client.on("passCards", function(cards) {
        var player = players[client.id];
        if (player !== undefined) {
            var position = player.position;
            var table = tables[player.table];
            table.traded_cards[position] = cards;
            if (table.readyToTrade()) {
                // All 4 players have selected 3 cards
                doTrades(table);
                if (table.trade_iteration < 6) {
                    // Update the remaining trades counter
                    var trade_values = _und.values(table.traded_cards);
                    var remaining_trades = 6 - table.trade_iteration; //4 - _und.compact(trade_values).length;
                    primus.room(table.id).send("updateRemainingTrades",
                        table.tradeDir(), remaining_trades);
                } else {
                    startPlaying(table);
                }
                
            }
        }
    });

    function doTrades(table) {
        var trade_map;
            for (var pos in table.traded_cards) {
                var cards = table.traded_cards[pos];

                var player_name = table.positions[pos];
                var player = table.players[player_name];
                player.removeCards(cards);
                console.log("trade iteration " + table.trade_iteration);
                switch (table.trade_iteration) {
                case 0:
                case 5:
                    //right
                    trade_map = {
                        "N": "W",
                        "S": "E",
                        "E": "N",
                        "W": "S"
                        };
                    break;
                case 1:
                case 4:
                    //across
                    trade_map = {
                        "N": "S",
                        "S": "N",
                        "E": "W",
                        "W": "E"
                        };
                    break;
                case 2:
                case 3:
                    //left
                    trade_map = {
                        "N": "E",
                        "S": "W",
                        "E": "S",
                        "W": "N"
                        };
                    break;
                };
                console.log(trade_map);
                var trade_player_pos = trade_map[pos];
                var trade_player_name = table.positions[trade_player_pos];
                var trade_player = table.players[trade_player_name];
                trade_player.addCards(cards);
        }
        table.resetTrade();
        this.state = "trading";
        table.trade_iteration++;

        // Send the cards out to the players
        _und.each(_und.values(table.players), function(player) {
            var id = player.id;
            var hand = player.hand;
            primus.connections[id].send("startTrading", table.safe(), hand);
        });
    }

    function startPlaying(table) {
        table.resetTrade();

        //The trade is done, now figure out who goes first
        _und.each(_und.values(table.players), function(player) {
            if (player.isDealer()) {
                table.turn = player.name;
            }
        });

        //Tell everyone to start playing
        table.state = "start_playing";
        _und.each(_und.values(table.players), function(player) {
            var id = player.id;
            var hand = player.hand;
            // TODO need to call this but not startPlaying (doTrading?)
            primus.connections[id].send("startPlaying", table.safe(), hand);
        });
    }

    client.on("playCard", function(card) {
        var player = players[client.id];
        if (player !== undefined) {
            var table = tables[player.table];
            if (table !== undefined && table.turn == player.name) {
                if (player.hasCard(card)) {
                    //If this is the first card, set the suit
                    if (_und.size(table.played_cards) === 0) {
                        //Checks to see if we only have hearts left
                        // if (card.suit == "H") {
                        //     var have_other_suits = player.hasSuit("S") || player.hasSuit("C") || player.hasSuit("D");
                        //     //Can't start with a heart if they aren't broken yet,
                        //     //but can if the player only has hearts left
                        //     if (table.hearts_broken === false && have_other_suits === true) {
                        //         console.log(player.name + " tried to play H, not broken yet: " + JSON.stringify(card));
                        //         return;
                        //     }
                        // }
                        //Once the first card is played, the table is now in the 'playing' state
                        table.state = "playing";
                        //This is the first card, set the trick suit
                        table.trick_suit = "A";
                    }
                    //Check if this card is allowed to be played (outliers taken care of above)
                    var isValidSuit = true;
                    if (isValidSuit === true) {
                        console.log(player.name + " played card " + JSON.stringify(card));
                        //if (card.suit == "H" && table.hearts_broken === false) {
                        //    table.hearts_broken = true;
                        //    primus.room(table.id).send("heartsBroken");
                        //}
                        if (_und.size(table.played_cards) < 4) {
                            primus.room(table.id).send("cardPlayed", player.name, card,
                                table.trick_suit);
                            //Add the card to the list of played cards
                            table.played_cards[player.name] = card;
                            player.removeCards([card]);
                        }
                        //If this is the last card, tell the clients to clear the trick
                        if (_und.size(table.played_cards) == 4) {
                            var winner = table.getWinner();
                            primus.room(table.id).send("clearTrick", winner);
                        } else {
                            //If this is not the last card, move to the next player
                            primus.room(table.id).send("nextPlayer", table.nextTurn());
                        }
                    } else {
                        console.log(player.name + " can't play this card this hand: " + JSON.stringify(card));
                    }
                } else {
                    console.log(player.name + " doesn't have the card: " + JSON.stringify(card));
                }
            }
        }
    });

    client.on("nextTrick", function() {
        var player = players[client.id];
        if (player !== undefined) {
            var table = tables[player.table];
            //Only respond to this event from one person
            if (table !== undefined && table.turn == player.name) {
                //All the cards have been played. Select a winner
                if (_und.size(table.played_cards) == 4) {
                    var winner = table.getWinner();
                    var score = table.getPointsInTrick();

                    table.players[winner].score += score;
                    primus.room(table.id).send("updateScore", winner,
                        table.players[winner].score);

                    if (player.hand.length > 0) {
                        //If the round isn't over, set the turn to the winner
                        table.turn = winner;
                        primus.room(table.id).send("nextPlayer", winner);
                        //Clear the table's played cards and reset the trick suit
                        table.resetPlayedCards();
                    } else {
                        //If the round is over
                        table.updateScores();
                        var scores = table.scores[table.round];
                        var prev_scores = table.scores[table.round - 1];
                        _und.each(table.players, function(player, name) {
                            primus.room(table.id).send("updateScore", name, player.score);
                        });
                        primus.room(table.id).send("updateScoreTable", scores, prev_scores);

                        table.nextRound();
                        //Update each player's score
                        primus.room(table.id).send("nextRound", table.safe());
                    }
                }
            }
        }
    });

    client.on("leaveTable", function() {
        client.leaveAll();
        client.join(waiting_room);
        leaveTable(client);
    });
});

//Disconnect
primus.on("disconnection", leaveTable);

function leaveTable(client) {
    console.log("Client disconnected: " + client.id);
    console.log("Players: " + JSON.stringify(_und.keys(players)));
    if (client.id in players) {
        var player = players[client.id];
        delete players[client.id];

        var table = tables[player.table];
        if (table !== undefined) {
            table.positions[player.position] = null;

            if (table.round > 0) {
                /* If the game has already started,
                 * give disconnected players a chance to rejoin
                 * Move the player from players -> disconnected players */
                table.disconnected_players[player.name] = table.players[player.name];
                console.log("Saving " + player.name + "'s state at the table");
            }
            console.log("Deleting player " + player.name);
            var all_names = _und.pluck(_und.values(players), "name");
            console.log(all_names);
            delete table.players[player.name];
            client.leave(table.id);

            // If that was the last player in the room, delete the room
            if (_und.size(table.players) === 0) {
                delete tables[table.id];
                primus.room(waiting_room).send("removeTableRow", table.id);
                console.log("Table " + table.id + " deleted");
            } else {
                //Update waiting room if the game has not started
                if (table.round === 0) {
                    //Otherwise, remove the username from the row
                    primus.room(waiting_room).send("updateTableRow", table.safe());
                }
                //And let everone in the room know that a person left
                updateClientView(table);
            }
        }
    }
}

function updateClientView(table) {
    // Put all of the other players into a map - position:{name: ?, score: ?}
    var table_players = _und.values(table.players);
    var other_pos = _und.filterAndIndexBy(table_players, "position", ["name", "score", "id"]);

    //Tell all the clients at the table that there is a new player
    var clients = primus.room(table.id).clients();
    _und.each(clients, function(id) {
        //Emit the client his position
        var client_pos = players[id].position;
        primus.connections[id].send("updatePositions", client_pos, other_pos);
    });

    if (table.round === 0) {
        //Tell all the clients in the waiting room that there is an update
        primus.room(waiting_room).send("updateTableRow", table.safe());
    }
}

/**
 * This function takes a list of the same objects, reindexes by an
 * index, and keeps only certain properties of the object. Index must
 * be unique for each object.
 *
 * Usage:
 *
 * var obj = {Jeff: {id: 1, pos: 'N', foo:'foo', other: 1},
 *            Michael: {id: 2, pos: 'S', foo:'bar', other: 2}}
 *
 * objIndexBy(obj, "id", ["pos", "foo"])
 * > {1: {pos: N, foo: foo}, 2: {pos: S, foo: bar}}
 */
_und.mixin({
    filterAndIndexBy: function(obj, index, filter) {
        // Put all of the other players into a map - pos:{name: ?, score: ?}
        var vals = _und.values(obj);
        var newObj = {};
        // Iterate through the table's players and put them in the map
        _und.each(vals, function(val) {
            var args = _und.union(val, filter);
            newObj[val[index]] = _und.pick.apply(this, args);
        });
        return newObj;
    }
});

/**
 * Simple method to create and associate a player with an id
 */

function makePlayer(client, name) {
    var player = new _player.Player(name, client.id);
    // Add the player to the list of global players
    players[client.id] = player;
    return player;
}

/**
 * Simple method to create and associate a table with an id
 */

function makeTable() {
    var table = new _table.Table();
    // Add the table to the list of global tables
    tables[table.id] = table;
    return table;
}