var _und = require("underscore");

var Deck = function() {
    /**
     * Creates a Tiles 

F = Flower = RANK: 10 
D = Dot = 1 
B = Bam = 2
C = Crack = 3
RD = Red Dragon
GD = Green Dragon
SD = Soap Dragon
NW = North
SW = South
EW = East 
WW = West
J = Joker = 0 

     **/
    var suits = ["F", "D", "B", "C", "RD", "GD", "SD", "NW", "SW", "EW", "WW", "J"];
    var cards = [];
    var count = 0;

    for (var i = 1; i <= 8; ++i){
        cards[count++] = {
            suit: "F",
            rank: 0,
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
                rank: 0,
                num: j
            }
        }
    }
    
    for (var i = 1; i <= 8; ++i){
        cards[count++] = {
            suit: "J",
            rank: 0,
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
            "RD": 4,
            "GD": 5,
            "SD": 6,
            "NW": 7,
            "SW": 8,
            "EW": 9,
            "WW": 10,
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