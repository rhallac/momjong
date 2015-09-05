var _und = require("underscore");
var _deck = require("./deck");

var Table = function() {
    //Name to player object
    var players = {};
    var disconnected_players = {};
    //Position to player name
    var positions = {
        "N": null,
        "S": null,
        "E": null,
        "W": null
    };
    var traded_cards = {
        "N": null,
        "S": null,
        "E": null,
        "W": null
    };
    var played_cards = {};
    var trick_suit = null;
    var state = "waiting";
    var turn = "";
    var id = _und.uniqueId("tableid_");
    var round = 0;
    var scores = [];
    var hearts_broken = false;
    var deck = new _deck.Deck();
    deck.shuffle();

    function nextRound() {
        this.round++;
        if (this.tradeMap() === null) {
            //Make sure we trade this round
            this.state = "playing";
        } else {
            this.state = "trading";
        }
        this.hearts_broken = false;

        this.deck = new _deck.Deck();
        this.deck.shuffle();

        this.resetTrade();
        this.resetPlayedCards();
    }

    function updateScores() {
        var round_scores = {
            "round": this.round
        };
        var scores = this.scores;
        var round = this.round;
        var shot_the_moon = false;
        var moon_shooter = "";
        _und.each(this.players, function(player, name) {
            if (player.score == 26) {
                shot_the_moon = true;
                moon_shooter = name;
            }
        });
        _und.each(this.players, function(player, name) {
            //Save a list of all the scores
            if (shot_the_moon === true) {
                round_scores[player.position] = (name == moon_shooter) ? 0 : 26;
            } else {
                round_scores[player.position] = player.score;
            }
            if (round > 0) {
                round_scores[player.position] += scores[round - 1][player.position];
            }
            //reset player score
            player.score = 0;
        });
        this.scores = _und.union(this.scores, [round_scores]);
    }

    /* Returns the table with 'safe' values */

    function safe() {
        var players = _und.values(this.players);
        var player_names = _und.pluck(players, "name");

        return {
            players: player_names,
            round: this.round,
            id: this.id,
            state: this.state,
            turn: this.turn,
            trade_dir: this.tradeDir(),
            scores: this.scores,
            hearts_broken: this.hearts_broken,
            trick_suit: this.trick_suit,
            played_cards: this.played_cards
        };
    }

    function firstOpenPosition() {
        for (var pos in this.positions) {
            if (this.positions[pos] === null)
                return pos;
        }
        return undefined;
    }

    function readyToTrade() {
        var trade_values = _und.values(this.traded_cards);
        //removes all elements that are null
        return this.state == "trading" && _und.compact(trade_values).length == 4;
    }

    function resetTrade() {
        this.traded_cards = {
            "N": null,
            "S": null,
            "E": null,
            "W": null
        };
    }

    function tradeMap() {
        switch (this.round % 4) {
            case 1:
                //left
                return {
                    "N": "E",
                    "S": "W",
                    "E": "S",
                    "W": "N"
                };
            case 2:
                //right
                return {
                    "N": "W",
                    "S": "E",
                    "E": "N",
                    "W": "S"
                };
            case 3:
                //across
                return {
                    "N": "S",
                    "S": "N",
                    "E": "W",
                    "W": "E"
                };
            case 0:
                //error
                return null;
        }
    }

    function tradeDir() {
        switch (this.round % 4) {
            case 1:
                return "left";
            case 2:
                return "right";
            case 3:
                return "across";
            case 0:
                //error
                return null;
        }
    }

    //Gets the next player, and sets the turn variable

    function nextTurn() {
        var player = this.players[this.turn];
        var player_pos = player.position;
        var order = ["N", "E", "S", "W"];
        var next_index = (order.indexOf(player_pos) + 1) % 4;
        var next_pos = order[next_index];
        var next_player_name = this.positions[next_pos];
        this.turn = next_player_name;
        return this.turn;
    }

    function resetPlayedCards() {
        this.played_cards = {};
        this.trick_suit = null;
    }

    function getWinner() {
        var scores = [];
        var trick_suit = this.trick_suit;
        _und.each(this.played_cards, function(card, name) {
            var player = {
                name: name,
                score: 0
            };
            if (card.suit == trick_suit) {
                player.score = card.rank;
                if (player.score == 1) {
                    player.score = 14;
                }
            }
            scores = _und.union(scores, [player]);
        });
        var winner = _und.max(scores, function(player) {
            return player.score;
        });
        return winner.name;
    }

    function getPointsInTrick() {
        var score = 0;
        _und.each(this.played_cards, function(card, name) {
            //Any heart
            if (card.suit == "H") {
                score += 1;
            }
            //Queen of spades
            else if (card.suit == "S" && card.rank == 12) {
                score += 13;
            }
        });
        return score;
    }

    return {
        //Instance Vars
        players: players,
        disconnected_players: disconnected_players,
        id: id,
        round: round,
        turn: turn,
        deck: deck,
        positions: positions,
        traded_cards: traded_cards,
        played_cards: played_cards,
        trick_suit: trick_suit,
        state: state,
        scores: scores,
        hearts_broken: hearts_broken,

        //Functions
        nextRound: nextRound,
        updateScores: updateScores,
        safe: safe,
        firstOpenPosition: firstOpenPosition,
        readyToTrade: readyToTrade,
        resetTrade: resetTrade,
        resetPlayedCards: resetPlayedCards,
        tradeMap: tradeMap,
        tradeDir: tradeDir,
        getPointsInTrick: getPointsInTrick,
        getWinner: getWinner,
        nextTurn: nextTurn
    };
};

module.exports.Table = Table;