var types = require('../../types');


var OP_PREC = {
    '*': 5,
    '/': 5,
    '%': 5,

    '+': 6,
    '-': 6,

    '<<': 7,
    '>>': 7,

    '<': 8,
    '<=': 8,
    '>': 8,
    '>=': 8,

    '==': 9,
    '!=': 9,

    '&': 10,
    '^': 11,
    '|': 12,

    'and': 13,
    'or': 14,
};

function _binop(env, ctx, prec) {
    var left = _node(this.left, env, ctx, OP_PREC[this.operator]);
    var right = _node(this.right, env, ctx, OP_PREC[this.operator]);

    var out;
    var oPrec = OP_PREC[this.operator] || 13;

    switch (this.operator) {
        case 'and':
            out = left + ' && ' + right;
            break;
        case 'or':
            out = left + ' || ' + right;
            break;
        case '*':
            if (this.left.getType(ctx) === types.publicTypes.int &&
                this.right.getType(ctx) === types.publicTypes.int) {

                if (!env.__hasImul) {
                    env.__hasImul = true;
                    env.__globalPrefix += 'var imul = stdlib.Math.imul;\n';
                }
                out = 'imul(' + left + ', ' + right + ')';
                oPrec = 18;
                break;
            }
        default:
            out = left + ' ' + this.operator + ' ' + right;
    }

    return '(' + out + ')';
}

function _node(node, env, ctx, prec) {
    return NODES[node.type].call(node, env, ctx, prec);
}

var NODES = {
    Root: function(env, ctx) {
        env.__globalPrefix = '';
        var output = this.body.map(function(stmt) {
            return _node(stmt, env, ctx, 0);
        }).join('\n');
        output = env.__globalPrefix + output;
        delete env.__globalPrefix;
        delete env.__hasImul;
        return output;
    },
    Unary: function(env, ctx, prec) {
        // Precedence here will always be 4.
        var out = _node(this.base, env, ctx, 4);
        out = this.operator + '(' + out + ')';
        return out;
    },
    LogicalBinop: _binop,
    EqualityBinop: _binop,
    RelativeBinop: _binop,
    Binop: _binop,
    CallStatement: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 0);
    },
    CallRaw: function(env, ctx, prec) {
        return _node(this.callee, env, ctx, 1) + '(/* CallRaw */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, 18);
            }).join(',') +
            ')' +
            (!prec ? ';' : '');
    },
    CallDecl: function(env, ctx, prec) {
        return _node(this.callee, env, ctx, 1) +
            '(/* CallDecl */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, 18);
            }).join(',') +
            ')' +
            (!prec ? ';' : '');
    },
    CallRef: function(env, ctx, prec) {
        // FIXME: This doesn't pass the context because outputting the callee
        // twice can cause unwanted side effects
        return _node(this.callee, env, ctx, 1) +
            '.func(/* CallRef */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, 18);
            }).join(',') +
            ')' +
            (!prec ? ';' : '');
    },
    FunctionReference: function(env, ctx, prec) {
        return '{func:' + _node(this.base, env, ctx, 1) + ',ctx:' + _node(this.ctx, env, ctx) + '}';
    },
    Member: function(env, ctx, prec) {
        var baseType = this.base.getType(ctx);
        if (baseType._type === 'module') {
            return baseType.memberMapping[this.child];
        }

        var base;
        if (baseType._type === '_stdlib') {
            base = 'stdlib.' + baseType.name;
        } else if (baseType._type === '_foreign') {
            env.foreigns.push(this.child);
            return 'foreign.' + this.child;
        } else {
            base = _node(this.base, env, ctx, 1);
        }

        if (baseType._type === '_foreign_curry') {
            return base;
        }

        return base + '.' + this.child;
    },
    Assignment: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 1) + ' = ' + _node(this.value, env, ctx, 1) + ';';
    },
    Declaration: function(env, ctx, prec) {
        return 'var ' + this.__assignedName + ' = ' + _node(this.value, env, ctx, 17) + ';';
    },
    ConstDeclaration: function() {
        return NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, prec) {
        return 'return ' + _node(this.value, env, ctx, 1) + ';';
    },
    Export: function() {return '';},
    Import: function() {return '';},
    For: function(env, ctx, prec) {
        return 'for (' +
            _node(this.assignment, env, ctx, 0) +
            _node(this.condition, env, ctx, 0) + ';' +
            (this.iteration ? _node(this.iteration, env, ctx, 1) : '') +
            ') {' +
            this.loop.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '}';
    },
    DoWhile: function(env, ctx, prec) {
        return 'do {' +
            this.loop.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '} while (' +
            _node(this.condition, env, ctx, 0) +
            ');';
    },
    While: function(env, ctx, prec) {
        return 'while (' +
            _node(this.condition, env, ctx, 0) +
            ') {' +
            this.loop.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '}';
    },
    Switch: function(env, ctx, prec) {
        return 'switch (' +
            _node(this.condition, env, ctx, 0) +
            ') {' +
            this.cases.map(function(_case) {
                return _node(_case, env, ctx, 0);
            }).join('\n') +
            '}';
    },
    Case: function(env, ctx, prec) {
        return 'case ' +
            _node(this.value, env, ctx, 0) +
            ';\n' +
            this.body.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n');
            // TODO: force a break until break is supported?
    },
    If: function(env, ctx, prec) {
        return 'if (' +
            _node(this.condition, env, ctx, 0) +
            ') {' +
            this.consequent.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '}' +
            (this.alternate ? ' else {' + this.alternate.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }) + '}' : '');
    },
    'Function': function(env, ctx, prec) {
        return 'function ' + this.__assignedName + '(' +
            this.params.map(function(param) {
                return _node(param, env, ctx, 1);
            }).join(',') + ') {\n' +
            this.body.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') + '\n}';
    },
    Type: function() {return '';},
    TypedIdentifier: function(env, ctx, prec) {
        return this.__assignedName;
    },
    Literal: function() {
        if (this.value === true) return '1';
        if (this.value === false) return '0';
        return this.value.toString();
    },
    Symbol: function() {
        return this.__refName;
    },
    New: function(env, ctx) {
        return 'new ' + this.getType(ctx).typeName + '()';
    }
};

module.exports = function translate(ctx) {
    return _node(ctx.scope, ctx.env, ctx, 0);
};
