var _und = require("underscore");

var Player = function(name, socket_id) {
    var name = name; //This is what we will call the player at the table
    var login_name = name; //This is the player's permanent login name
    var id = socket_id;
    var session = name + "_" + _und.uniqueId();
    var table;
    var hand = [];
    var score = 0;
    var position; //N, S, E, W

    var rtc_id = null;

    function cardIndex(card, hand) {
        var hand_index = -1;
        _und.each(hand, function(hand_card, index) {
            if (card.rank == hand_card.rank && card.suit == hand_card.suit) {
                hand_index = index;
            }
        });
        return hand_index;
    }

    function hasCards(cards, hand) {
        _und.each(cards, function(card) {
            if (cardIndex(card, hand) == -1) {
                return false;
            }
        });
        return true;
    }

    function hasCard(card) {
        return cardIndex(card, this.hand) >= 0;
    }

    function hasSuit(suit) {
        var cards_with_suit = _und.where(this.hand, {suit: suit});
        return cards_with_suit.length > 0;
    }

    function removeCards(cards) {
        var hand = this.hand;
        if (hasCards(cards, hand)) {
            _und.each(cards, function(card) {
                var index = cardIndex(card, hand);
                hand[index] = undefined;
                hand = _und.compact(hand);
            });
            this.hand = hand;
        }
    }

    function addCards(cards) {
        this.hand = _und.union(cards, this.hand);
    }

    function isDealer() {
        return this.position == "N";
    }

    return {
        name: name,
        login_name: login_name,
        id: id,
        session: session,
        table: table,
        score: score,
        hand: hand,
        position: position,
        rtc_id: rtc_id,

        removeCards: removeCards,
        addCards: addCards,
        hasCard: hasCard,
        hasSuit: hasSuit,
        isDealer: isDealer
    };
};

module.exports.Player = Player;