/*jshint smarttabs: true */
/*jshint browser: true*/
/*jshint globalstrict: true*/
/*jshint camelcase: true */
/*jshint quotmark: true */
/* jshint -W099 */
/* global manager: false */

"use strict";

var graphics = (function() {
	var dotNodes = [], numDotsX, numDotsY, lineLength, miniLine;
	var isLineHighlighted = false, currentHighlightedLine;
	var initted = false;
	var svgCanvas = document.getElementById("svgCanvas");
	var animationQueue = 0;
	var animationGroup = 0;
	var lines = [[[[]]]];
	var squares = [[]];
	var svgPoint = svgCanvas.createSVGPoint();  
	
	
	
	//Constants
	var dotRadiusDefault = 7;
	var dotRadiusSelected = 9;
	var radiusGrowTime = 0.3;
	var lineAnimationDur = 0.5;
	var squareAnimationDur = 0.5;
	var colours = [ "red", "blue" ];
	var explodeDuration = 1;
	var newGameFadeInTime = 0.5;
	var modalBoxDuration = 0.5;
	//end constants
	
	miniLine = createShape("line");
	miniLine.setAttribute("stroke", "rgb(0,0,0)");
	miniLine.setAttribute("stroke-width", "4");
	miniLine.setAttribute("visibility", "hidden");
	svgCanvas.appendChild(miniLine);
	
	function createShape(type) {
		return document.createElementNS(svgCanvas.namespaceURI, type);
	}
	
	function sprintf( format )
	{
	  for( var i=1; i < arguments.length; i++ ) {
	    format = format.replace( /%s/, arguments[i] );
	  }
	  return format;
	}
	
	function getDistance( pos1, pos2 ) {
		return Math.pow( Math.pow( pos1.x - pos2.x, 2 ) + Math.pow(pos1.y - pos2.y, 2), 0.5 );
	}
	
	function touchMove( event ) {
		var touches = event.touches;
		if( touches.length !== 1 )
			return;
		event.preventDefault();
		var touch = touches[0];
		var mPos =  getmPosFromEvent( touch);
		moveCursor( mPos);
	}
	
	function touchStart( event ) {
		touchMove( event );
	}
	
	function getmPosFromEvent( event ) {
		svgPoint.x = event.clientX;
    	svgPoint.y = event.clientY;

    	// The cursor point, translated into svg coordinates
    	var mPos =  svgPoint.matrixTransform(svgCanvas.getScreenCTM().inverse());
    	return mPos;
	}
	
	function mouseMove(event) {	    
    	var mPos =  getmPosFromEvent( event);
	    
		moveCursor( mPos );
	}
	
	function moveCursor( mPos ) {
		function getDistanceFromCursor(shape) {
	        return getDistance( mPos, {x : shape.getAttribute("cx"), y : shape.getAttribute("cy")});
	    }
		
	    //dumb routine to find nearest two squares
	    var Min1 = {val: Number.MAX_VALUE, elem: 0, index : [0,0]};
	    var Min2 = {val: Number.MAX_VALUE, elem: 0, index : [0,0]};
	    for (var i = 0; i < dotNodes.length; i++) {
	    	for (var j = 0; j < dotNodes[i].length; j++) {
	        	var candidate = dotNodes[i][j];
	            var distance = getDistanceFromCursor( candidate);
	        	if( distance < Min1.val ) {
	        		Min2.val = Min1.val;
	        		Min2.elem = Min1.elem;
	        		Min2.index = Min1.index;
	        		
	        		Min1.val = distance;
	        		Min1.elem = candidate;
	        		Min1.index = [ i, j];
	    		}
	    		else if (distance < Min2.val ) {
	    			Min2.val = distance;
	    			Min2.elem = candidate;
	    			Min2.index = [ i,j];
	    		}
	    	}
	    }
	    
	    //Keep ordering so dashes don't screw up
	    if( Min1.index[ 0 ] * dotNodes.length + Min1.index[ 1 ] < Min2.index[ 0 ] * dotNodes.length + Min2.index[ 1 ] ) {
	    	var temp = Min1;
	    	Min1 = Min2;
	    	Min2 = temp;
	    }
	    
	    if( !manager.isLegal( Min1.index[0], Min1.index[1], Min2.index[0], Min2.index[1])){
	    	unHighlight();
	    	return;
	    }
	    
	    
	    var newHighlighted = [ { x : Min1.index[0], y : Min1.index[1]}, { x : Min2.index[0], y : Min2.index[1]} ];
	    if( !isLineHighlighted ||
	    		newHighlighted[0].x != currentHighlightedLine[0].x || 
	    		newHighlighted[0].y != currentHighlightedLine[0].y ||
	    		newHighlighted[1].x != currentHighlightedLine[1].x ||
	    		newHighlighted[1].y != currentHighlightedLine[1].y
	    ) {
		    miniLine.setAttribute("x1", Min1.elem.getAttribute("cx"));
		    miniLine.setAttribute("y1", Min1.elem.getAttribute("cy"));
		    miniLine.setAttribute("x2", Min2.elem.getAttribute("cx"));
		    miniLine.setAttribute("y2", Min2.elem.getAttribute("cy"));
		    
		    if( isLineHighlighted ) {
		    	var oldDot1 = dotNodes[currentHighlightedLine[0].x][currentHighlightedLine[0].y];
			    var oldDot2 = dotNodes[currentHighlightedLine[1].x][currentHighlightedLine[1].y];
			    if( oldDot1 != Min1.elem && oldDot1 != Min2.elem) {
			    	addAnimation( oldDot1, "r", radiusGrowTime, dotRadiusDefault );
			    }
			    if( oldDot2 != Min1.elem && oldDot2 != Min2.elem) {
			    	addAnimation( oldDot2, "r", radiusGrowTime, dotRadiusDefault );
			    }
		    		
		    }
		    
		    
		    addAnimation( Min1.elem, "r", radiusGrowTime, dotRadiusSelected );
		    addAnimation( Min2.elem, "r", radiusGrowTime, dotRadiusSelected );
		    isLineHighlighted = true;
		    
		    currentHighlightedLine = newHighlighted;
	    }
	    
	    miniLine.setAttribute("visibility", "visible");
	}
	
	function animationsAreOn() {
		return document.getElementById("showAnimations").checked;
	}
	
	function addAnimation( node, attributeName, duration, to, addToQueue ) {
		 var from, i;
		 var animate = createShape("animate");
		 
		 if( !animationsAreOn() ) {
		 	//SVG animation not supported, just set the attribute and finish
		 	node.setAttribute( attributeName, to);
		 	return;
		 }
		 
		 animate.setAttribute( "dur", duration);
		 animate.setAttribute( "attributeName", attributeName);
		 
		 var animValue = node[attributeName];
		 if( animValue !== undefined && animValue.animVal.value !== undefined)
		 	from = animValue.animVal.value;
		 else
		 	from = node.getAttribute(attributeName);
		 	
		 animate.setAttribute( "from", from);
		 animate.setAttribute( "to", to);
		 animate.setAttribute( "fill", "freeze");
		 
		 function getId( inAnimateGroup ) {
		 	return "animateIdQ" + animationQueue + "no" + inAnimateGroup;
		 }
		 
		 function animationHasExpired( id ) {
		 	var animateElement = document.getElementById(id);
		 	if( !animateElement )
		 		return true;
			try {
				return animateElement.getStartTime() + animateElement.getSimpleDuration() < animateElement.getCurrentTime();
			} catch( e) {
				if( e.name === "InvalidStateError" && e.code === 11 )
					return true;
				else
					throw e;
			}
		 }
		 
		 if( !addToQueue ||
		 	animationHasExpired( getId( animationGroup - 1 ) ) 
		 ) {
		 	animate.setAttribute( "begin", "indefinite");
		 	node.appendChild(animate);
		 	animate.beginElement();
		 } 
		 else {
		 	animate.setAttribute( "begin", getId( animationGroup -1) + ".end");
		 	node.appendChild(animate);
		 }
		 
		  if( addToQueue &&
		  	!document.getElementById( getId( animationGroup)  )
		  )
		 		animate.setAttribute( "id", getId( animationGroup) );	 
	}
	
	function unHighlight() {
		if( isLineHighlighted ) {
		    var dot1 = dotNodes[currentHighlightedLine[0].x][currentHighlightedLine[0].y];
		    var dot2 = dotNodes[currentHighlightedLine[1].x][currentHighlightedLine[1].y]; 
		    addAnimation(
		    		dot1, 
		    		"r", 
		    		radiusGrowTime, 
		    		dotRadiusDefault
		    );
		    addAnimation(
		    		dot2, 
		    		"r", 
		    		radiusGrowTime, 
		    		dotRadiusDefault
		    );
		    
		    isLineHighlighted = false;
		    miniLine.setAttribute("visibility", "hidden");
		}
	}
	
	function checkHighlight() {
		if( isLineHighlighted )
			if( !manager.isLegal( 
				currentHighlightedLine[0].x, 
	    		currentHighlightedLine[0].y,
	    		currentHighlightedLine[1].x,
	    		currentHighlightedLine[1].y
			) )
				unHighlight();
	}
	
	function getExplodeVelocity( explosionCentre, x1, y1, x2, y2 ) {
		//Some physics! Let's assume there is an explosion starting from
		//say the middle of the screen
			
		//Work force perpendicular to line for each point
		var parToLine = new Vector( [x2-x1,y2-y1]);
		var perpToLine = new Vector([parToLine.items[1], -parToLine.items[0]]);
		parToLine = parToLine.multiplyScalar(1/parToLine.norm());
		perpToLine = perpToLine.multiplyScalar(1/perpToLine.norm());
		var getForce = function ( point ) {
			var diff = point.subtract( explosionCentre);
			if( diff.norm() === 0 ) {
				return {perp : 0, par : 0 };
			}
			//Each end gets hit directly away from explosion by 1/distance
			var netForce = 60000 / Math.max( diff.norm(), 5 );
			
			var forceDirection = diff.multiplyScalar( 1/diff.norm());
			var forceParDirection = forceDirection.multiply(parToLine).sum() * netForce;
			var forcePerpDirection = forceDirection.multiply(perpToLine).sum() * netForce;
			return { perp : forcePerpDirection, par : forceParDirection};
		};
			
		var dot1Force = getForce( new Vector( [ x1, y1]));
		var dot2Force = getForce( new Vector( [ x2, y2]));
		
		var netSpeedPar = (dot1Force.par + dot2Force.par)/2;
		var netSpeedPerp = (dot1Force.perp + dot2Force.perp)/2;
		
		return {
			x : parToLine.items[0] * netSpeedPar + perpToLine.items[0] * netSpeedPerp,
			y :  parToLine.items[1] * netSpeedPar + perpToLine.items[1] * netSpeedPerp,
			rotation : dot1Force.perp - dot2Force.perp
		};
	}
	
	function addRotation( node, x, y, toX, toY, speed ) {
		var animateRotate = createShape( "animateTransform");
		if( !animationsAreOn() )
			return;
			
		animateRotate.setAttribute( "attributeName", "transform");
		animateRotate.setAttribute( "type", "rotate");
		animateRotate.setAttribute( "dur", explodeDuration);
		animateRotate.setAttribute( "from", "0 " + x + " " + y);
		animateRotate.setAttribute( "to", speed + " " + toX + " " + toY );
		
		animateRotate.setAttribute( "begin", "indefinite");
		node.appendChild(animateRotate);
		animateRotate.beginElement();
	}
	
	function explodeAway() {
		var i;
		miniLine.setAttribute( "visible", "hidden");
		var lines = svgCanvas.getElementsByTagName("line");
		var velocity;
		var explosionCentre = new Vector([numDotsX, numDotsY]).multiplyScalar(lineLength/2.3);
		var objectsToKill = [];
		for( i = 0; i < lines.length; i++ ) {
			var line = lines[ i ];
			
			if( line === miniLine )
				continue;
			objectsToKill.push( line );
			var x1 = line.x1.animVal.value;
			var x2 = line.x2.animVal.value;
			var y1 = line.y1.animVal.value;
			var y2 = line.y2.animVal.value;
			velocity = getExplodeVelocity( explosionCentre, x1, y1, x2, y2 );			
			
			var tox1 = x1 + velocity.x;
			var tox2 = x2 + velocity.x;
			var toy1 = y1 + velocity.y;
			var toy2 = y2 + velocity.y;
			
			addAnimation(line, "x1", explodeDuration, tox1);
			addAnimation(line, "x2", explodeDuration, tox2);
			addAnimation(line, "y1", explodeDuration, toy1);
			addAnimation(line, "y2", explodeDuration, toy2);
			//addAnimation(line, "opacity", 10, 0);	//just in case it doesn't go far enough away
			
			//parForces dissapate but perpForces cause rotation
			var rotationForce = velocity.rotation;
			addRotation( line, (x1 + x2)/2, (y1 + y2)/2, ( tox1 + tox2)/2, (toy1 + toy2)/2, rotationForce );
		}
		
		var boxes = svgCanvas.getElementsByTagName("text");
		for( i = 0; i < boxes.length; i++ ) {
			var box = boxes[i];
			objectsToKill.push( box);
			
			var x = +box.getAttribute("x");
			var y = +box.getAttribute("y");
			var textWidth = lineLength * 2 / 3;
			var textHeight = lineLength / 3;
			var velocity1 = getExplodeVelocity( 
				explosionCentre, 
				x + textWidth / 2, 
				y + textHeight / 2, 
				x - textWidth /2, 
				y - textHeight / 2
			);			
			var velocity2 = getExplodeVelocity( 
				explosionCentre, 
				x + textWidth / 2, 
				y - textHeight / 2, 
				x - textWidth /2, 
				y + textHeight / 2
			);
			
			velocity = {
				x : ( velocity1.x + velocity2.x ) / 2,
				y : ( velocity1.y + velocity2.y ) / 2,
				rotation : ( velocity1.rotation + velocity2.rotation ) / 2
			};
			
			var speed = velocity.x * velocity.x + velocity.y * velocity.y;
			var factor = Math.max( 10000, speed ) / speed;
			velocity.x *= factor;
			velocity.y *= factor;
			
			var toX = x + velocity.x;
			var toY = y + velocity.y;
			
			addAnimation( box, "x", explodeDuration, toX );
			addAnimation( box, "y", explodeDuration, toY );
			
			addRotation( box, x, y, toX, toY, velocity.rotation );
		}
		
		setTimeout( function() {
			for( i = 0; i < objectsToKill.length; i++ )
				if( objectsToKill[i].parentNode !== null)
					svgCanvas.removeChild( objectsToKill[i]);
				
		}, explodeDuration * 1000 );
	}
	
	function mouseClick(event) {
		if( isLineHighlighted) {
			gtag('event', 'Play', {
				'event_category': 'Games',
				'event_label': 'Dots And Boxes'
			  });
			
			var freeTurn = false;
			if( document.getElementById( "freeTurns").checked ) {
	    		if( event.ctrlKey) 
	    			freeTurn = true;
	    		if( event.ctrlKey && event.altKey )
	    			freeTurn = 2;
			}
			
			manager.doMove( 
				currentHighlightedLine[0].x, 
				currentHighlightedLine[0].y,
				currentHighlightedLine[1].x, 
				currentHighlightedLine[1].y,
				freeTurn
			);
		}
	}
	
	var blinkIdCounter = 0;
	function getNextBlinkId() {
		return "Blinker" + blinkIdCounter++;
	}
	
	function showInternals() {
		var display = "block";
		if( !document.getElementById("showInternals").checked )
			display = "none";

		document.getElementById( "internalStats").style.display = display;
		var heHints = document.getElementsByClassName("heHint");
		for( var i = 0; i < heHints.length; i++ ) {
			heHints[i].style.display = display;
		}
	}
	
	var onTopZIndex = svgCanvas.style.zIndex + 1;
	function showSettings() {
		var form = document.getElementById( this.getAttribute("data-screenName"));
		if( form.style.display === "block" ) {
			form.style.display = "none";
			this.style["border-color"] = "white";
		}
		else {
			form.style.display = "block";
			this.style["border-color"] = "black";
			if( this.getAttribute( "data-screenName") === "highScores" ) {
				var boardSizeString = Math.min( numDotsX-1, numDotsY-1) + "x" + Math.max( numDotsX-1, numDotsY-1);
				document.getElementById( "highScoreBoardSize" ).value = boardSizeString;
				updateHighScores();
			}
					
		}	
			
		form.style.zIndex = onTopZIndex++; 
	}
	
	function updateHighScores() {
		document.getElementById("highScoresInfo").style.display = "none";
		document.getElementById("highScoresLoading").style.display = "block";
		var xhr = new XMLHttpRequest();
			xhr.onreadystatechange=function()
  			{
  				if (xhr.readyState==4 && xhr.status==200)
				{
					var highScores = JSON.parse( xhr.responseText );
					document.getElementById( "highScoreAverageScore").innerHTML = ( +highScores.Stats.AverageScore).toFixed(1);
					document.getElementById( "highScorePercentageWon").innerHTML = ( 100 - 100 * +highScores.Stats.PercentageWon).toFixed(1);
					document.getElementById( "highScoreGamesPlayed").innerHTML = +highScores.Stats.NumGames;
					document.getElementById("highScoresInfo").style.display = "block";
					document.getElementById("highScoresLoading").style.display = "none";
					
					var tbody = document.getElementById("highScoresTBody");
					tbody.innerHTML = "";
					var lastRank = 0;
					for( var iRow = 0; iRow < highScores.Table.length; iRow++){
						var row = highScores.Table[iRow];
						if( row.Name === null || row.Name === "" )
							row.Name = "Anonymous";
						if( row.Comment === null)
							row.Comment = "";
						var isMine = ( row.UserId == localStorage.userId);
						if( !isMine && row.Name == "Anonymous" && iRow > 5 )
							continue;
						if( isMine && row.Name == "Anonymous" )
							row.Name = "Anonymous (You)";
						row.Result = row.HumanScore + " - " + row.ComputerScore;
						var time = new Date( +row.UnixTime  *1000 );
						var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
						row.Time = time.getDate().toString() + months[ time.getMonth() ] + ( time.getFullYear() % 100 ) + " " + 
						time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds();
						var trNode = document.createElement("tr");
						var cols = [ "Rank", "NetScore", "Name", "Time", "Result", "Duration", "BoardSize", "Comment" ]; 
						for( var iCol = 0; iCol < cols.length; iCol++ ) {
							var tdNode = document.createElement("td");
							tdNode.appendChild(document.createTextNode(row[cols[iCol]]));
							trNode.appendChild( tdNode);	
						}
						if( isMine)
							trNode.style.fontWeight = "Bold";
						tbody.appendChild(trNode);						
					}
				}
  			};
			xhr.open("POST","dotsAndBoxesHighScores.php",true);
			xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
			xhr.send( JSON.stringify(
				{
					BoardSizeString : document.getElementById( "highScoreBoardSize" ).value,
					SessionId : localStorage.sessionId,
					UserId : localStorage.userId,
				}
			));
	}
	
	function showSettingsMouseEnter( ) {
		var form = document.getElementById( this.getAttribute("data-screenName"));
		this.style.opacity = form.style.display === "none" ? 1 : 0.5;
	}
	
	function showSettingsMouseLeave() {
		var form = document.getElementById( this.getAttribute("data-screenName"));
		this.style.opacity = form.style.display === "none" ? 0.5 : 1;
	}
	
	function newGame( reason) {
		manager.newGame(reason);
		var form = document.getElementById( "settingsForm");
		form.style.display = "none";
	}
	
	function newGameButtonPressed() {
		gtag('event', 'New Game', {
			'event_category': 'Games',
			'event_label': 'Dots And Boxes'
		  });
		newGame( "newgamebuttonpressed");
	}
	
	function setSvgProgressBar( ratio ) {
		//var moves between 60 and 452
		var end = 51 + ( 461 - 60 ) * ratio;
		var d = "M461,233.5v45H" + end + "v-45H452 M462,213.5H50v85h412V213.5z";
		
		document.getElementById( "progressLine").setAttribute( "d", d );
	}
	
	function playerWinsText( playerName ) {
		if( playerName === "Me" )
			return "I win";
		else if( playerName === "You" )
			return "You win";
		else
			return 	playerName + " wins";
	}
	
	function getPlayersAreComputer() {
		return [
			document.getElementById("player1IsComputer").checked,
			document.getElementById("player2IsComputer").checked
		];
	}
	
	function nameChange() {
		var player1Name, player2Name;
		var isComputer = getPlayersAreComputer();
		if( !isComputer[0] && isComputer[1] ) {
			player1Name = "You";
			player2Name = "Me";
		}
		else if( isComputer[0] && !isComputer[1] ) {
			player1Name = "Me";
			player2Name = "You";
		}
		else if( isComputer[0] && isComputer[1] ) {
			player1Name = "Red";
			player2Name = "Blue";
		}
		else {
			player1Name = "Red";
			player2Name = "Blue";
		}
		
		document.getElementById("player1Name").value = player1Name;
		document.getElementById("player2Name").value = player2Name;			 
		manager.newGame( "changesettings");
	}
	
	function closeButtonClick() {
		var mainButton = document.getElementById( this.getAttribute("data-screenName"));
		mainButton.click();
	}

	function init() {
		if( initted )
			return;
		initted = true;
		svgCanvas.addEventListener("mousemove", mouseMove, true);
		svgCanvas.addEventListener("mouseout", unHighlight );
		svgCanvas.addEventListener("click", mouseClick );
		svgCanvas.addEventListener("touchmove", touchMove );
		svgCanvas.addEventListener("touchstart", touchStart );
		svgCanvas.addEventListener("touchend", mouseClick );
		
		document.getElementById("showInternals").addEventListener( "click", showInternals );
		document.getElementById("settingsButton").addEventListener( "click", showSettings );
		//document.getElementById("settingsButton").addEventListener( "mouseover", showSettingsMouseEnter );
		//document.getElementById("settingsButton").addEventListener( "mouseout", showSettingsMouseLeave );
		document.getElementById("helpButton").addEventListener( "click", showSettings );
		//document.getElementById("helpButton").addEventListener( "mouseover", showSettingsMouseEnter );
		//document.getElementById("helpButton").addEventListener( "mouseout", showSettingsMouseLeave );
		document.getElementById("highScoresButton").addEventListener( "click", showSettings );
		//document.getElementById("highScoresButton").addEventListener( "mouseover", showSettingsMouseEnter );
		//document.getElementById("highScoresButton").addEventListener( "mouseout", showSettingsMouseLeave );
		document.getElementById("closeHelpButton").addEventListener( "click", closeButtonClick );
		document.getElementById("closeSettingsButton").addEventListener( "click", closeButtonClick );
		document.getElementById("closeHighScoresButton").addEventListener( "click", closeButtonClick );
		document.getElementById("newGameShortCutButton").addEventListener( "click", newGameButtonPressed );
		document.getElementById("progressBox").addEventListener( "click", manager.playNow );
		document.getElementById("player1IsComputer").addEventListener( "change", nameChange );
		document.getElementById("player2IsComputer").addEventListener( "change", nameChange );
		document.getElementById("highScoreBoardSize").addEventListener("change", updateHighScores);
		
		//Need to set up styles as css computed styles don't appear in style list
		document.getElementById( "settingsForm").style.display="none";
		document.getElementById( "helpScreen").style.display="none";
		
		if( createShape( "animate").beginElement === undefined ) {
			var animationsCheckBox = document.getElementById("showAnimations");
			animationsCheckBox.checked = false;
			animationsCheckBox.setAttribute( "disabled", true );
			document.getElementById("showAnimationsLabel").style.color="grey";
		}
	}
	
	var svgHeightTimer;
	var lineAnimationCounter = 0;
	return {
		drawNewGame : function (inNumDotsX, inNumDotsY) {
			init();
			var i, j;
			unHighlight();
			explodeAway();
			

			if( numDotsX != inNumDotsX || numDotsY != inNumDotsY ) {
				for( i = 0; i < dotNodes.length; i++ )
					for( j = 0; j < dotNodes[i].length; j++ ) {
						addAnimation( dotNodes[i][j], "r", newGameFadeInTime,  0);
					}
						
				numDotsX = inNumDotsX;
				numDotsY = inNumDotsY;
				
				var boundingRect = svgCanvas.getBoundingClientRect();
				lineLength = (boundingRect.right - boundingRect.left) / (numDotsX);
				lineLength = 500 / Math.max(numDotsX - .5, numDotsY -.5);
				miniLine.setAttribute("stroke-dasharray", sprintf( "%s %s", lineLength /10, lineLength /10));
				
				var offsetX = ( 500 - ( lineLength * (numDotsX-.5)) ) / 2;
				var offsetY = ( 500 - ( lineLength * (numDotsY-.5)) ) / 2;
				
				/*
				if( svgHeightTimer !== undefined) {
					window.clearInterval( svgHeightTimer);
				}
				if( (boundingRect.bottom - boundingRect.top) < lineLength * numDotsY )
					svgCanvas.setAttribute("height", lineLength * numDotsY);
				else 
					svgHeightTimer = setTimeout( function() {
						svgCanvas.setAttribute("height", lineLength * numDotsY);
					}, newGameFadeInTime * 1000 );
				*/

				dotNodes = [];
				for (i = 0; i < numDotsX; i++) {
					dotNodes.push([]);
					for (j = 0; j < numDotsY; j++) {
						var dot = createShape("circle");
						dot.setAttribute("cx", (i +.25) * lineLength + offsetX);
						dot.setAttribute("cy", (j +.25) * lineLength + offsetY);
						dot.setAttribute("fill", "black");
						svgCanvas.appendChild(dot);
						addAnimation( dot, "r", newGameFadeInTime, dotRadiusDefault );
						dotNodes[i].push(dot);
					}
				}	
			}
			this.setIsThinking( false );	
		},
		
		drawLine : function ( x1, y1, x2, y2, who ) {
			 checkHighlight();

			 var line = createShape("line");
			 line.setAttribute("stroke", colours[who]);
			 line.setAttribute("stroke-width", "4");
			 line.setAttribute("visibility", "visible");
			 line.setAttribute("x1", dotNodes[x1][y1].getAttribute("cx"));
			 line.setAttribute("y1", dotNodes[x1][y1].getAttribute("cy"));
			 line.setAttribute("x2", dotNodes[x1][y1].getAttribute("cx"));
			 line.setAttribute("y2", dotNodes[x1][y1].getAttribute("cy"));
			 svgCanvas.insertBefore(line, svgCanvas.firstChild);
			 
			addAnimation(
					 line, 
					 "x2", 
					 lineAnimationDur,  
					 dotNodes[x2][y2].getAttribute("cx"),
					 true
			 );
			 addAnimation(
					 line, 
					 "y2", 
					 lineAnimationDur,  
					 dotNodes[x2][y2].getAttribute("cy"),
					 true
			 );
			 if( lines[x1] === undefined )
			 	lines[x1] = [];
			 if( lines[x1][y1] === undefined )
			 	lines[x1][y1] = [];
			 if( lines[x1][y1][x2] === undefined )
			 	lines[x1][y1][x2] = [];
			 lines[x1][y1][x2][y2] = line;
		},
		
		unDrawLine : function ( x1, y1, x2, y2, who ) {
			var line;
			if( lines[x1] === undefined ||
				 lines[x1][y1] === undefined ||
				 lines[x1][y1][x2] === undefined ||
				 lines[x1][y1][x2][y2] === undefined
			)
				line = lines[x2][y2][x1][y1];
			else
				line = lines[x1][y1][x2][y2];
			 
			addAnimation(
					 line, 
					 "x2", 
					 lineAnimationDur,  
					 line.getAttribute("x1"),
					 true
			 );
			 addAnimation(
					 line, 
					 "y2", 
					 lineAnimationDur,  
					 line.getAttribute("y1"),
					 true
			 );
		},
		
		drawSquare : function( x, y, who, name, otherName ) {
			checkHighlight();
			
			var text = createShape( "text");
			text.setAttribute( "font-size", 0);
			text.style["font-size"]=0.1; //setting to zero seems to screw up ie
			var rawTextNode = document.createTextNode( name);
			text.appendChild( rawTextNode );
			text.setAttribute("x", (x+1) * lineLength );
			text.setAttribute("y", (y+1) * lineLength );
			
			var xCoord = ( +dotNodes[x][y].getAttribute( "cx" ) + +dotNodes[x+1][y].getAttribute( "cx") ) / 2;
			var yCoord = ( +dotNodes[x][y].getAttribute( "cy" ) + +dotNodes[x][y+1].getAttribute( "cy") ) / 2;
			text.setAttribute("x", xCoord );
			text.setAttribute("y", yCoord );
			
			
			text.setAttribute( "fill", colours[who]);
			text.setAttribute( "text-anchor", "middle");
			text.setAttribute( "dominant-baseline", "middle");
			svgCanvas.appendChild( text );
			addAnimation( text, "font-size", squareAnimationDur, lineLength / Math.max( name.length, otherName.length), true );
			if( squares[x]=== undefined)
				squares[x] = [];
			squares[x][y] = text;
		},
		
		unDrawSquare : function( x, y ) {
			var square = squares[x][y];
			addAnimation( square, "font-size", squareAnimationDur, 0, true );
		},
		
		newAnimationQueue : function() {
			animationQueue++;
			animationGroup = 0;
		},
		
		newAnimationGroup : function() {
			animationGroup++;
		},
		
		setNumDotsX : function( value) {
			var node = document.getElementById("numDotsX");
			if( value !== undefined )
				node.value = value;
			return +node.value;
		},
		
		setNumDotsY : function( value) {
			var node = document.getElementById("numDotsY");
			if( value !== undefined )
				node.value = value;
			return +node.value;
		},
		
		setGameCode : function( value ) {
			var node = document.getElementById("gameCode"); 
			if( value !== undefined )
				node.value = value;
			return node.value;
		},
		
		removeHint : function() {
			 if( svgCanvas.getElementById( "hintLine" ) )
			 	svgCanvas.removeChild( svgCanvas.getElementById( "hintLine" ) );			
		},
		
		showHint : function ( x1, y1, x2, y2, who ) {
			 checkHighlight();
			 
			 if( svgCanvas.getElementById( "hintLine" ) )
			 	svgCanvas.removeChild( svgCanvas.getElementById( "hintLine" ) );

			 var line = createShape("line");
			 line.setAttribute("visibility", "hidden");
			 line.setAttribute("stroke", colours[who]);
			 line.setAttribute("stroke-width", "1");
			 line.setAttribute("x1", dotNodes[x1][y1].getAttribute("cx"));
			 line.setAttribute("y1", dotNodes[x1][y1].getAttribute("cy"));
			 line.setAttribute("x2", dotNodes[x2][y2].getAttribute("cx"));
			 line.setAttribute("y2", dotNodes[x2][y2].getAttribute("cy"));
			 line.setAttribute("opacity", 0);
			 line.setAttribute( "id", "hintLine" );
			 svgCanvas.insertBefore(line, svgCanvas.firstChild);
			 
			 var durationBlinks = "1s";
			 
			 var set = createShape("animate");
			 if( !animationsAreOn() ){
			 	line.setAttribute( "opacity", 1);
			 }
			 else {
			 	line.appendChild( set);
			 	set.setAttribute( "attributeName", "opacity");
			 	set.setAttribute( "begin", "indefinite");
			 	set.setAttribute( "dur",  durationBlinks);
			 	set.setAttribute( "values", "0;1;0");
			 	set.setAttribute( "repeatCount", "indefinite");
			 	set.beginElement();	
			 }
			 line.setAttribute("visibility", "visible");
			 
		},
		
		removeHe : function() {
			var oldHints = svgCanvas.getElementsByClassName("heHint");
			for(var i = oldHints.length - 1; i >= 0; i--)
    			svgCanvas.removeChild( oldHints[i]);	
		},
		
		showHe : function( x1, y1, x2, y2, dir, heNumber) {
			var text = createShape( "text");
			var shift = 0.25;
			if( dir === "up")
				y1 -= shift;
			else if( dir === "down")
				y1 += shift;
			else if( dir === "left")
				x1 -= shift;
			else if( dir === "right")
				x1 += shift;
			else
				throw "unknown dir";
			text.setAttribute( "font-size", 10);
			text.setAttribute( "font-family", "Rockwell");
			text.appendChild( document.createTextNode( heNumber) );
			text.setAttribute("x", (x1 + x2 + 1) * lineLength  / 2);
			text.setAttribute("y", (y1 + y2 + 1 ) * lineLength / 2);
			text.setAttribute( "fill", "black");
			text.setAttribute( "text-anchor", "middle");
			text.setAttribute( "dominant-baseline", "middle");
			text.setAttribute( "class", "heHint");
			svgCanvas.appendChild( text );
			showInternals();
		},
		
		setStats : function( depth, searchDuration, bestScore, stats ) {
			function setValue( id, text ) {
				document.getElementById(id).innerHTML = text;
			}
			setValue( "searchDepthAchieved", depth);
			setValue( "bestScore", bestScore);
			setValue( "numNodesVisited", stats.numNodesVisited);
			setValue( "numLeavesVisited", stats.numLeavesVisited);
			setValue( "microsPerNode", (1000 * searchDuration / stats.numNodesVisited) | 0);
		},
		
		getThinkTime : function() {
			return document.getElementById("thinkTime").value;
		},
		
		getPlayerNames : function() {
			return [
				document.getElementById("player1Name").value,
				document.getElementById("player2Name").value
			];
		},
		
	    getPlayersAreComputer : getPlayersAreComputer,
	    
	    getWhoMovesFirst : function() {
	    	return document.getElementById("player1PlaysFirst").checked ? 0 : 1;
	    },
		
		setScores : function( scoresOnTheDoors, playerNames, whoUpdated ) {			
			var player1Node = document.getElementById("player1Score");
			player1Node.style.color = colours[0];
			player1Node.innerHTML = playerNames[0] + ": " + scoresOnTheDoors[0];
			var player2Node = document.getElementById("player2Score");
			player2Node.style.color = colours[1];
			player2Node.innerHTML = playerNames[1] + ": " + scoresOnTheDoors[1];
		},
		
		showEndScore : function( playerNames, scoresOnTheDoors ) {
			var el = document.getElementById("modalBox");
			
			if( localStorage.finishedGame === undefined ) {
				localStorage.finishedGame = true;
				document.getElementById( "socialEndGame").style.display = "none";
			}
			else {
				document.getElementById( "socialEndGame").style.display = "block";
			}
			
			var player1Node = document.getElementById("player1FinalScore");
			player1Node.style.color = colours[0];
			player1Node.innerHTML = playerNames[0] + ": " + scoresOnTheDoors[0];
			var player2Node = document.getElementById("player2FinalScore");
			player2Node.style.color = colours[1];
			player2Node.innerHTML = playerNames[1] + ": " + scoresOnTheDoors[1];
			var finalScoresNode = document.getElementById( "finalWinner");
			if( scoresOnTheDoors[0] === scoresOnTheDoors[1]) {
				finalScoresNode.innerHTML = "It's a draw";
				finalScoresNode.style.color = "green";
			} else if( scoresOnTheDoors[0] > scoresOnTheDoors[1]) {
				finalScoresNode.innerHTML = playerWinsText( playerNames[0] ); 
				finalScoresNode.style.color = colours[0];
			} else {
				finalScoresNode.innerHTML = playerWinsText( playerNames[1] );
				finalScoresNode.style.color = colours[1];
			}
			player1Node.style.fontSize = "30px";
			player2Node.style.fontSize = "30px";
			finalScoresNode.style.fontSize = "80px";
				
			
			el.style.opacity = 0;
			el.style.visibility = "visible";
			setTimeout( function(){
				el.style["transition-property"] = "opacity";
	  			el.style["transition-duration" ] = modalBoxDuration + "s";
	  			el.style.opacity = 1;
	  		},	Math.max( lineAnimationDur, squareAnimationDur) *1000 + 300);
			
			var playersAreComputer = getPlayersAreComputer();
			if( playersAreComputer[0] === playersAreComputer[1] ) {
				document.getElementById( "finalScoreForm").style.display = "none";
				return;
			}
			document.getElementById( "finalScoreForm").style.display = "block";
			var computerPlayerIndex = playersAreComputer[0] ? 0 : 1;
			var currentName = this.getPlayerNames()[1-computerPlayerIndex];
			var finalScoreNode = document.getElementById( "finalScoreName");
			if( localStorage.finalScoreName !== undefined )
				finalScoreNode.value = localStorage.finalScoreName;
			document.getElementById("finalScoreComment").value = "";
			finalScoreNode.select();
		},
		
		closeModalDialog : function() {
			var el = document.getElementById("modalBox");
			var finalScoreNameNode = document.getElementById( "finalScoreName");
			localStorage.finalScoreName = finalScoreNameNode.value; 
			manager.gameFinished( document.getElementById( "finalScoreComment").value );
			el.style.opacity = 0;
			setTimeout( function() {
				el.style.visibility = "hidden";
			}, 1000 * modalBoxDuration);
		},
		
		setProgress : function( timeInMillis) {
			document.getElementById( "progressBar").value = timeInMillis;
			var ratio = timeInMillis / this.getThinkTime() / 1000;
			setSvgProgressBar( ratio);
		},
		
		setIsThinking : function( isThinking ) {
			var progressBar = document.getElementById( "progressBar");
			progressBar.max = this.getThinkTime() * 1000;
			progressBar.value = 0;
			document.getElementById( "playNow").disabled = !isThinking;
			setSvgProgressBar( 0 );
			document.getElementById( "progressBox").style.opacity = isThinking ? 1 : 0.2;
		}
	};
} ());
