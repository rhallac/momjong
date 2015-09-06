var _und = require("underscore");

var Deck = function() {
    /**
     * Creates a Tiles 

F = Flower = RANK: 10 
D = Dot = 1 RANK: number 
B = Bam = 2 RANK: number 
C = Crack = 3 RANK: number

NW = North RANK: 14
SW = South RANK: 15
EW = East RANK: 16
WW = WestRANK: 17
J = Joker = 0 

     **/
    var suits = ["D", "B", "C", "F", "N", "S", "E", "W", "J"];
    var cards = [];
    var count = 0;

    

    //creates dot/bam/crack 1-9
    for (var i = 0; i <= 2; ++i){
        //0 - 9 where 0 is dragon
        for (var j = 0; j <= 9; ++j){
            for (var k = 1; k <= 4; ++k){
                cards[count++] = {
                    suit: suits[i],
                    rank: j*4 + k,
                };
            }
        }
    }

    //creates flowers
    for (var i = 0; i <= 7; ++i){
        cards[count++] = {
            suit: "F",
            rank: 50+i,
        };
    }

    //creates N
    for (var i = 0; i <= 3; ++i){
        cards[count++] = {
            suit: "N",
            rank: 60+i,
        };
    }

     //creates S
    for (var i = 0; i <= 3; ++i){
        cards[count++] = {
            suit: "S",
            rank: 70+i,
        };
    }

     //creates E
    for (var i = 0; i <= 3; ++i){
        cards[count++] = {
            suit: "E",
            rank: 80+i,
        };
    }

     //creates W
    for (var i = 0; i <= 3; ++i){
        cards[count++] = {
            suit: "W",
            rank: 90+i,
        };
    }
    
    for (var i = 0; i <= 7; ++i){
        cards[count++] = {
            suit: "J",
            rank: 100+i,
           
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
            "D": 0,
            "B": 1,
            "C": 2,
            "F": 3,
            "N": 4,
            "S": 5,
            "E": 6,
            "W": 7,
            "J": 8
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