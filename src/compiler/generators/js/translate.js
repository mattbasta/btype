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

function trimSemicolon(inp) {
    inp = inp.trim();
    if (inp[inp.length - 1] === ';') {
        inp = inp.substr(0, inp.length - 1);
    }
    return inp;
}

function _binop(env, ctx, prec) {
    var out;
    var left = _node(this.left, env, ctx, OP_PREC[this.operator]);
    var right = _node(this.right, env, ctx, OP_PREC[this.operator]);

    var leftTypeRaw = this.left.getType(ctx);
    var rightTypeRaw = this.right.getType(ctx);


    if (leftTypeRaw && rightTypeRaw) {
        var leftType = leftTypeRaw.flatTypeName();
        var rightType = rightTypeRaw.flatTypeName();
        if (ctx.env.registeredOperators[leftType] &&
            ctx.env.registeredOperators[leftType][rightType] &&
            ctx.env.registeredOperators[leftType][rightType][this.operator]) {

            var operatorStmtFunc = ctx.env.registeredOperators[leftType][rightType][this.operator];
            return operatorStmtFunc + '(' + left + ',' + right + ')';
        }
    }

    var oPrec = OP_PREC[this.operator] || 13;

    switch (this.operator) {
        case 'and':
            out = left + ' && ' + right;
            break;
        case 'or':
            out = left + ' || ' + right;
            break;
        case '==':
            out = left + ' === ' + right;
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
        case '/':
            if (this.operator === '/' &&
                this.left.getType(ctx) === types.publicTypes.int &&
                this.right.getType(ctx) === types.publicTypes.int) {

                out = '(' + left + ' / ' + right + ' | 0)';
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
        var funcType = this.callee.getType(ctx);

        var paramList = this.params.map(function(param) {
            return _node(param, env, ctx, 18);
        }).join(',');

        var temp;
        if (this.callee.type === 'Member' &&
            (temp = this.callee.base.getType(ctx)).hasMethod &&
            temp.hasMethod(this.callee.child)) {

            return temp.getMethod(this.callee.child) + '(/* CallRef:Method */' +
                _node(this.callee.base, env, ctx, 18) + (paramList ? ', ' : '') + paramList + ')';
        }

        return _node(this.callee, env, ctx, 1) +
            '(/* CallRef */' + paramList + ')' +
            (!prec ? ';' : '');
    },
    FunctionReference: function(env, ctx, prec) {
        if (!this.ctx) {
            // If there is no context, it means it's just a root global or
            // needs no context.
            return _node(this.base, env, ctx, 1);
        }

        var ctx = _node(this.ctx, env, ctx);
        if (ctx === '0') {
            return _node(this.base, env, ctx, 1);
        }
        // TODO: optimize this by adding the function prototype directly
        return '(function($$ctx) {return ' + _node(this.base, env, ctx, 1) + '.apply(null, Array.prototype.slice.call(arguments, 1).concat([$$ctx]))}.bind(null, ' + _node(this.ctx, env, ctx) + '))';
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
            if (env.foreigns.indexOf(this.child) === -1) {
                env.foreigns.push(this.child);
            }
            return 'foreign.' + this.child;
        } else {
            base = _node(this.base, env, ctx, 1);
        }

        if (baseType._type === '_foreign_curry') {
            return base;
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            return baseType.getMethod(this.child) + '.bind(null, ' + _node(this.base, env, ctx, 1) + ')';
        }

        if (baseType._type === 'string' || baseType._type === 'array') {
            switch (this.child) {
                case 'length':
                    return base + '.length';
            }
        }

        return base + '.' + this.child;
    },
    Assignment: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 1) + ' = ' + _node(this.value, env, ctx, 1) + ';';
    },
    Declaration: function(env, ctx, prec) {
        var type = this.value.getType(ctx);
        var output = 'var ' + this.__assignedName + ' = ';

        if (this.value.type === 'Literal') {
            output += (this.value.value || 'null').toString() + ';';
            return output;
        }

        var def;
        if (type && type._type === 'primitive') {
            def = type && (type.typeName === 'float' || type.typeName === 'sfloat') ? '0.0' : '0';
        } else if (type) {
            def = 'null';
        }
        output += def + ';\n';

        output += this.__assignedName + ' = ' + _node(this.value, env, ctx, 17) + ';';
        return output;
    },
    ConstDeclaration: function() {
        return NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, prec) {
        if (!this.value) {
            if (ctx.scope.__objectSpecial === 'constructor') {
                return 'return ' + ctx.scope.params[0].__assignedName + ';';
            }
            return 'return;';
        }
        return 'return ' + _node(this.value, env, ctx, 1) + ';';
    },
    Export: function() {return '';},
    Import: function() {return '';},
    For: function(env, ctx, prec) {
        return 'for (' +
            _node(this.assignment, env, ctx, 0) +
            _node(this.condition, env, ctx, 0) + ';' +
            trimSemicolon(this.iteration ? _node(this.iteration, env, ctx, 1) : '') +
            ') {' +
            this.body.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '}';
    },
    DoWhile: function(env, ctx, prec) {
        return 'do {' +
            this.body.map(function(stmt) {
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
            this.body.map(function(stmt) {
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
            }).join('\n') + '}' : '');
    },
    Function: function(env, ctx, prec) {
        var context = this.__context;
        var output = 'function ' + this.__assignedName + '(' +
            this.params.map(function(param) {
                return _node(param, env, context, 1);
            }).join(',') + ') {\n' +
            this.body.map(function(stmt) {
                return _node(stmt, env, context, 0);
            }).join('\n');

        if (this.__objectSpecial === 'constructor') {
            output += 'return ' + this.params[0].__assignedName + ';';
        }

        output += '\n}';
        return output;
    },
    OperatorStatement: function(env, ctx, prec) {
        return 'function ' + this.__assignedName + '(' +
            _node(this.left, env, ctx, 1) + ', ' +
            _node(this.right, env, ctx, 1) + ') {\n' +
            this.body.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') + '\n}';
    },
    Type: function() {return '';},
    TypedIdentifier: function(env, ctx, prec) {
        return this.__assignedName;
    },
    Literal: function(env) {
        if (this.litType === 'str') {
            return env.getStrLiteralIdentifier(this.value);
        }

        if (this.value === true) return 'true';
        if (this.value === false) return 'false';
        if (this.value === null) return 'null';
        return this.value.toString();
    },
    Symbol: function() {
        return this.__refName;
    },
    New: function(env, ctx) {
        var type = this.getType(ctx);

        // TODO: Consider making this use typed arrays for primitives
        if (type._type === 'array') {
            var arrLength = _node(this.params[0], env, ctx, 1);
            if (type.contentsType._type === 'primitive') {
                switch (type.contentsType.typeName) {
                    case 'float': return 'new Float64Array(' + arrLength + ')';
                    case 'sfloat': return 'new Float32Array(' + arrLength + ')';
                    case 'int': return 'new Int32Array(' + arrLength + ')';
                    case 'uint': return 'new Uint32Array(' + arrLength + ')';
                    case 'byte': return 'new Uint8Array(' + arrLength + ')';
                }
            }
            return 'new Array(' + arrLength + ')';
        }

        var output = 'new ' + type.flatTypeName();

        if (type instanceof types.Struct && type.objConstructor) {
            output += '(' + this.params.map(function(param) {
                return _node(param, env, ctx, 1);
            }).join(', ') + ')';
        } else {
            output += '()';
        }

        return output;
    },

    Break: function() {
        return 'break;';
    },
    Continue: function() {
        return 'continue;';
    },

    ObjectDeclaration: function(env, ctx) {
        if (!this.__isConstructed) return;
        var output = '';

        if (this.objConstructor) {
            output = _node(this.objConstructor, env, ctx, 0) + '\n';
        }

        output += this.methods.map(function(method) {
            return _node(method, env, ctx, 0);
        }).join('\n');

        return output;
    },
    ObjectMember: function() {
        return '';
    },
    ObjectMethod: function(env, ctx, prec) {
        return _node(this.base, env, ctx, prec);
    },
    ObjectConstructor: function(env, ctx, prec) {
        // Constructors are merged with the JS constructor in `typeTranslate`
        // in the JS generate module.
        return '';
    },

    TypeCast: function(env, ctx, prec) {
        var baseType = this.left.getType(ctx);
        var targetType = this.rightType.getType(ctx);

        var base = _node(this.left, env, ctx, 1);
        if (baseType.equals(targetType)) return base;

        switch (baseType.typeName) {
            case 'int':
                switch (targetType.typeName) {
                    case 'uint': return 'int2uint(' + base + ')';
                    case 'float': return '(+(' + base + '))';
                    case 'sfloat': return '(fround(' + base + '))';
                    case 'byte': return base;
                    case 'bool': return '(!!' + base + ')';
                }
            case 'uint':
                switch (targetType.typeName) {
                    case 'int': return 'uint2int(' + base + ')';
                    case 'float': return '(+(' + base + '))';
                    case 'sfloat': return '(fround(' + base + '))';
                    case 'byte': return base;
                    case 'bool': return '(' + base + ' != 0)';
                }
            case 'float':
                switch (targetType.typeName) {
                    case 'sfloat': return '(fround(' + base + '))';
                    case 'uint': return 'float2uint(' + base + ')';
                    case 'int': return '(' + base + '|0)';
                    case 'byte': return '(' + base + '|0)';
                    case 'bool': return '(!!' + base + ')';
                }
            case 'sfloat':
                switch (targetType.typeName) {
                    case 'float': return '(+(' + base + '))';
                    case 'uint': return 'float2uint(' + base + ')';
                    case 'int': return '(' + base + '|0)';
                    case 'byte': return '(' + base + '|0)';
                    case 'bool': return '(!!' + base + ')';
                }
            case 'byte':
                switch (targetType.typeName) {
                    case 'uint': return base;
                    case 'int': return base;
                    case 'float': return '(+(' + base + '))';
                    case 'sfloat': return '(fround(' + base + '))';
                    case 'bool': return '(!!' + base + ')';
                }
            case 'bool':
                return '(' + base + '?1:0)';
        }

    },

    Subscript: function(env, ctx, prec) {
        var baseType = this.base.getType(ctx);
        var subscriptType = this.subscript.getType(ctx);

        var baseOutput = _node(this.base, env, ctx, prec);
        var subscriptOutput = _node(this.subscript, env, ctx, 1);

        var temp;
        if ((temp = env.registeredOperators[baseType.flatTypeName()]) &&
            (temp = temp[subscriptType.flatTypeName()]) &&
            '[]' in temp) {

            var operatorStmtFunc = ctx.env.registeredOperators[baseType.flatTypeName()][subscriptType.flatTypeName()]['[]'];
            return operatorStmtFunc + '(' + baseOutput + ',' + subscriptOutput + ')';
        }

        return baseOutput + '[' + subscriptOutput + ']';
    },

    TupleLiteral: function(env, ctx) {
        return '[' + this.content.map(function(x) {return _node(x, env, ctx, 1);}).join(',') + ']';
    },

};

module.exports = function translateJS(ctx) {
    return _node(ctx.scope, ctx.env, ctx, 0);
};
