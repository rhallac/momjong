var _und = require("underscore");

var Deck = function() {
    /**
     * Creates a deck
     *
     * @return An array containing a deck
     *         ex: "11H" is the Jack of hearts
     **/
    var suits = ["H", "C", "S", "D"];
    var n = 52;
    var cards = [];

    var index = n / suits.length;
    var count = 0;
    for (var i = 0; i <= 3; ++i) {
        for (var j = 1; j <= index; ++j) {
            cards[count++] = {
                suit: suits[i],
                rank: j
            };
        }
    }

    /**
     * Shuffles the deck
     **/

    function shuffle() {
        cards = _und.shuffle(cards);
    }

    /**
     * Draws a card from the deck
     *
     * @param deck the deck to use
     * @param amount the number of cards to draw
     * @param hand the hand to add cards to
     * @param initial if this is the first draw
     * @return A hand of cards removed from the deck, also adds cards to
     * hand variable
     **/

    function draw(amount) {
        //Splice removes elements, slice does not
        var drawnCards = cards.splice(0, amount);
        return drawnCards;
    }

    /**
     * Returns the "value" of a card. This is used for sorting.
     **/

    function sortValue(card) {
        var suitVals = {
            "C": 0,
            "D": 1,
            "S": 2,
            "H": 3
        };
        //Give each suit a value for sorting
        var suitVal = suitVals[card.suit] * 13;
        //Aces are high
        var rankVal = card.rank == 1 ? 13 : card.rank - 1;
        return rankVal + suitVal;
    }
    return {
        shuffle: shuffle,
        draw: draw,
        sortValue: sortValue,
        cards: cards
    };
};

/**
 * Export the functions so node.js knows they exist
 **/
module.exports.Deck = Deck;