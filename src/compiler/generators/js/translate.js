var TranslationContext = require('./TranslationContext');
var types = require('../../types');


function _binop(env, ctx, tctx) {
    var out;
    var left = _node(this.left, env, ctx, tctx);
    var right = _node(this.right, env, ctx, tctx);

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
                break;
            }
        case '/':
            if (this.operator === '/' &&
                this.left.getType(ctx) === types.publicTypes.int &&
                this.right.getType(ctx) === types.publicTypes.int) {

                out = '(' + left + ' / ' + right + ' | 0)';
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
    Root: function(env, ctx, tctx) {
        env.__globalPrefix = '';
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        if (env.__globalPrefix) {
            tctx.prepend(env.__globalPrefix);
        }
        delete env.__globalPrefix;
    },
    Unary: function(env, ctx, tctx) {
        // Precedence here will always be 4.
        var out = _node(this.base, env, ctx, tctx);
        out = this.operator + '(' + out + ')';
        return out;
    },
    LogicalBinop: _binop,
    EqualityBinop: _binop,
    RelativeBinop: _binop,
    Binop: _binop,
    CallStatement: function(env, ctx, tctx) {
        tctx.write(_node(this.base, env, ctx, tctx) + ';');
    },
    CallRaw: function(env, ctx, tctx) {
        return _node(this.callee, env, ctx, tctx) + '(/* CallRaw */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, tctx);
            }).join(',') +
            ')';
    },
    CallDecl: function(env, ctx, tctx) {
        return _node(this.callee, env, ctx, tctx) +
            '(/* CallDecl */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, tctx);
            }).join(',') +
            ')';
    },
    CallRef: function(env, ctx, tctx) {
        var funcType = this.callee.getType(ctx);

        var paramList = this.params.map(function(param) {
            return _node(param, env, ctx, tctx);
        }).join(',');

        var temp;
        if (this.callee.type === 'Member' &&
            (temp = this.callee.base.getType(ctx)).hasMethod &&
            temp.hasMethod(this.callee.child)) {

            return temp.getMethod(this.callee.child) + '(/* CallRef:Method */' +
                _node(this.callee.base, env, ctx, tctx) + (paramList ? ', ' : '') + paramList + ')';
        }

        return _node(this.callee, env, ctx, tctx) +
            '(/* CallRef */' + paramList + ')';
    },
    FunctionReference: function(env, ctx, tctx) {
        if (!this.ctx) {
            // If there is no context, it means it's just a root global or
            // needs no context.
            return _node(this.base, env, ctx, tctx);
        }

        var ctx = _node(this.ctx, env, ctx, tctx);
        if (ctx === '0') {
            return _node(this.base, env, ctx, tctx);
        }
        // TODO: optimize this by adding the function prototype directly
        return '(function($$ctx) {return ' + _node(this.base, env, ctx, tctx) + '.apply(null, Array.prototype.slice.call(arguments, 1).concat([$$ctx]))}.bind(null, ' + _node(this.ctx, env, ctx, tctx) + '))';
    },
    Member: function(env, ctx, tctx) {
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
            base = _node(this.base, env, ctx, tctx);
        }

        if (baseType._type === '_foreign_curry') {
            return base;
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            return baseType.getMethod(this.child) + '.bind(null, ' + _node(this.base, env, ctx, tctx) + ')';
        }

        if (baseType._type === 'string' || baseType._type === 'array') {
            switch (this.child) {
                case 'length':
                    return base + '.length';
            }
        }

        return base + '.' + this.child;
    },
    Assignment: function(env, ctx, tctx) {
        tctx.write(_node(this.base, env, ctx, tctx) + ' = ' + _node(this.value, env, ctx, tctx) + ';');
    },
    Declaration: function(env, ctx, tctx) {
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

        output += this.__assignedName + ' = ' + _node(this.value, env, ctx, tctx) + ';';
        tctx.write(output);
    },
    ConstDeclaration: function() {
        return NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, tctx) {
        if (!this.value) {
            if (ctx.scope.__objectSpecial === 'constructor') {
                tctx.write('return ' + ctx.scope.params[0].__assignedName + ';');
                return;
            }
            tctx.write('return;');
            return;
        }
        tctx.write('return ' + _node(this.value, env, ctx, tctx) + ';');
    },
    Export: function() {},
    Import: function() {},
    For: function(env, ctx, tctx) {
        tctx.write('for (');

        tctx.push();
        _node(this.assignment, env, ctx, tctx);
        tctx.write(_node(this.condition, env, ctx, tctx) + ';');
        _node(this.iteration, env, ctx, tctx);
        tctx.trimSemicolon();
        tctx.pop();

        tctx.write(') {');

        tctx.push();
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.pop();

        tctx.write('}');
    },
    DoWhile: function(env, ctx, tctx) {
        tctx.write('do {');

        tctx.push();
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.pop();

        tctx.write('} while (' + _node(this.condition, env, ctx, tctx) + ');');
    },
    While: function(env, ctx, tctx) {
        tctx.write('while (' + _node(this.condition, env, ctx, tctx) + ') {');

        tctx.push();
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.pop();

        tctx.write('}');
    },
    If: function(env, ctx, tctx) {
        tctx.write('if (' + _node(this.condition, env, ctx, tctx) + ') {');

        tctx.push();
        this.consequent.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.pop();

        if (this.alternate) {
            tctx.write('} else {');
            tctx.push();
            this.alternate.forEach(function(stmt) {
                _node(stmt, env, ctx, tctx);
            });
            tctx.pop();
        }
        tctx.write('}');
    },
    Function: function(env, ctx, tctx) {
        var context = this.__context;

        tctx.write('function ' + this.__assignedName + '(');
        tctx.push();
        tctx.write(this.params.map(function(param) {
            return _node(param, env, context, tctx);
        }).join(','));
        tctx.pop();
        tctx.write(') {');

        tctx.push();
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        if (this.__objectSpecial === 'constructor') {
            tctx.write('return ' + this.params[0].__assignedName + ';');
        }

        tctx.pop();

        tctx.write('}');
    },
    OperatorStatement: function(env, ctx, tctx) {
        tctx.write('function ' + this.__assignedName + '(');
        tctx.push();
        tctx.write(_node(this.left, env, ctx, tctx) + ', ' + _node(this.right, env, ctx, tctx));
        tctx.pop();
        tctx.write(') {');

        tctx.push();
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.pop();

        tctx.write('}');
    },
    Type: function() {},
    TypedIdentifier: function() {
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
    New: function(env, ctx, tctx) {
        var type = this.getType(ctx);

        // TODO: Consider making this use typed arrays for primitives
        if (type._type === 'array') {
            var arrLength = _node(this.params[0], env, ctx, tctx);
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
                return _node(param, env, ctx, tctx);
            }).join(', ') + ')';
        } else {
            output += '()';
        }

        return output;
    },

    Break: function(env, ctx, tctx) {
        tctx.write('break;');
    },
    Continue: function(env, ctx, tctx) {
        tctx.write('continue;');
    },

    ObjectDeclaration: function(env, ctx, tctx) {
        if (!this.__isConstructed) return;

        if (this.objConstructor) {
            _node(this.objConstructor, env, ctx, tctx);
        }

        this.methods.forEach(function(method) {
            _node(method, env, ctx, tctx);
        });
    },
    ObjectMember: function() {},
    ObjectMethod: function(env, ctx, tctx) {
        return _node(this.base, env, ctx, tctx);
    },
    ObjectConstructor: function() {
        // Constructors are merged with the JS constructor in `typeTranslate`
        // in the JS generate module.
    },

    TypeCast: function(env, ctx, tctx) {
        var baseType = this.left.getType(ctx);
        var targetType = this.rightType.getType(ctx);

        var base = _node(this.left, env, ctx, tctx);
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

    Subscript: function(env, ctx, tctx) {
        var baseType = this.base.getType(ctx);
        var subscriptType = this.subscript.getType(ctx);

        var baseOutput = _node(this.base, env, ctx, tctx);
        var subscriptOutput = _node(this.subscript, env, ctx, tctx);

        var temp;
        if ((temp = env.registeredOperators[baseType.flatTypeName()]) &&
            (temp = temp[subscriptType.flatTypeName()]) &&
            '[]' in temp) {

            var operatorStmtFunc = ctx.env.registeredOperators[baseType.flatTypeName()][subscriptType.flatTypeName()]['[]'];
            return operatorStmtFunc + '(' + baseOutput + ',' + subscriptOutput + ')';
        }

        return baseOutput + '[' + subscriptOutput + ']';
    },

    TupleLiteral: function(env, ctx, tctx) {
        return '[' + this.content.map(function(x) {
            return _node(x, env, ctx, tctx);
        }).join(',') + ']';
    },

    SwitchType: function(env, ctx, tctx) {
        var type = this.expr.getType(ctx);
        for (i = 0; i < this.cases.length; i++) {
            if (!this.cases[i].getType(ctx).equals(type)) {
                continue;
            }
            return _node(this.cases[i], env, ctx, tctx);
        }
    },

    SwitchTypeCase: function(env, ctx, tctx) {
        return this.body.map(function(x) {
            return _node(x, env, ctx, tctx);
        }).join('\n');
    },

};

module.exports = function translateJS(ctx) {
    var tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
