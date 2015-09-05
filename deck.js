var _und = require("underscore");

var Deck = function() {
    /**
     * Creates a deck
     *
     * @return An array containing a deck
     *         ex: "11H" is the Jack of hearts
     **/
    var suits = ["F", "D", "B", "C", "R", "G", "S", "N", "S", "E". "W", "J"];
    var cards = [];
	var count = 0;

	for (var i = 1; i <= 8; ++i){
		cards[count++] = {
			suit: "F",
			rank: 1,
			num: i
		};
	}

	for (var i = 1; i <= 3; ++i){
		for (var j = 1; j <= 9; ++j){
			for (var k = 1; k <= 4; ++k){
				cards[count++] = {
					suit: suits[i],
					rank: j,
					num: k
				};
			}
		}
	}

	for (var i = 4; i <= 10; ++i){
		for (var j = 1; j <= 4; ++j){
			cards[count++] = {
				suit: suits[i],
				rank: 1,
				num: j
			}
		}
	}
	
	for (var i = 1; i <= 8; ++i){
		cards[count++] = {
            suit: "J",
            rank: 1,
            num: i
        };
	}




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
            "F": 0,
            "D": 1,
            "B": 2,
            "C": 3,
            "R": 4,
            "G": 5,
            "S": 6,
            "N": 7,
            "S": 8,
            "E": 9,
            "W": 10,
            "J": 11,
        };
        //Give each suit a value for sorting
        var suitVal = suitVals[card.suit] * 40;
        //Aces are high
        var rankVal = card.rank*4 - 4;
		var numVal = card.num;
        return rankVal + suitVal + numVal;
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