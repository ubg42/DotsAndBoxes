/*jshint smarttabs: true */
/*jshint browser: true*/
/*jshint globalstrict: true*/
/*jshint camelcase: true */
/*jshint quotmark: true */
/*jshint -W099 */
/* global manager: false */
/* global negamax: false */
/* jshint worker: true */


"use strict";

importScripts("negamax.js");

var dotsAndBoxes = (function() {

	var DEADEND = -1;
	var REMOVED = -2;
	
	var EATLOONEY = 10000001;
	var GIVELOONEY = 10000002;
	var GIVEINDEP = 10000;
	
	/**
	 * Creates an internal representation of a gamestate
	 *
	 * @constructor
	 * @this {DotsAndBoxesState}
	 * @param {Array<Number>} otherHe other half of dart
	 * @param {Array<Number>} nextHe next dart in the cycle
	 * @param {Array<Number>} indeps sizes of independent chains/loops
	 * @param {Array<Boolean>} indepAreChains true if the indeps are actually loops
	 * @param {Number} looneyValue  0 - nonLooney, 2 - I can take or 2 coins, 4 - I can take or give 4 coins
	 * @param {Number} score net score to person playing next
	 * @param {Number} whoToMove who has next move (for use in negamax)
	 */
	function DotsAndBoxesState( otherHe, nextHe, heLengths, indeps, indepsAreChains, looneyValue, score, whoToMove ) {
		this.looneyValue = looneyValue;
		this.score = score;
		this.otherHe = otherHe;
		this.nextHe = nextHe;
		this.heLengths = heLengths;
		this.indeps = indeps;
		this.indepsAreChains = indepsAreChains;
		this.whoToMove = whoToMove;
	}
	
	DotsAndBoxesState.prototype.clone = function() {
		return new DotsAndBoxesState(
			this.otherHe.slice(0),
			this.nextHe.slice(0),
			this.heLengths.slice(0),
			this.indeps.slice(0),
			this.indepsAreChains.slice(0),
			this.looneyValue,
			this.score,
			this.whoToMove
		);
	};
	
	DotsAndBoxesState.prototype.numBoxesLeft = function() {
		var counted = [];
		var sum = this.looneyValue;
		
		//Count coins that are joints
		for( var he = 0; he < this.otherHe.length; he++ )
			if( this.otherHe[he] !== REMOVED && counted[he] !== REMOVED ) {
				sum++;
				var nHe = he;
				counted[he] = REMOVED;
				while( he !== this.nextHe[nHe] ) {
					nHe = this.nextHe[nHe];
					counted[nHe] = REMOVED;
				}
			}
		
		counted = [];	
		//Count coins that are in chains
		for( he = 0; he < this.otherHe.length; he++ )
			if( this.otherHe[he] !== REMOVED && counted[he] !== REMOVED ) {
				sum += this.heLengths[he];
				counted[he] = counted[this.otherHe[he]] = REMOVED;
			}
			
		for( var i = 0; i < this.indeps.length; i++ )
			sum += this.indeps[i];
		
		return sum;
	};
	
	DotsAndBoxesState.prototype.gameIsOver = function() {
		return this.numBoxesLeft() === 0;
	};
	
	/**
	 * Quick evaluate of game
	 *
	 * @this {DotsAndBoxesState}
	 * @return { Array<Number> } [ guessEvaluation, hardMin, hardMax ]
	 */
	DotsAndBoxesState.prototype.evaluate = function() {
		var numPointsLeft = this.numBoxesLeft() * 100;
		
		var points = this.score * 100;
		var hardMin = points - numPointsLeft;
		var hardMax = points + numPointsLeft;
		var guess;
		
		var halfRemaining = numPointsLeft % 200; 
		
		if( this.looneyValue !== 0 ) {
			hardMin = points + halfRemaining;
			guess = points + ( numPointsLeft + halfRemaining ) / 2;
			return guess;
			//return [ guess, hardMin, hardMax ];
		}
		
		//Free move, could calc. nimstring val here or somethin'
		return points;
		//return [ points, hardMin, hardMax ];  
	};
	
	/**
	 * If this is a coin with 2 edges only
	 * then remove it absorb it into chains
	 *
	 */
	DotsAndBoxesState.prototype.simplifyLink = function( he ) {
		var he1 = this.nextHe[he];
		if( he1 === DEADEND )
			return;
		var he2 = this.nextHe[he1];
		
		if( he1 !== he && he2 === he ) {
			var otherHe1 = this.otherHe[he1];
			var otherHe2 = this.otherHe[he2];
			
			if( otherHe1 === he2  ) {
				//It's a loop
				this.indeps.push( 1 + this.heLengths[otherHe2] );
				this.indepsAreChains.push(false);
			} else {
				var length = 1 + this.heLengths[he1] + this.heLengths[he2];
				if( otherHe1 !== DEADEND ) {
					this.otherHe[otherHe1] = otherHe2;
					this.heLengths[otherHe1] = length;
				}
				
				if( otherHe2 !== DEADEND ) {
					this.otherHe[otherHe2] = otherHe1;
					this.heLengths[otherHe2] = length;	
				}
				
				if( otherHe1 === DEADEND && otherHe2 === DEADEND ) {
					this.indeps.push( length );
					this.indepsAreChains.push( true);
				}
			}
			this.heLengths[he1] = this.heLengths[he2] =  
			this.otherHe[he1] = this.otherHe[he2] = 
			this.nextHe[he1] = this.nextHe[he2] = REMOVED;
		}
	};
	
	/**
	 * Generates a list of possible moves from this position
	 *
	 * @param {Array<Number>} heList map from moves to halfEdges they represent taking with a convention. Bit of a hack
	 */
	DotsAndBoxesState.prototype.listMoves = function( heList ) {
		var retVal = [];
		var newState;
		
		if( this.looneyValue > 0 ) {
			//1. Eat the 2 squares, get another go
			newState = this.clone();
			newState.score += this.looneyValue;
			newState.looneyValue = 0;
			retVal.push( newState );
			if( heList !== undefined )
				heList.push( EATLOONEY );
			
			//2. Give them away and force opponent to play
			newState = this.clone();
			newState.score *= -1;
			newState.whoToMove *= -1;
			newState.score += this.looneyValue;
			newState.looneyValue = 0;
			retVal.push( newState);
			if( heList !== undefined )
				heList.push( GIVELOONEY);
			
			return retVal;
		}
		
		for( var he = 0; he < this.otherHe.length; he++ )
			if( this.otherHe[he] !== REMOVED ) {
				var oHe = this.otherHe[he];
				var length = this.heLengths[he];
				if( he < oHe )
					continue; 	//do it later
							
				newState = this.clone();
				
				//Three cases
				//1. It's a chain, just remove and do loopey
				//2. It's a loop where the join has 2 extra slots, treat much like a chain
				//3. It's a loop where the join has only one valence, in this case we gotta add that to length of loop first
				
				var isALoop = false;
				if( this.nextHe[he] == oHe || 
					this.nextHe[this.nextHe[he]] === oHe || 
					this.nextHe[this.nextHe[this.nextHe[he]]] == oHe 
				)
					isALoop = true;
				
				var he3 = REMOVED;
				if( isALoop ) {
					if( this.nextHe[he] === he ||
						this.nextHe[this.nextHe[he]] === he ||
						this.nextHe[this.nextHe[this.nextHe[he]]] === he
					) {
						he3 = he;
						while( he3 === he || he3 === oHe)
							he3 = this.nextHe[he3];	//Shouldn't enter infinite loop here as any valence 2s have been removed
						length += this.heLengths[he3] + 1;
					}
					
					
				}
								
				var nHe = this.nextHe[he];
				var noHe = REMOVED;
				if( oHe != DEADEND ) {
					noHe = this.nextHe[oHe];
				}
				
				newState.removeHe(he);
				if( oHe != DEADEND ) {
					newState.removeHe(oHe);
				}
				
				newState.simplifyLink( nHe);
				if( noHe != DEADEND )
					newState.simplifyLink(noHe);
				
				if( he3 !== REMOVED ) {
					var oHe3 = this.otherHe[he3];
					newState.removeHe(he3);
					if( oHe3 !== DEADEND ) {
						newState.removeHe(oHe3);
						newState.simplifyLink( oHe3);
					}
				}
				
				var leaveNumber = 2;
				newState.whoToMove *= -1;
				newState.score *= -1;
				
				if( length > leaveNumber ) {
					newState.score += length -leaveNumber;
					newState.looneyValue = leaveNumber;
					
				}
				else {
					newState.score += length;
					newState.looneyValue = 0;
				}
				
				if( heList !== undefined )
					heList.push( he);
				
				retVal.push( newState );
			}
			
		var minChain = Infinity, minLoop = Infinity;
		var minChainIndex = -1, minLoopIndex = -1;
		for( var i = 0; i < this.indeps.length; i++ ) {
			if( this.indepsAreChains[i] ) {
				if( this.indeps[i] < minChain ) {
					minChain = this.indeps[i];
					minChainIndex = i;
				}
			} else {
				if( this.indeps[i] < minLoop ) {
					minLoop = this.indeps[i];
					minLoopIndex = i;
				}
			}
		}
		
		var that = this;
		function stateFromBreakingIndep( index ) {
			var newState = that.clone();
			var leaveNumber, minNumber;
			if( newState.indepsAreChains[index] ) {
				leaveNumber = 2;
				minNumber = 3;
			}				
			else {
				minNumber = 4;
				leaveNumber = 4;
			}
			
			newState.whoToMove *= -1;
			newState.score *= -1;
			
			var length = newState.indeps[index]; 
			if( length >= minNumber ) {
				//All but 2/4
				newState.looneyValue = leaveNumber;
				newState.score += length - leaveNumber;
			}
			else {
				//Eat them all
				newState.score += length;
				newState.looneyValue = 0;
			}
			
			
			newState.indeps.splice(index, 1);
			newState.indepsAreChains.splice(index, 1);
			retVal.push( newState);
			if( heList !== undefined )
				heList.push( -GIVEINDEP -index);
		}
		
		if( minLoopIndex > -1 )
			stateFromBreakingIndep( minLoopIndex );
		if( minChainIndex > -1 )
			stateFromBreakingIndep( minChainIndex );
	
			
		return retVal;
	};
	
	DotsAndBoxesState.prototype.removeHe = function( he ) {
		var oHe = this.otherHe[he];
				
		this.otherHe[he] = REMOVED;
				
		var nHe = he;
		while( this.nextHe[nHe] !== he )
			nHe = this.nextHe[nHe];
		this.nextHe[nHe] = this.nextHe[he];
		this.nextHe[he] = REMOVED;
		this.heLengths[he] = REMOVED;
	};
	
	function assignHEIndices( vhLines, vhLinesToHEA, vhLinesToHEB, otherHe ) {
		var x,y;
		for( x = 0; x < vhLines.length; x++ ) {
			vhLinesToHEA[x] = [];
			vhLinesToHEB[x] = [];
			for( y = 0; y < vhLines[x].length; y++ ) {
				if( !vhLines[x][y]) {
					if( x === 0 ) {
						vhLinesToHEB[x][y] = otherHe.length;
						otherHe.push(DEADEND);
					}
					else if( x === vhLines.length - 1  ) {
						vhLinesToHEA[x][y] = otherHe.length;
						otherHe.push(DEADEND);
					} 
					else {
						vhLinesToHEA[x][y] = otherHe.length;
						vhLinesToHEB[x][y] = otherHe.length + 1;
						otherHe[ vhLinesToHEA[x][y] ] = vhLinesToHEB[x][y];
						otherHe[ vhLinesToHEB[x][y] ] = vhLinesToHEA[x][y];
					}
				}
			}
		}
	}
	
	function getTimeMillis() {
		return new Date().getTime();
	}
	
	
	return {
		consider:  function( hLines, vLines, currentScore  ) {
			var otherHe = [], nextHe = [], hEToBox = [], heLengths = [];
			
			var vLinesToHELeft = [];
			var vLinesToHERight = [];
			var hLinesToHEUp = [];
			var hLinesToHEDown = [];
			var heIsAlive = [];
			var numDotsX = vLines.length;
			var numDotsY = hLines.length;
			var oHe;
			
			function heToX1Y2X2Y2( halfEdge, score ) {
				var x,y;
				for( x = 0; x <  vLines.length; x++ )
					for( y = 0; y <  vLines[x].length; y++ ) {
						if( vLinesToHELeft[x][y] === halfEdge )
							return { x1 : x, y1 : y, x2 :  x, y2 :  y + 1, score : score, dir : "left" };
						if( vLinesToHERight[x][y] === halfEdge)
							return { x1 : x, y1 : y, x2 :  x, y2 :  y + 1, score : score, dir : "right" };
					}
				for( y = 0; y <  hLines.length; y++ )
					for( x = 0; x <  hLines[y].length; x++ ) {
						if( hLinesToHEUp[y][x] === halfEdge )
							return { x1 : x, y1 : y, x2 : x+1, y2 : y, score : score, dir : "up" };
						if( hLinesToHEDown[y][x] === halfEdge )
							return { x1 : x, y1 : y, x2 : x+1, y2 : y, score : score, dir : "down" };
					}		
				throw "can't find it!";
			}
			
			assignHEIndices( vLines, vLinesToHELeft, vLinesToHERight, otherHe );
			assignHEIndices( hLines, hLinesToHEUp, hLinesToHEDown, otherHe );
			
			var heNumber = 0;
			var boxNumber = 0;
			for( var x = 0; x < vLines.length - 1; x++ )
				for( var y = 0; y < hLines.length - 1; y++ ) {
					var HEsHere = [];
					if( !vLines[x][y] )
						HEsHere.push( vLinesToHERight[x][y]);
					if( !vLines[x+1][y] )
						HEsHere.push( vLinesToHELeft[x+1][y]);
					if( !hLines[y][x] )
						HEsHere.push( hLinesToHEDown[y][x]);
					if( !hLines[y+1][x] )
						HEsHere.push( hLinesToHEUp[y+1][x]);
						
					for( var i = 0; i < HEsHere.length; i++ ) {
						nextHe[ HEsHere[i]] = HEsHere[ ( i + 1) % HEsHere.length ];
						hEToBox[HEsHere[i]] = boxNumber;
						heLengths[HEsHere[i]] = 0;
					}
					boxNumber++;
				}
				
			var gameState = new DotsAndBoxesState(
				otherHe,
				nextHe,
				heLengths,
				[],
				[],
				0,
				0,
				1
			);
			
			var unsimpliefiedGameState = gameState.clone();
				
			//Remove any 2s and populate lengths, indepLoops and indepChains instead
			var indepsToHe = [];
			var oldIndepsSize = 0;
			for( var he = 0; he < nextHe.length; he++ ) {
				gameState.simplifyLink( he);
				if( gameState.indeps.length > oldIndepsSize ) {
					oldIndepsSize++;
					indepsToHe.push(he);
					if( oldIndepsSize != gameState.indeps.length )
						throw "Something messed up";
				}
			}
				
			
			//Take any free squares
			// If there are long chains, take any loops and all but 2 of last one
			// If there are long loops, take all but 4 of last loop
			//To help me backtrack what line was taken for given chain /looney
			var looneyToHe;
			var loops = [], chains = [];	
			for( he = 0; he < gameState.nextHe.length; he++ ) {
				if( gameState.nextHe[he] === he ) {
					oHe = gameState.otherHe[he];
					if( gameState.nextHe[oHe] === gameState.otherHe[he] ) {
						//broken loop, ie it's 1-attached coin leading to another 1-attached coin
						if( heLengths[he] != 2 ) {
							console.log( "Eat some broken loop");
							return heToX1Y2X2Y2( he );
						} else {
							loops.push(he);
							looneyToHe = he;
						} 
					} else {
						//broken chain
						if( gameState.heLengths[he] !== 1 ) {
							console.log( "Eat broken chain");
							return heToX1Y2X2Y2( he );
						} else {
							chains.push( he );
							looneyToHe = he;
						}
					}
				}
			}
			
			if( chains.length > 0 )
				if( loops.length  > 0 ) {
					console.log( "Eat loop as there is a chain remaining");
					return heToX1Y2X2Y2( loops[0] );
				}
					
					
			if( chains.length > 1 ) {
				console.log( "Eat chain as there is another chain remaining");
				return heToX1Y2X2Y2( chains[0] );
			}
				
			if( loops.length > 2 ) //Loops are double counted above
			{
				console.log( "Eat loop as there is another loop remaining");
				return heToX1Y2X2Y2( loops[0] );
			}
				
			//Need to work out if looney or not
			if( chains.length === 1 )
				gameState.looneyValue = 2;
			if( loops.length === 2 )
				gameState.looneyValue = 4;
			if( gameState.looneyValue > 0 ) {
				oHe = gameState.otherHe[looneyToHe];
				gameState.removeHe( looneyToHe);
				if( oHe != DEADEND ) {
					var noHe = gameState.nextHe[oHe];
					gameState.removeHe( oHe);
					gameState.simplifyLink( noHe);	
				}	
			}
			
			//Now we should have a nice canonical game state!
			gameState = new DotsAndBoxesState(
				gameState.otherHe,
				gameState.nextHe,
				gameState.heLengths,
				gameState.indeps,
				gameState.indepsAreChains,
				gameState.looneyValue,
				currentScore,
				1
			);
			
			/*
			graphics.removeHe();
			for( he = 0; he < gameState.nextHe.length; he++ ) {
				if( gameState.nextHe[he] != REMOVED  ) {
					var coords = heToX1Y2X2Y2( he, 0 );
					graphics.showHe( coords.x1, coords.y1, coords.x2, coords.y2, coords.dir, he + " (" + gameState.heLengths[he]+ ")");	
				}
			}
			*/
			
			var startTime = getTimeMillis();
			var heList = [];
			var children = gameState.listMoves( heList );
			var depth = 1;
			var scores = [];
			var bestMove;
			for( var iScore = 0; iScore < children.length; iScore++ )
				scores.push( { child : children[iScore], he : heList[iScore] });
			while( depth < 200 ) {
				negamax.resetStats();
				var bestValue = -Infinity;
				for( var iGame = 0; iGame < scores.length; iGame++ ) {
					var value, child = scores[iGame].child;
					var multiplier = child.whoToMove;
					if( multiplier == -1 )
						value = - negamax.negamax( child, depth - 1, - Infinity, - bestValue );
					else
						value = negamax.negamax( child, depth - 1, bestValue, Infinity );
					value = Math.max(value, bestValue);
					scores[ iGame].value = value;
				}
				scores.sort( function( a, b ) { return b.value - a.value; } );
				
				he = scores[0].he;
				var bestScore = scores[0].value;
				if( gameState.looneyValue > 0 ) {
					if( he === EATLOONEY )
						bestMove = heToX1Y2X2Y2( looneyToHe, bestScore);
					if( he === GIVELOONEY) {
						bestMove = heToX1Y2X2Y2( unsimpliefiedGameState.nextHe[ unsimpliefiedGameState.otherHe[looneyToHe]], bestScore);
					}
				}
				else if( he <=  - GIVEINDEP ) {
					var indepNumber = - he - GIVEINDEP;
					var indepHe = indepsToHe[indepNumber];
					if( gameState.indeps[indepNumber] == 2 && unsimpliefiedGameState.otherHe[indepHe] === DEADEND )
						bestMove = heToX1Y2X2Y2(unsimpliefiedGameState.nextHe[indepHe], bestScore);
					else
						bestMove = heToX1Y2X2Y2(indepHe, bestScore);	
				}
				else if( gameState.heLengths[he] === 2 ) {
					//Need to do hard-hearted handout
					bestMove = heToX1Y2X2Y2( unsimpliefiedGameState.nextHe[unsimpliefiedGameState.otherHe[he]], bestScore);
				}
				else				 
					bestMove = heToX1Y2X2Y2( he, bestScore);
				
				var searchDuration = getTimeMillis() - startTime ;
				self.postMessage(
					{
						depth : depth,
						searchDuration : searchDuration,
						bestMove : bestMove,
						bestScore : bestScore,
						negamaxStats : negamax.getStats(),
						message : "dataSoFar"
					}
				);
				
				depth++;
			}
			return bestMove;
		}
	};		
})();

self.addEventListener("message", function(data) {
	var guess = dotsAndBoxes.consider( data.data.hLines, data.data.vLines, data.data.score );
  	self.postMessage( {
  		message : "done",
  		bestMove : guess
  	});
}, false);

var console = {
	log : function( message) {
		self.postMessage( { 
			message : "log", 
			text : message 
		}
	);}
};
