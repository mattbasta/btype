var types = require('../types');

var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.left, 'left');
    cb(this.right, 'right');
    cb(this.returnType, 'returnType');
    this.body.forEach(function(stmt) {
        cb(stmt, 'body');
    });
};

exports.substitute = function substitute(cb) {
    this.left = cb(this.left, 'left') || this.left;
    this.right = cb(this.right, 'right') || this.right;
    this.returnType = cb(this.returnType, 'returnType') || this.returnType;
    this.body = this.body.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
};

exports.getType = function getType(ctx) {
    if (this.__originalType) {
        return this.__originalType;
    }
    var returnType = this.returnType ? this.returnType.getType(ctx) : null;
    return new types.Func(
        returnType,
        [
            this.left.getType(),
            this.right.getType(),
        ]
    );
};

exports.validateTypes = function validateTypes() {
    var context = this.__context;
    this.body.forEach(function(stmt) {
        stmt.validateTypes(context);
    });
};

exports.toString = function toString() {
    return 'Operator(' + this.operator + '): ' + this.returnType.toString() + '\n' +
        '    Left: ' + this.left.toString() + '\n' +
        '    Right: ' + this.right.toString() + '\n' +
        '    Body:\n' +
        indentEach(this.body.map(function(stmt) {return stmt.toString();}).join('\n'), 2);
};

exports.registerWithContext = function registerWithContext(ctx, rootCtx) {
    // Remember the function in the function hierarchy.
    rootCtx.functions.push(this);

    // Mark the function as a variable containing a function type.
    var assignedName = ctx.env.namer();
    rootCtx.functionDeclarations[assignedName] = this;
    rootCtx.isFuncMap[assignedName] = true;
    this.__assignedName = assignedName;
    this.__firstClass = false;

    var newContext = new (require('../context').Context)(ctx.env, this, ctx);
    // Add all the parameters of the nested function to the new scope.
    this.left.__assignedName = newContext.addVar(this.left.name, this.left.getType(ctx));
    this.right.__assignedName = newContext.addVar(this.right.name, this.right.getType(ctx));

};
