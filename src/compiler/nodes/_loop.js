var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.condition, 'condition');
    this.loop.forEach(function(stmt) {cb(stmt, 'loop');});
};

exports.substitute = function substitute(cb) {
    this.condition = cb(this.condition, 'condition') || this.condition;
    this.loop = this.loop.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.condition.validateTypes(ctx);
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
