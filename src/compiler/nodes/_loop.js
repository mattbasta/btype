var types = require('../types');

var ident = require('./_utils').ident;


exports.traverse = function traverse(cb) {
    if (this.assignment) cb(this.assignment, 'assignment');
    cb(this.condition, 'condition');
    if (this.iteration) cb(this.iteration, 'iteration');
    this.loop.forEach(function(stmt) {cb(stmt, 'loop');});
};

exports.substitute = function substitute(cb) {
    if (this.assignment) this.assignment = cb(this.assignment, 'assignment') || this.assignment;
    this.condition = cb(this.condition, 'condition') || this.condition;
    if (this.iteration) this.iteration = cb(this.iteration, 'iteration') || this.iteration;
    this.loop = this.loop.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    if (this.assignment) this.assignment.validateTypes(ctx);
    this.condition.validateTypes(ctx);
    if (this.iteration) this.iteration.validateTypes(ctx);
    this.loop.forEach(function(stmt) {stmt.validateTypes(ctx);});
};

exports.getType = function getType(ctx) {
    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);

    var temp;
    if ((temp = ctx.env.registeredOperators[leftType.toString()]) &&
        (temp = temp[rightType.toString()]) &&
        (temp = temp[this.operator])) {

        return ctx.env.registeredOperatorReturns[temp];
    }

    return types.publicTypes.bool;
};
