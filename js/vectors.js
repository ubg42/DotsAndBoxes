/*jshint smarttabs: true */
/*jshint browser: true*/
/*jshint globalstrict: true*/
/* jshint -W099 */

"use strict";

var Vector = function(items) {
    this.items = items;
};


Vector.prototype.doSomethingElementWise = function( other, whatToDo ) {
	var result = [];
    for(var i = 0; i < this.items.length; i++) {
        result.push( whatToDo( this.items[i], other.items[i] ) );
    }

    return new Vector(result);
};

Vector.prototype.doSomethingScalar = function( other, whatToDo ) {
	var result = [];
    for(var i = 0; i < this.items.length; i++) {
        result.push( whatToDo( this.items[i], other ) );
    }

    return new Vector(result);
};

Vector.prototype.reduce = function( initial, whatToDo ) {
	var result = initial;
    for(var i = 0; i < this.items.length; i++) {
        result = whatToDo( result, this.items[i]);
    }

    return result;
};

Vector.prototype.add = function(other) {
	function add ( a, b ) {return( a + b);}
	return this.doSomethingElementWise( other, add );
};
Vector.prototype.subtract = function(other) {
	function add ( a, b ) {return( a - b);}
	return this.doSomethingElementWise( other, add );
};
Vector.prototype.multiply = function(other) {
	function add ( a, b ) {return( a * b);}
	return this.doSomethingElementWise( other, add );
};
Vector.prototype.addScalar = function(other) {
	function add ( a, b ) {return( a + b);}
	return this.doSomethingSclar( other, add );
};

Vector.prototype.multiplyScalar = function(other) {
	function multiply ( a, b ) {return( a * b);}
	return this.doSomethingScalar( other, multiply );
};
Vector.prototype.norm = function() {
	return( Math.pow(this.multiply(this).sum(),0.5));
};
Vector.prototype.sum = function() {
	function add ( a, b ) {return( a + b);}
	return this.reduce( 0, add );
};

