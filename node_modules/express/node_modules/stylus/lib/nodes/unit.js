
/*!
 * Stylus - Unit
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node')
  , nodes = require('./');

/**
 * Initialize a new `Unit` with the given `val` and unit `type`
 * such as "px", "pt", "in", etc.
 *
 * @param {String} val
 * @param {String} type
 * @api public
 */

var Unit = module.exports = function Unit(val, type){
  Node.call(this);
  this.val = val;
  this.type = type;
};

/**
 * Inherit from `Node.prototype`.
 */

Unit.prototype.__proto__ = Node.prototype;

/**
 * Return Boolean based on the unit value.
 *
 * @return {Boolean}
 * @api public
 */

Unit.prototype.toBoolean = function(){
  return nodes.Boolean(this.type
      ? true
      : this.val);
};

/**
 * Return unit string.
 *
 * @return {String}
 * @api public
 */

Unit.prototype.toString = function(){
  var n = this.val;
  if ('px' == this.type) n = n.toFixed(0);
  return n + (this.type || '');
};

/**
 * Return a clone of this node.
 * 
 * @return {Node}
 * @api public
 */

Unit.prototype.clone = function(){
  var clone = new Unit(this.val, this.type);
  clone.lineno = this.lineno;
  clone.filename = this.filename;
  return clone;
};

/**
 * Operate on `right` with the given `op`.
 *
 * @param {String} op
 * @param {Node} right
 * @return {Node}
 * @api public
 */

Unit.prototype.operate = function(op, right){
  var type = this.type || right.first.type;

  // swap color
  if ('rgba' == right.nodeName || 'hsla' == right.nodeName) {
    return right.operate(op, this);
  }

  // operate
  if (this.shouldCoerce(op)) {
    right = right.first;
    // percentages
    if (('-' == op || '+' == op) && '%' == right.type) {
      right = new Unit(this.val * (right.val / 100), '%');
    } else {
      right = this.coerce(right);
    }

    switch (op) {
      case '-':
        return new Unit(this.val - right.val, type);
      case '+':                               
        return new Unit(this.val + right.val, type);
      case '/':                               
        return new Unit(this.val / right.val, type);
      case '*':                               
        return new Unit(this.val * right.val, type);
      case '%':
        return new Unit(this.val % right.val, type);
      case '**':
        return new Unit(Math.pow(this.val, right.val), type);
      case '..':
      case '...':
        var start = this.val
          , end = right.val
          , expr = new nodes.Expression
          , inclusive = '..' == op;
        do {
          expr.push(new nodes.Unit(start));
        } while (inclusive ? ++start <= end : ++start < end);
        return expr;
    }
  }

  return Node.prototype.operate.call(this, op, right);
};

/**
 * Coerce `other` unit to the same type as `this` unit.
 *
 * Supports:
 *
 *    mm -> cm | in
 *    cm -> mm | in
 *    in -> mm | cm
 *    
 *    ms -> s
 *    s  -> ms
 *    
 *    Hz  -> kHz
 *    kHz -> Hz
 *
 * @param {Unit} other
 * @return {Unit}
 * @api public
 */

Unit.prototype.coerce = function(other){
  if ('unit' == other.nodeName) {
    var a = this
      , b = other
      , factorA = factor(a)
      , factorB = factor(b);

    if (factorA && factorB && (factorA.label == factorB.label)) {
      var bVal = b.val * (factorB.val / factorA.val);
      return new nodes.Unit(bVal, a.type);
    } else {
      return new nodes.Unit(b.val, a.type);
    }
  } else if ('string' == other.nodeName) {
    var val = parseInt(other.val, 10);
    if (isNaN(val)) Node.prototype.coerce.call(this, other);
    return new nodes.Unit(val);
  } else {
    return Node.prototype.coerce.call(this, other);
  }
};


/**
 *  Convert a unit to base unit
 */
function factor(unit) {
  var factorTable = {
    'mm': {val: 1, label: 'mm'},
    'cm': {val: 10, label: 'mm'},
    'in': {val: 25.4, label: 'mm'},
    'ms': {val: 1, label: 'ms'},
    's': {val: 1000, label: 'ms'},
    'Hz': {val: 1, label: 'Hz'},
    'kHz': {val: 1000, label: 'Hz'}
  };

  return factorTable[unit.type];
};

