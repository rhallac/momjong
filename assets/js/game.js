$(document).ready(function() {
    var socket = Primus.connect(document.URL);
    var peer = null;
    var _local_stream = null;

    var _restore_play_state = false;
    var _state = "waiting"; // waiting, trading, playing, start_playing
    var _round = 0;
    var _players = {};
    var _hand = [];
    var _turn = "";
    var _login_name = "";
    var _name = "";
    var _trick_suit = "";
    var _hearts_broken = false;
    var _skip_trade = false;
    var _clear_trick_delay = 1500;
    var _calls = [];

    var _room = null;
    _table_id = null;

    $("#playername").popover();

    $(document).on("touchmove", false);
    var IS_IPAD = navigator.userAgent.match(/iPad/i) !== null;

    // -------------------------------- Name logic ----------------------------- //

    //Try to log in when we load the page
    if ($.cookie("session") !== undefined) {
        logIn();
    } else {
        showLogin();
        disableJoinButtons();
    }

    function logIn() {
        var c_name = $.cookie("name");
        var c_sess = $.cookie("session");
        console.log(c_sess);
        if (c_name !== undefined && c_sess !== undefined) {
            // If we have logged in before, use the cookie
            socket.send("newPlayer", $.cookie("name"), $.cookie("session"));
        } else {
            //Otherwise, use the name input value
            var name = $("#playername").val();
            if (name.length > 0 && name.indexOf("(") === -1) {
                socket.send("newPlayer", name);
            }
        }
    }

    socket.on("loggedIn", function(player_name, session) {
        //Set the session and name to what the server says it should be
        $.cookie("name", player_name);
        $.cookie("session", session);
        $("#current-user-name").text(player_name);
        _login_name = player_name;
        showLogout();
        enableJoinButtons();
    });

    socket.on("duplicateName", function() {
        $.removeCookie("name");
        showLogin();
        disableJoinButtons();
        //Clear the text
        $("#playername").popover("show");
        _.delay(function() {
            $("#playername").popover("hide");
        }, 5000);
    });

    //Disable "submit" event from being fired, use our own login procedure
    $("#login-container-forms form").submit(function(e) {
        logIn();
        e.preventDefault();
    });

    function logOut() {
        if (_login_name !== undefined) {
            socket.send("deletePlayer", _login_name);
        }
    }

    socket.on("loggedOut", function() {
        $.removeCookie("name");
        $.removeCookie("session");
        _login_name = undefined;
        showLogin();
        disableJoinButtons();
    });

    $("#log-out").click(logOut);

    function enableJoinButtons() {
        var $tableJoinButtons = $(".joinbtn, #newtable");
        $tableJoinButtons.removeClass("disabled");
    }

    function disableJoinButtons() {
        var $tableJoinButtons = $(".joinbtn, #newtable");
        $tableJoinButtons.addClass("disabled");
    }

    function showLogin() {
        $("#login-container-forms .input-group").removeClass("hidden");
        $("#login-container-forms .current-user").addClass("hidden");
    }

    function showLogout() {
        $("#login-container-forms .input-group").addClass("hidden");
        $("#login-container-forms .current-user").removeClass("hidden");
    }

    function isLoggedIn() {
        return $.cookie("name") !== undefined;
    }
    // -------------------------------- Joining Tables ----------------------------- //

    function tableRowHtml(table) {
        var player_names = table.players.join(", ");
        var round = table.round;
        var t_id = table.id;

        return '<tr>' +
            '<td>' + player_names + '</td>' +
            '<td>' + round + '</td>' +
            '<td><div  id = "' + t_id + '" class=' +
            '"joinbtn text-center btn btn-md btn-primary">' +
            '<strong>Join</strong>&nbsp;' +
            '<span class="glyphicon glyphicon-chevron-right"></span>' +
            '</div></td>' +
            '</tr>';

    }
    $("#newtable").click(function() {
        if (isLoggedIn() === true) {
            //Prevent being able to double-click new game
            var buttons = $(".joinbtn, #newtable");
            buttons.addClass("disabled");
            socket.send("newTable", _login_name);
        }
    });

    //Add a new table to all the users that are still looking for one
    socket.on("addTableRow", addTableRow);

    function addTableRow(table) {
        $("#game-list-table tbody").append(tableRowHtml(table));
        //When we add a new table, check to see if we should make links inactive
        if (isLoggedIn() === true) {
            enableJoinButtons();
        } else {
            disableJoinButtons();
        }
        // If we click the button, join that table
        $("#" + table.id).click(joinTableClick);
    }

    socket.on("updateTableRow", function(table) {
        var row = $("#" + table.id).closest("tr");
        if (row.length === 0) {
            addTableRow(table);
        } else {
            row.replaceWith(tableRowHtml(table));
            if (isLoggedIn() === true) {
                enableJoinButtons();
            } else {
                disableJoinButtons();
            }
            $("#" + table.id).click(joinTableClick);
        }
    });

    function joinTableClick() {
        var id = $(this).attr("id");
        if (isLoggedIn() === true) {
            var buttons = $(".joinbtn,#newtable");
            buttons.addClass("disabled");
            socket.send("joinTable", id, _login_name);
        }
    }

    socket.on("removeTableRow", function(table_id) {
        $("#" + table_id).closest("tr").remove();
    });

    var alertDialog = $("#name-taken");
    alertDialog.parent().addClass("hidden");
    $(".alert .close").on("click", function() {
        $(this).parent().addClass("hidden");
    });

    // -------------------------------- Switching Views ----------------------------- //
    //Switch views to the table view
    socket.on("joinTable", function(name) {
        _name = name;
        document.title = _name + ": Video Hearts";
        $("#list-view").addClass("hidden");
        $("#login-view").addClass("hidden");
        $("#game-view").removeClass("hidden");
        $("#leave-table").removeClass("hidden");
    });

    socket.on("connectToChat", function(id, table_id) {
        _table_id = table_id;
        easyrtc.setSocketUrl("http://66.49.36.2:8888");
        easyrtc.setVideoDims(320, 240);
        easyrtc.setStreamAcceptor(acceptCall);
        easyrtc.setUsername(_name);
        easyrtc.setOnError(manageError);
        easyrtc.setDisconnectListener(handleDisconnect);

        easyrtc.initMediaSource(
            function() { // success callback
                easyrtc.connect("VideoHearts", connectSuccess, connectFailure);
            },
            connectFailure
        );

        easyrtc.setOnStreamClosed(streamClosed);
    });

    function connectSuccess(myId) {
        _local_stream = easyrtc.getLocalStream();
        showVideo("local", _local_stream);

        console.log("My easyrtcid is " + easyrtc.myEasyrtcid);

        easyrtc.joinRoom(_table_id, null,
            function(roomName) {
                console.log("I'm now in room " + roomName);
            },
            function(errorCode, errorText, roomName) {
                console.log("had problems joining " + roomName);
            }
        );
        easyrtc.setRoomOccupantListener(roomListener);
    }

    function connectFailure(errmesg) {
        console.log(errmesg);
    }

    function manageError(errEvent) {
        debugger;
        console.log("!!! ERROR !!!:");
        console.log(errEvent.errorText);
    }

    function handleDisconnect() {
        debugger;
        console.log("!!! Disconnect !!!:");
    }

    function roomListener(room_name, other_peers) {
        console.log(room_name);
        if (room_name == _table_id) {
            console.log(other_peers);
            _.each(other_peers, function(other_peer, id) {
                if (easyrtc.myEasyrtcid < id)
                    easyrtc.call(id,
                        function(id) {
                            console.log("completed call to " + id);
                        },
                        function(errorMessage) {
                            console.log("err:" + errorMessage);
                        },
                        function(accepted, bywho) {
                            console.log((accepted ? "accepted" : "rejected") + " by " + bywho);
                        }
                    );
            });
        }
    }

    function acceptCall(easyrtcid, stream) {
        if (!(easyrtcid in _calls)) {
            _calls[_calls.length + 1] = easyrtcid;
            var caller_name = easyrtc.idToName(easyrtcid);

            if (caller_name in _players) {
                var player = _players[caller_name];
                showVideo(player.dir, stream);
            }
        }
    }

    function streamClosed(easyrtcid) {
        var caller_name = easyrtc.idToName(easyrtcid);
        _calls = _.without(_calls, easyrtcid);
        if (caller_name in _players) {
            var player = _players[caller_name];
            hideVideo(player.dir);
        }
        console.log(easyrtc.idToName(easyrtcid) + " went away");
    }

    function hideVideo(dir) {
        $('#video-' + dir).removeAttr("src");
        $('#video-' + dir).addClass("hidden");
        $('#img-' + dir).removeClass("hidden");
    }

    function showVideo(dir, stream) {
        $('#img-' + dir).addClass("hidden");
        $('#video-' + dir).attr("src", URL.createObjectURL(stream));
        $('#video-' + dir).removeClass("hidden");
    }

    $("#video-local, #video-local-overlay").click(function() {
        $("#video-local-mic").toggleClass("off");
        if (_local_stream !== null) {
            var audioTracks = _local_stream.getAudioTracks();
            for (var i = 0, l = audioTracks.length; i < l; i++) {
                audioTracks[i].enabled = !audioTracks[i].enabled;
            }
        }
    });

    $("#video-local, #video-local-overlay").hover(
        function() { //Hover-over
            $("#video-local-overlay").removeClass("hidden");
        },
        function() { //Hover-off
            if ($("#video-local-mic").hasClass("off") === false) {
                $("#video-local-overlay").addClass("hidden");
            }
        }
    );


    $("#leave-table").click(function() {
        document.title = "Video Hearts";
        $("#game-view").addClass("hidden");
        $("#list-view").removeClass("hidden");
        $("#login-view").removeClass("hidden");
        socket.send("leaveTable");

        easyrtc.leaveRoom(_table_id);
        easyrtc.hangupAll();
        easyrtc.disconnect();
        if (_local_stream !== null) {
            _local_stream.stop();
        }
        hideVideo("local");

        //We need to re-login because leaving the table is just like disconnecting
        logIn();
    });

    // -------------------------------- Game ----------------------------- //

    socket.on("restoreState", function(table, player) {
        _state = table.state;
        _round = table.round;
        if (_state == "trading") {
            setInfoText("Select cards to trade (passing " + table.trade_dir + ")", color_grey);
        } else if (_state == "playing") {
            _trick_suit = table.trick_suit;
            _hearts_broken = table.hearts_broken;
            _restore_play_state = true; //Handle this once we have all player info
        }
        showCards(player.hand);
        $("#leave-table").addClass("hidden");
    });

    socket.on("nextRound", function(table) {
        if (_.size(_players) == 4) {
            _state = table.state;
            _round = table.round;
            if (_round === 1) {
                $("#leave-table").addClass("hidden");
            }
            if (table.state == "trading") {
                _skip_trade = false;
                setInfoText("Select cards to trade (passing " + table.trade_dir + ")", color_grey);
            } else {
                _skip_trade = true;
            }

            socket.send("dealCards");
            $("#played-cards").removeClass("hidden");
        }
    });

    function setInfoText(text, color) {
        var text_div = $("#info-text");
        var nav_label_div = $(".nav-info");
        text_div.text("");
        text_div.append(text);
        if (color !== undefined) {
            _.each(color_map, function(value, key) {
                if (nav_label_div.hasClass(value)) {
                    nav_label_div.removeClass(value);
                }
            });
            nav_label_div.addClass(color);
        }
    }

    //all_pos: A map from position to {name: ?, score: ?}
    socket.on("updatePositions", function(your_pos, all_pos) {
        var pos_map = ["N", "W", "S", "E"];
        var dir_map = ["bottom", "right", "top", "left"];

        //Rotate the table around based on our position
        pos_map = _.rotate(pos_map, _.indexOf(pos_map, your_pos));
        var pos_dir_map = _.object(pos_map, dir_map);

        //Update the names for the score table
        var $score_table_head = $("#score-table thead tr th");

        //Add players that exist
        _.each(all_pos, function(player, pos) {
            var rel_dir = pos_dir_map[pos];
            var name = (player.name === null ? "Open" : player.name);
            var score = (player.score === undefined ? "0" : player.score);
            var name_div = $("#" + rel_dir + "name");
            name_div.text(name);
            name_div.addClass(color_map[pos]);
            name_div.removeClass(color_grey);
            if (your_pos == pos) {
                name_div.append('<div class="button"> Pick Up Card </div>');
            }

            if (your_pos == pos) {
                _players[name] = {
                    dir: rel_dir,
                    pos: pos,
                    id: player.id,
                    score_div: name_div.find(".score-label"),
                    color: color_map[pos]
                };
            } 
            else {
                _players[name] = {
                    dir: rel_dir,
                    pos: pos,
                    id: player.id,
                    color: color_map[pos]
                };
            }  
            //Update the score table's title
            var score_index = score_order.indexOf(pos);
            $score_table_head[score_index].innerText = name;
        });
        //Set ever other position to empty
        _.each(pos_dir_map, function(rel_dir, pos) {
            if (_.contains(_.keys(all_pos), pos) === false) {
                var open_div = $("#" + rel_dir + "name");
                open_div.text("Open");
                open_div.removeClass(color_map[pos]);
                open_div.addClass(color_grey);

                hideVideo(rel_dir);
                //Update the score table's title
                var score_index = score_order.indexOf(pos);
                $score_table_head[score_index].innerText = "Open";
            }
        });
        if (_round === 0) {
            var remaining_player_count = 4 - _.size(all_pos);
            setInfoText("Waiting for " + remaining_player_count + " more players", color_grey);
        }
        //If we are restoring the state of the game, ask for the played cards
        if (_restore_play_state === true) {
            _restore_play_state = false;
            socket.send("restorePlayState");
        }
    });

    socket.on("restoringPlayState", function(table) {
        setupTurn(table.turn);
        _.each(table.played_cards, function(card, name) {
            cardPlayed(name, card, _trick_suit);
        });
    });

    socket.on("updateRemainingTrades", function(pass_dir, remaining_trades) {
        setInfoText(remaining_trades + " trades remaining (passing " + pass_dir + ")", color_grey);
    });

    //Deal the cards to each player
    socket.on("showCards", function(cards) {
        showCards(cards, !IS_IPAD);
    });

    function showCards(cards, animate) {
        _hand = _.sortBy(cards, function(card) {
            return sortValue(card);
        });

        var $player_hand = $("#player-hand");

        //Delete the children and replace them
        $player_hand.children().remove();

        for (var i in _hand) {
            var card = _hand[i];
            var $card = $(createCard(card.suit, card.rank));
            if (animate) {
                $card.addClass("flipped");
            }
            $player_hand.append($card);
        }
        if (animate) {
            _.each($(".playing-cards .hand .card.flipped"), function(card, i) {
                _.delay(function() {
                    $(card).removeClass("flipped");
                }, i * 100);
            });
        }

        //Hovering over the cards should pop them up
        $("#player-hand .card").hover(
            function() {
                //In handler
                if (!$(this).hasClass("flipped") && !IS_IPAD) {
                    $("#player-hand .card").removeClass("hover");
                    $(this).addClass("hover");
                }
            },
            function() {
                //Out handler
                $("#player-hand .card").removeClass("hover");
            }
        );



        $("#player-hand .card").click(function() {
            if (_state == "trading") {
                var $traded_cards = $("#traded-cards");
                var trade_count = $traded_cards.children().length;
                if (trade_count < 3) {
                    var $traded_card = $(createCard(getSuit($(this)), getRank($(this))));
                    $traded_cards.append($traded_card);
                    removeFromHand($(this));
                    trade_count++;

                    // Add a click handler to return card back to deck
                    $traded_card.click(function() {
                        addToHand($(this));
                        var trade_count = $("#traded-cards .card").length;

                        if (trade_count == 2) {
                            //Tell the server that we aren't ready yet
                            socket.send("passCards", null);
                        }

                    });
                    if (trade_count == 3) {
                        $("#player-hand .card").addClass("disabled");
                        _.delay(function() {
                            /* Wait 1 seconds before making trade final
                             * This is buggy:
                             * If you deselect a card then quickly reselect another,
                             * the event will still fire
                             */
                            var $selected_cards = $("#traded-cards .card");
                            if ($selected_cards.length == 3) {
                                var selected_cards = $selected_cards.map(function() {
                                    var $this = $(this);
                                    return {
                                        rank: getRank($this),
                                        suit: getSuit($this)
                                    };
                                });
                                socket.send("passCards", $.makeArray(selected_cards));
                            }
                        }, 1000);
                    }
                }
            } else if (_state == "playing") {
                if (_turn == _name && $(this).hasClass("disabled") === false) {
                    //Try to play the card
                    var played_card = {
                        rank: getRank($(this)),
                        suit: getSuit($(this))
                    };
                    socket.send("playCard", played_card);
                }
            }
        });

        if (_skip_trade === true) {
            socket.send("skipPassCards");
            _skip_trade = false;
        }
    }

    function removeFromHand($card) {
        // Remove the card from the hand
        var card = {
            rank: getRank($card),
            suit: getSuit($card)
        };
        var index = cardIndex(card);
        if (index >= 0) {
            //Remove the card and flatten the array
            delete _hand[index];
            _hand = _.compact(_hand);
        }
        $card.remove();
    }

    function addToHand($card) {
        // Add the card back to the hand
        _hand[_hand.length] = {
            rank: getRank($card),
            suit: getSuit($card)
        };
        showCards(_hand);
        $card.remove();
    }

    function cardIndex(card) {
        var hand_index = -1;
        _.each(_hand, function(hand_card, index) {
            if (card.rank == hand_card.rank && card.suit == hand_card.suit) {
                hand_index = index;
            }
        });
        return hand_index;
    }

    socket.on("startTrading", startTrading);

    function startTrading(table, new_hand) {
        _state = table.state;
        _round = table.round;
        _turn = table.turn;
        _hearts_broken = false;

        //Hide and clear the traded cards
        $("#traded-cards .card").remove();
        showCards(new_hand, !IS_IPAD);
    }

    socket.on("startPlaying", startPlaying);

    function startPlaying(table, new_hand) {
        _state = table.state;
        _round = table.round;
        _turn = table.turn;
        _hearts_broken = false;
        //This means we just finished trading cards
        if (_state == "start_playing") {
            _state = "playing";
            //Hide and clear the traded cards
            $("#traded-cards .card").remove();
            showCards(new_hand, !IS_IPAD);

            //Select the person to go first
            /*var two_of_clubs = {
                suit: "C",
                rank: 2
            };
            if (_turn == _name) {
                socket.send("playCard", two_of_clubs);
				}*/
        }
    }

    socket.on("nextPlayer", setupTurn);

    function setupTurn(player_name) {
        _turn = player_name;
        if (_name == player_name) {
            disableAllCards();
            enableAllowedCards();
            setInfoText("It is your turn to play", _players[player_name].color);
            document.title = "It is your turn to play";
        } else {
            disableAllCards();
            setInfoText("It is " + player_name + "'s turn to play", _players[player_name].color);
            document.title = _name + ": Video Hearts";
        }
    }

    function disableAllCards() {
        $("#player-hand .card").addClass("disabled");
    }

    function enableAllowedCards() {
        $("#player-hand .card").removeClass("disabled");
        // var $bc = $("#player-hand");
        // var $hearts = $bc.find(".card.hearts");
        // var $diams = $bc.find(".card.diams");
        // var $clubs = $bc.find(".card.clubs");
        // var $spades = $bc.find(".card.spades");
        // var $all_cards = $bc.find(".card");
        // var $queen_of_spades = $bc.find(".card.rank-q.spades");

        // console.log("Trick suit: " + _trick_suit);

        // //If we are the first person
        // if (_trick_suit === null) {
        //     //We can start with hearts if they are broken or if we only have hearts left
        //     if (_hearts_broken === true || ($hearts.length == $all_cards.length)) {
        //         $hearts.removeClass("disabled");
        //     }
        //     $diams.removeClass("disabled");
        //     $clubs.removeClass("disabled");
        //     $spades.removeClass("disabled");
        // } else {
        //     var suit_class = suit_map[_trick_suit];
        //     var $playable_cards = $bc.find('.card.' + suit_class);
        //     //If we don't have the trick suit, allow every card
        //     if ($playable_cards.length === 0) {
        //         $playable_cards = $bc.find('.card');
        //     }
            
        // }
        // //Finally re-disable cards if this is the first trick
        // if ($all_cards.length == 13) {
        //     $queen_of_spades.addClass("disabled");
        //     $hearts.addClass("disabled");
        // }
    }

    socket.on("cardPlayed", cardPlayed);

    function cardPlayed(opponent_name, card, trick_suit) {
        _trick_suit = trick_suit;
        var opponent = _players[opponent_name];
        if (opponent !== undefined) {
            $card = $(createCard(card.suit, card.rank));
            if (opponent_name == _name) {
                // This creates a css selector for the card
                // ex) ".card.rank-6.spades"
                var selector = "." + $card.attr("class").replace(/\s/g, '.');
                $hand_card = $("#player-hand").find(selector);
                removeFromHand($hand_card);

                $card.addClass("bottom");

            } else {
                $card.addClass(opponent.dir);
            }
            $("#played-cards .card").removeClass("callcard")
            $("#played-cards").append($card);
            $card.addClass("callcard");

        }

        //Hovering over the cards should pop them up
        $("#played-cards .card").hover(
            function() {
                //In handler
                if (!$(this).hasClass("flipped") && !IS_IPAD && !$(this.hasClass("callcard"))) {
                    $("#played-cards .card").removeClass("hover");
                    $(this).addClass("hover");
                }
            },
            function() {
                //Out handler
                $("#played-cards .card").removeClass("hover");
            }
        );
    }

    socket.on("heartsBroken", function() {
        _hearts_broken = true;
        //TODO: Maybe an animation?
    });

    socket.on("clearTrick", function(winner) {
        //Clear the cards after a delay
        _trick_suit = null;
        //Disable cards before starting the next trick
        disableAllCards();
        winner = _players[winner];
        if (winner !== undefined) {
            $(".playing-cards .played").addClass("anim-" + winner.dir);
        }
    });

    $(".playing-cards .played").on("webkitAnimationEnd", function() {
        socket.send("nextTrick");
        $(this).removeClass("anim-left anim-right anim-top anim-bottom");
        $(this).children().remove();
    });

    socket.on("updateScore", function(name, score) {
        _players[name].score_div.text(score);
    });

    $("#score-menu-btn").click(function() {
        var $slider = $(this).closest(".slider");
        $slider.toggleClass("open");
    });

    socket.on("updateScoreTable", function(scores, prev_scores) {
        //Add a new row to the table
        var $score_table = $("#score-table tbody");
        $score_table.append('<tr id = score-table-round-' + scores.round + '></tr>');

        var $this_round = $("#score-table-round-" + scores.round);

        for (var i in score_order) {
            var dir = score_order[i];
            var score = scores[dir];
            //Add the score to this round
            $this_round.append(scoreTableRow(score));

            if (prev_scores.round > 0) {
                var $last_round = $("#score-table-round-" + prev_scores.round);
                var $diffs = $last_round.find("small");
                //Update the difference text
                var diff = score - prev_scores[dir];
                $diffs[i].innerText = '+' + diff;
            }
        }

        //Pop out the score tab
        $(".slider").addClass("open");
        _.delay(function() {
            $(".slider").removeClass("open");
        }, 4000);
    });

    function scoreTableRow(score, diff) {
        return "<td><span class='total-score'>" + score + "</span>" +
            "<span class='round-score text-muted'>" +
            "<small></small>" +
            "</span></td>";
    }
    // -------------------------------- Helper Functions ----------------------------- //

    var suit_map = {
        "F": "lsquo",
        "D": "deg",
        "B": "Dagger",
        "C": "rsquo",
        "N": "uarr",
        "S": "darr",
        "E": "rarr",
        "W": "larr",
        "J": "#74"
    };
    var inv_suit_map = _.invert(suit_map);

    var rank_map = {
        
    };
    var inv_rank_map = _.invert(rank_map);

    var color_blue = "label-primary";
    var color_yellow = "label-warning";
    var color_green = "label-success";
    var color_red = "label-danger";
    var color_grey = "label-default";

    var color_map = {
        "N": color_blue,
        "S": color_yellow,
        "E": color_green,
        "W": color_red,
        "Open": color_grey,
    };

    var score_order = ["N", "E", "S", "W"];

    function createCard(suit, rank) {
        if (suit === undefined || rank === undefined) {
            return '<div class="card">' +
                '<div class="front"></div>' +
                '<div class="back"></div>' +
                '</div>';
        }
        if (rank in rank_map) {
            rank = rank_map[rank];
        }
        return new EJS({
            url: 'templates/card.ejs'
        }).render({
            suit: suit_map[suit],
            rank: rank.toString()
        });
    }

    
    function getSuit($card) {
        for (var suit in inv_suit_map) {
            if ($card.hasClass(suit)) {
                return inv_suit_map[suit];
            }
        }
    }

    function getRank($card) {
        var classes = $card.attr('class').split(/\s+/);
        var rank = _.find(classes, function(c) {
            return (c.indexOf("rank-") === 0);
        });
        rank = rank.substring(5);
        // Only rank with two characters
        return (rank in inv_rank_map) ? parseInt(inv_rank_map[rank]) : parseInt(rank);
    }

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
        var rankVal = card.rank;
        return rankVal + suitVal;
    }

    _.mixin({
        rotate: function(array, n, guard) {
            var head, tail;
            n = (n === null) || guard ? 1 : n;
            n = n % array.length;
            tail = array.slice(n);
            head = array.slice(0, n);
            return tail.concat(head);
        }
    });

    /** Google Analytics **/
    (function(i, s, o, g, r, a, m) {
        i['GoogleAnalyticsObject'] = r;
        i[r] = i[r] || function() {
            (i[r].q = i[r].q || []).push(arguments);
        }, i[r].l = 1 * new Date();
        a = s.createElement(o),
        m = s.getElementsByTagName(o)[0];
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a, m);
    })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

    ga('create', 'UA-48345781-1', 'videohearts.net');
    ga('send', 'pageview');
});