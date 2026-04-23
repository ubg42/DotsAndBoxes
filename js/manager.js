/*jshint smarttabs: true */
/*jshint browser: true*/
/*jshint globalstrict: true*/
/*jshint camelcase: true */
/*jshint quotmark: true */
/*jshint -W099 */
/* global graphics: false */
/* global dotsAndBoxes: false */

"use strict";

var manager = (function() {
	var numDotsX, numDotsY;
	var hLines = [];
	var vLines = [];
	var boxes = [];
	var scoresOnTheDoors;
	var turnsArray;
	var playerNames;
	var whoseTurn = -1;
	var playersAreComputer;
	var gameName;
	var gameNumberInSession = 0;
	var sessionName = Math.floor(Math.random() * 100000001).toString();
	if( localStorage.userId === undefined ) {
		localStorage.userId = Math.floor(Math.random() * 100000001).toString();
		localStorage.sessionNumber = 0;
	}
	localStorage.sessionNumber = +localStorage.sessionNumber + 1;
	
	var nextWorker;
	var cheated;
	
	var logger = new ( function() {
		var sendLog = function( payLoad ) {
			var logger = new XMLHttpRequest();
			logger.open("POST","dotsAndBoxesLog.php",true);
			logger.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
			logger.send( JSON.stringify(payLoad));
		};
		
		this.logEndGame = function(reason, comment) {
			flush();
			var playerNames = graphics.getPlayerNames();
			sendLog( {
				event : "endGame",
				Time : new Date().getTime() / 1000,
				cols : {
					Reason : reason,
					GameName : gameName,
					Time: new Date().getTime(),
					ThinkTime : +graphics.getThinkTime(),
					Score1 : 	scoresOnTheDoors[0],
					Score2 :	scoresOnTheDoors[1],
					Cheated : cheated,
					Name : localStorage.finalScoreName || "", 
					Comment : comment || "",
				},
			} );	
		};
		
		this.logMove = function() {
			flush();
			sendLog( {
				event : "move",
				Time : new Date().getTime() / 1000,
				data : {
					gameName : gameName,
					gameCode: toStringCode(),
				},
			});
		};		
		
		var currentNewGame;
		this.logNewGame = function() {
			currentNewGame = {
				event : "newGame",
				Time : new Date().getTime() / 1000,
				cols : {
					GameName : gameName,
					NumRows : numDotsY -1,
					NumCols : numDotsX -1,
					PlayersAreComputer1 : playersAreComputer[0],
					PlayersAreComputer2 : playersAreComputer[1],
					GameNumberInSession : gameNumberInSession,
					ThinkTime : +graphics.getThinkTime(),
					SessionId : +sessionName,
				}
			};
			currentNewGame = JSON.parse(JSON.stringify(currentNewGame));
			if( gameNumberInSession === 1)
				flush();
			else				
				setTimeout( flush, 5000 );	//for 2nd games etc. don't log if eg. just changing settings
		};
		
		function flush() {
			if( currentNewGame !== undefined)
				sendLog( currentNewGame);
			currentNewGame = undefined;				
		}
		
		sendLog( {
			event : "sessionStart",
			Time : new Date().getTime() / 1000,
			cols : {
				SessionId : +sessionName,
				UserId : +(localStorage.userId),
				SessionNumber : +(localStorage.sessionNumber),
			},
		});
	})();
	
	function getWorker() {
		//Warm up so we always have one ready
		var currentWorker = nextWorker;
		nextWorker = new Worker("js/dotsAndBoxesState.js");
		return currentWorker;	
	}
	getWorker();
	
	
	function Turn( who, wasComputer, edgeNumber ) {
		return {
			edgeNumber : edgeNumber,
			who : who,
			toStringCode : function() {
				var charCode = String.charCodeAt( who);
				if( wasComputer)
					charCode += 2;
				var character = String.fromCharCode( charCode );
				return character + edgeNumber;
			},
			
			toPOJSO : function() {
				return {
					W : who,
					C : wasComputer,
					E : edgeNumber
				};
			}
		};
	}

	function turnFromPOJSO( object ) {
		return new Turn( object.W, object.C, object.E );
	}
	
	function appendMoveToTurns( who, wasComputer, x1, y1, x2, y2 ) {
		turnsArray.push( new Turn( who, wasComputer, toEdgeNumber( x1, y1, x2, y2 ) ));
	}
	
	function toStringCode() {		
		var object =  {
			"NX" :  numDotsX,
			"NY" :  numDotsY,
			"P" :   playerNames,
			"M"  :  turnsArray.map( function(inn) { return inn.toPOJSO();}),
			"U"  : gameName
		};
		return JSON.stringify( object );
	}
	
	 function fromStringCode( string ) {
		var object = JSON.parse( string );
		numDotsX = object.NX;
		numDotsY = object.NY;
		graphics.setNumDotsX( numDotsX);
		graphics.setNumDotsY( numDotsY);
		playerNames = object.P;
		turnsArray = object.M.map( function( inn ) { return turnFromPOJSO( inn ); } );
	}
	
	function toEdgeNumber( x1, y1, x2, y2 ) {
		if( y1 === y2 )
			return Math.min( x1, x2) + y1 * (numDotsX - 1);
		else if( x1 === x2 )
			return Math.min( y1, y2 ) + x1 * (numDotsY - 1) + ( numDotsX -1) * numDotsY;
		else throw "???";
	}
	
	function fromEdgeNumber( edgeNumber ) {
		var x, y;
		if( edgeNumber >= ( numDotsX -1) * numDotsY ) {
			edgeNumber -= ( numDotsX -1) * numDotsY;
			y = edgeNumber % ( numDotsY - 1);
			x = (edgeNumber - y) / (numDotsY - 1);
			return [ x, y, x, y + 1 ]; 
		}
		
		x = edgeNumber % ( numDotsX - 1);
		y = (edgeNumber - x) / (numDotsX - 1);
		return [ x, y, x + 1, y ];
	}
	
	function newBoxesFromHLine( hLines, vLines, x1, x2, y1, y2 ) {
		var newBoxes = [], x,y;
		if( x1 !== x2 )
			throw "are you using this func right?";
			 
		y = Math.min(y1,y2);
		x = x1;
		//Check box left and right
		if( x > 0 &&
			vLines[x-1][y] && 
			hLines[y][x-1] && 
			hLines[y+1][x-1]
		)
			newBoxes.push( [x-1,y]);
			
		if( x < vLines.length - 1 &&
			vLines[x+1][y] && 
			hLines[y][x] && 
			hLines[y+1][x]
		)
			newBoxes.push( [x,y]);
		
		return newBoxes;			
	}
	
	function applyMove( x1, y1, x2, y2, who ) {
		graphics.newAnimationGroup();
		
		var i;
		if( !isLegal( x1, y1, x2, y2 ) )
			throw "non legal move tried!";
		
		var newBoxes = [];
		if( x1 === x2 ) {	//it's a vLine
			newBoxes = newBoxesFromHLine( hLines, vLines, x1, x2, y1, y2);
			vLines[x1][Math.min( y1, y2)] = 1;
		}
		else {				//it's an hLine
			newBoxes = newBoxesFromHLine( vLines, hLines, y1, y2, x1, x2);
			for( i = 0; i < newBoxes.length; i++ )
				newBoxes[i] = [ newBoxes[i][1], newBoxes[i][0] ];
			hLines[y1][Math.min(x1,x2)] = 1;
		}
		
		if( newBoxes.length) {
			scoresOnTheDoors[who] += newBoxes.length;
			for( i = 0; i < newBoxes.length; i++ ) {
				graphics.drawSquare( newBoxes[i][0], newBoxes[i][1], who, playerNames[who], playerNames[ 1- who]);
				boxes[ newBoxes[i][0]][newBoxes[i][1]] = who;
			}
		}
		
		graphics.drawLine( x1, y1, x2, y2, who );
		graphics.setScores( scoresOnTheDoors, playerNames, who );
		return !!newBoxes.length;
	}
	
	function registerMove( x1, y1, x2, y2, who, wasComputer ) {
		var retVal = applyMove( x1, y1, x2, y2, who );
		
		appendMoveToTurns( who, wasComputer, x1, y1, x2, y2 );
		graphics.setGameCode( toStringCode() );
		graphics.removeHint();
		
		if( isGameOver() ) {
			graphics.showEndScore( playerNames, scoresOnTheDoors );
			return false;
		}
		
		setTimeout( checkComputerToPlay, 100 );
		return retVal;
	}
	
	function isLegal( x1, y1, x2, y2 ) {
		if( x1 === x2 )
			if( vLines[x1][Math.min( y1, y2 )] ) 
				return false;
		if( y1 === y2 )
			if( hLines[y1][Math.min( x1, x2 )] ) 
				return false;
		
		if( !( Math.abs( x1-x2) === 1 && y1===y2) && !( Math.abs( y1-y2) === 1 && x1===x2) )
			return false;
		if( x1 < 0 || x1 > numDotsX || x2 < 0 || x2 > numDotsX )
			return false;
		if( y1 < 0 || y1 > numDotsY || y2 < 0 || y2 > numDotsY )
			return false; 					 					
		return true;
	}
	
	function zeroOutVars() {
		scoresOnTheDoors = [0, 0];
		var i,j;
		vLines = [];
		hLines = [];
		
		for( i = 0; i < numDotsX; i++ ) {
			vLines[i] = [];
			for( j = 0; j < numDotsY - 1; j++ )  
				vLines[i].push(0);
		}
		
		for( i = 0; i < numDotsY; i++ ) {
			hLines[i] = [];
			for( j = 0; j < numDotsX - 1; j++ )  
				hLines[i].push(0);
		}  
			
		for( i = 0; i < numDotsX - 1; i++ )  
			boxes[i] = [];
	}
	
	function isGameOver(){
		return scoresOnTheDoors[0] + scoresOnTheDoors[1] === ( numDotsX -1 ) * (numDotsY -1 );
	}
	
	function checkComputerToPlay() {
		if( !playersAreComputer[whoseTurn])
			return;
		playNowFlag = false;
		var worker = getWorker();

		var currentState = toStringCode();
		var bestMove;
		var moveTaken = false;
		var takeMove = function() {
			worker.terminate();
			clearTimeout( timerId);
			clearInterval( intervalId);
			graphics.setIsThinking( false );
			
			//Race conditions...
			if( toStringCode() !== currentState)
				return;
				
			var anotherGo = registerMove( bestMove.x1, bestMove.y1, bestMove.x2, bestMove.y2, whoseTurn, true );
			if( !anotherGo)
				whoseTurn = 1 - whoseTurn;
		};
		
		var timerId;
		worker.addEventListener("message", function(dataSoFar) {
			switch( dataSoFar.data.message ) {
				case "dataSoFar" :
					graphics.setStats( dataSoFar.data.depth, dataSoFar.data.searchDuration, dataSoFar.data.bestScore, dataSoFar.data.negamaxStats );
					bestMove = dataSoFar.data.bestMove;
					if( timerId ===  undefined )
						timerId = setTimeout( takeMove, +graphics.getThinkTime() * 1000);	
					break;	
				case "done" :
					clearTimeout( timerId);
					bestMove = dataSoFar.data.bestMove;
					takeMove();	
			}			 
		}, false);
		
		var timeStart = new Date().getTime();
		graphics.setIsThinking( true );
		var intervalId = setInterval( function() {
			graphics.setProgress( new Date().getTime() - timeStart );
			if( playNowFlag)
				takeMove();
			
		}, 10 );

		var data = {
			hLines : hLines,
			vLines : vLines,
			score : scoresOnTheDoors[whoseTurn] - scoresOnTheDoors[1-whoseTurn] 
		};
		worker.postMessage(data);
	}
	
	var playNowFlag = false;
	var hintWorker;
	return {
		doMove : function(x1, y1, x2, y2, freeMove ) {
			var computerTurn = true;
			
			if( playersAreComputer[whoseTurn])
				return;
				
			graphics.newAnimationQueue();
			
			if( freeMove )
				cheated = true;
			
			var who;
			if( freeMove == 2 )
				who = 1 - whoseTurn;
			else 
				who = whoseTurn;
			
			if( registerMove( x1, y1, x2, y2, who, false  ) )
				return;	//Your go again!
			
			if( freeMove || isGameOver() )
				return;
			
			whoseTurn = 1 - whoseTurn;
			logger.logMove();
		},
		
		isLegal : isLegal,
		
		newGame : function( reason) {
			if( reason !== undefined && turnsArray.length > 0 && !isGameOver())
				logger.logEndGame( reason);
				
			var i;
			cheated = false;
			gameNumberInSession++;
			gameName = sessionName + "." + gameNumberInSession;
			playerNames = graphics.getPlayerNames();
			
			numDotsX = graphics.setNumDotsX();
			numDotsY = graphics.setNumDotsY();
			
			turnsArray = [];
			zeroOutVars();
			whoseTurn = graphics.getWhoMovesFirst();
				
			graphics.drawNewGame( numDotsX, numDotsY);
			graphics.setGameCode( toStringCode() );
			graphics.setScores( scoresOnTheDoors, playerNames, -1 );
			playersAreComputer = graphics.getPlayersAreComputer();
			logger.logNewGame();						
				
			checkComputerToPlay();
		} ,
		
		loadGame : function() {
			var gameCode = graphics.setGameCode();
			if( turnsArray.length > 0 && !isGameOver() )
				logger.logEndGame( "loadGame");
			cheated = true;
			fromStringCode( gameCode );
			zeroOutVars();
			graphics.drawNewGame( numDotsX, numDotsY);
			graphics.newAnimationQueue();
			//Apply each turn in order
			for( var i = 0; i < turnsArray.length; i++ ) {
				var turn = turnsArray[i];
				var move = fromEdgeNumber( turn.edgeNumber);
				applyMove( move[0], move[1], move[2], move[3], turn.who );
			}
		},
		
		getHLines : function() {
			return hLines;
		},
		getVLines : function() {
			return vLines;
		},
		
		showHint : function() {
			var hintWorker = getWorker();
		
			var currentStringCode = toStringCode();
			var timerId;
			hintWorker.addEventListener("message", function(dataSoFar) {
				var guess;
				if( currentStringCode !== toStringCode() ) {
					hintWorker.terminate();
					graphics.removeHint();
					return;
				}
				switch( dataSoFar.data.message ) {
					case "dataSoFar" :
						graphics.setStats( dataSoFar.data.depth, dataSoFar.data.searchDuration, dataSoFar.data.bestScore, dataSoFar.data.negamaxStats );
						guess = dataSoFar.data.bestMove;
						graphics.showHint( guess.x1, guess.y1, guess.x2, guess.y2, 0);	
						break;	
					case "done" :	
						guess = dataSoFar.data.bestMove;
						graphics.showHint( guess.x1, guess.y1, guess.x2, guess.y2, 0);
						hintWorker.terminate();
						break;	
					default :
						throw "unknown message";
				}			 
			}, false);

			var data = {
				hLines : hLines,
				vLines : vLines,
				score : scoresOnTheDoors[whoseTurn] - scoresOnTheDoors[1-whoseTurn] 
			};
			hintWorker.postMessage(data);
		},
		
		takeBack : function() {
			var newBoxes;
			cheated = true;
			graphics.removeHint();
			graphics.newAnimationQueue();
			while( true ) {
				graphics.newAnimationGroup();
				var i;
				var turn = turnsArray.pop();
				if( turn === undefined)
					break;
				var move = fromEdgeNumber( turn.edgeNumber);
				var x1 = move[0];
				var y1 = move[1];
				var x2 = move[2];
				var y2 = move[3];
				if( x1 === x2 ) {	//it's a vLine
					vLines[x1][Math.min( y1, y2)] = 0;
					newBoxes = newBoxesFromHLine( hLines, vLines, x1, x2, y1, y2);
				}
				else {				//it's an hLine
					hLines[y1][Math.min(x1,x2)] = 0;
					newBoxes = newBoxesFromHLine( vLines, hLines, y1, y2, x1, x2);
					for( i = 0; i < newBoxes.length; i++ )
						newBoxes[i] = [ newBoxes[i][1], newBoxes[i][0] ];
				}
				graphics.unDrawLine(x1, y1, x2, y2);
				for( i = 0; i < newBoxes.length; i++ ) {
					scoresOnTheDoors[ newBoxes[i][0]][newBoxes[i][1]]--;
					boxes[ newBoxes[i][0]][newBoxes[i][1]] = 0;
					graphics.unDrawSquare( newBoxes[i][0], newBoxes[i][1] );
				}
				if( newBoxes.length === 0)
					whoseTurn = 1 - whoseTurn;
				if( !playersAreComputer[ whoseTurn])
					break;
			}
			
			graphics.setGameCode( toStringCode() );
			graphics.setScores( scoresOnTheDoors, playerNames, whoseTurn );
		},
		
		playNow : function() {
			cheated = true;
			playNowFlag = true;
		},
		
		gameFinished : function(comment) {
			logger.logEndGame("finished", comment);
		},
	};
} )(); 
