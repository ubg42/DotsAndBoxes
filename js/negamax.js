/*jshint smarttabs: true */
/*jshint browser: true*/
/*jshint globalstrict: true*/
/*jshint camelcase: true */
/*jshint quotmark: true */
/*jshint -W099 */
/* global graphics: false */

"use strict";

/**
 * Tells you the value of this position
 * 
 * @param {Object} gameState
 * @param {Number} depth
 * @param {Number} alpha
 * @param {Number} beta
 * 
 * interface of gameState is: 
 * listMoves(), array of next gameStates
 * evaluate(), integer of score from the point of view of next player
 * whoToMove integer of who is next to play
 * gameIsOver boolean if the game has finished 
 */
var negamax = (function() {
	var numNodesVisited, numLeavesVisited;
	
	
	return {
		resetStats : function() {
			numNodesVisited = 0;
			numLeavesVisited = 0;
		},
		
		getStats : function() {
			return {
				numNodesVisited : numNodesVisited,
				numLeavesVisited : numLeavesVisited
			};
		},
		
		negamax : function( gameState, depth, alpha, beta ) {
			var moves, bestValue = - Infinity, value;
			numNodesVisited++;
			
			if( depth === 0 || gameState.gameIsOver() ) {
				numLeavesVisited++;
				return gameState.evaluate();
			}
		
			moves = gameState.listMoves();
			if( moves.length === 0 )
				return gameState.evaluate(); 
		
			for ( var i = 0; i < moves.length; i++ ) {
				var multiplier = gameState.whoToMove * moves[i].whoToMove;
				if( multiplier == -1 )
					value = - this.negamax( moves[ i ], depth - 1, - beta, - alpha );
				else
					value = this.negamax( moves[ i ], depth - 1, alpha, beta );
				bestValue = Math.max(value, bestValue);
				if( bestValue >= beta )
				 	break;
				alpha = Math.max( bestValue, alpha);
			}
			return bestValue;		
		}
	};
})();
