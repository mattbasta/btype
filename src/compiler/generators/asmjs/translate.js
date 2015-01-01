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
};

var HEAP_MODIFIERS = {
    memheap: '>>1',
    intheap: '>>2',
    floatheap: '>>3',
    ptrheap: '>>2',
};

function _binop(env, ctx, prec) {
    var left = _node(this.left, env, ctx, OP_PREC[this.operator]);
    var right = _node(this.right, env, ctx, OP_PREC[this.operator]);

    var out;
    var oPrec = OP_PREC[this.operator] || 13;

    switch (this.operator) {
        case 'and':
        case 'or':
            throw new Error('Unconverted logical binop!');
        case '*':
            if (this.left.getType(ctx) === types.publicTypes.int &&
                this.right.getType(ctx) === types.publicTypes.int) {

                out = 'imul(' + left + ', ' + right + ')';
                oPrec = 18;
                break;
            }
        default:
            if (this.left.type !== 'Literal') left = '(' + typeAnnotation(left, this.left.getType(ctx)) + ')';
            if (this.right.type !== 'Literal') right = '(' + typeAnnotation(right, this.right.getType(ctx)) + ')';
            out = left + ' ' + this.operator + ' ' + right;
    }

    return '(' + out + ')';
}

function _node(node, env, ctx, prec, extra) {
    return NODES[node.type].call(node, env, ctx, prec, extra);
}

function typeAnnotation(base, type) {
    if (!type) return base;
    if (/^[\d\.]+$/.exec(base)) return base;

    var origBase = base;
    base = '(' + base + ')';

    switch (type.typeName) {
        case 'float':
            if (origBase[0] === '+') return base;
            return '+' + base;
        case 'byte':
        case 'int':
        case 'uint':
        default:
            if (origBase.substr(-2) === '|0') return base;
            return base + '|0';
    }

}


var NODES = {
    Root: function(env, ctx) {
        env.__globalPrefix = '';
        env.__stdlibRequested = {};
        env.__foreignRequested = {};
        var output = this.body.map(function(stmt) {
            return _node(stmt, env, ctx, 0);
        }).join('\n');
        output = env.__globalPrefix + output;
        delete env.__globalPrefix;
        delete env.__stdlibRequested;
        delete env.__foreignRequested;
        return output;
    },
    Unary: function(env, ctx, prec) {
        // Precedence here will always be 4.
        var out = _node(this.base, env, ctx, 4);
        if (4 < prec) {
            out = '(' + out + ')';
        }
        if (this.operator === '-') {
            out = '(-1 * ' + out + ')';
        } else if (this.operator === '!') {
            out = '!(' + typeAnnotation(out, types.publicTypes.int) + ')';
        }
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
                return typeAnnotation(_node(param, env, ctx, 18), param.getType(ctx));
            }).join(',') +
            ')' +
            (!prec ? ';' : '');
    },
    CallDecl: function(env, ctx, prec) {
        return '(' +
            typeAnnotation(
                _node(this.callee, env, ctx, 1) +
                    '(/* CallDecl */' +
                    this.params.map(function(param) {
                        return typeAnnotation(_node(param, env, ctx, 18), param.getType(ctx));
                    }).join(',') +
                    ')',
                this.callee.getType(ctx).getReturnType()
            ) +
            ')' +
            (!prec ? ';' : '');
    },
    CallRef: function(env, ctx, prec) {
        var funcType = this.callee.getType(ctx);
        var listName = env.getFuncListName(funcType);

        if (env.funcList[listName].length === 1) {
            return '(' +
                typeAnnotation(
                    env.funcList[listName][0] + '(/* CallRef;Compacted */' +
                    this.params.map(function(param) {
                        return typeAnnotation(_node(param, env, ctx, 18), param.getType(ctx));
                    }).join(',') +
                    ')',
                    funcType.getReturnType()
                ) +
                ')';
        }


        return '(' +
            typeAnnotation(
                listName + '$$call(' + _node(this.callee, env, ctx, 1) +
                    (this.params.length ? ',' : '') +
                    this.params.map(function(param) {
                        return typeAnnotation(_node(param, env, ctx, 18), param.getType(ctx));
                    }).join(',') + ')',
                funcType.getReturnType()
            ) +
            ')' +
            (!prec ? ';' : '');
    },
    FunctionReference: function(env, ctx, prec) {
        var funcName = this.base.__refName;
        var funcType = this.base.getType(ctx);
        var listName = env.getFuncListName(funcType);

        // TODO: Optimize this for the case that there is only one function in
        // the table.

        return '(gcref(getfuncref(' + this.base.__refIndex + ', ' + _node(this.ctx, env, ctx) + ')) | 0)';
    },
    Member: function(env, ctx, prec, parent) {
        var baseType = this.base.getType(ctx);
        if (baseType._type === 'module') {
            return baseType.memberMapping[this.child];
        }

        if (baseType._type === '_stdlib') {
            var stdlibName = baseType.name + '.' + this.child;
            if (stdlibName in env.__stdlibRequested) {
                return env.__stdlibRequested[stdlibName];
            }
            var stdlibAssignedName = env.namer();
            env.__globalPrefix += 'var ' + stdlibAssignedName + ' = stdlib.' + stdlibName + ';\n';
            env.__stdlibRequested[stdlibName] = stdlibAssignedName;
            return stdlibAssignedName;
        }

        if (baseType._type === '_foreign') {
            env.foreigns.push(this.child);
            var foreignName = 'foreign.' + this.child;
            if (this.child in env.__foreignRequested) {
                return env.__foreignRequested[this.child];
            }

            var foreignAssignedName = env.namer();
            env.__globalPrefix += 'var ' + foreignAssignedName + ' = foreign.' + this.child + ';\n';
            env.__foreignRequested[stdlibName] = foreignAssignedName;
            return foreignAssignedName;
        }

        if (baseType._type === '_foreign_curry') {
            return _node(this.base, env, ctx, 1);
        }

        var layout = baseType.getLayout();
        var childType = this.getType(ctx);
        var typedArr = 'ptrheap';
        if (childType.typeName === 'float') typedArr = 'floatheap';
        else if (childType.typeName === 'byte') typedArr = 'memheap';
        else if (childType.typeName === 'bool') typedArr = 'memheap';
        else if (childType.typeName === 'int') typedArr = 'intheap';

        var lookup = typedArr + '[' + _node(this.base, env, ctx, 1) + ' + ' + (layout[this.child] + 8) + HEAP_MODIFIERS[typedArr] + ']';
        if (parent !== 'Assignment' && parent !== 'Return') {
            lookup = typeAnnotation(lookup, childType);
        }
        return lookup;
    },
    Assignment: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 1, 'Assignment') + ' = ' +
            typeAnnotation(_node(this.value, env, ctx, 1), this.value.getType(ctx)) + ';';
    },
    Declaration: function(env, ctx, prec) {
        var type = this.value.getType(ctx);
        var output = 'var ' + this.__assignedName + ' = ';

        if (this.value.type === 'Literal') {
            output += this.value.value.toString() + ';';
            return output;
        }

        var def = type && type.typeName === 'float' ? '0.0' : '0';
        output += def + ';\n';
        output += this.__assignedName + ' = ' + _node(this.value, env, ctx, 17) + ';';
        return output;
    },
    ConstDeclaration: function() {
        return NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, prec) {
        var output = '';

        var params = ctx.scope.params.map(function(p) {
            return p.__assignedName;
        });
        Object.keys(ctx.typeMap).forEach(function(name) {
            var type = ctx.typeMap[name];
            if (type._type === 'primitive') return;

            // Ignore returned symbols
            if (this.value.type === 'Symbol' && this.value.__refName === name) return;

            // Ignore recursion
            if (this.value.type === 'Symbol' && this.value.__refName === ctx.scope.__assignedName) {
                return;
            }

            // Ignore parameters
            if (params.indexOf(name) !== -1) return;

            output += 'gcderef(' + name + ');\n';
        }, this);

        return output + 'return ' + typeAnnotation(_node(this.value, env, ctx, 1, 'Return'), this.value.getType(ctx)) + ';';
    },
    Export: function() {return '';},
    Import: function() {return '';},
    For: function(env, ctx, prec) {
        // FIXME: Make this valid asm
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
        // FIXME: Make this valid asm
        return 'do {' +
            this.loop.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '} while (' +
            _node(this.condition, env, ctx, 0) +
            ');';
    },
    While: function(env, ctx, prec) {
        // FIXME: Make this valid asm
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
    },
    If: function(env, ctx, prec) {
        return 'if (' +
            _node(this.condition, env, ctx, 0) +
            ') {\n' +
            this.consequent.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') +
            '\n}' +
            (this.alternate ? ' else {\n' + this.alternate.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n') + '\n}' : '');
    },
    Function: function(env, _, prec) {
        var ctx = this.__context;
        var output = 'function ' + this.__assignedName + '(';
        output += this.params.map(function(param) {
            return _node(param, env, ctx, 1);
        }).join(',');
        output += '){';
        if (this.name) {
            output += ' /* ' + this.name + ' */';
        }
        output += '\n';

        // asm.js parameter annotations
        if (this.params.length) {
            output += '    ' + this.params.map(function(param) {
                var paramType = param.getType(ctx);
                return param.__assignedName + ' = ' + typeAnnotation(param.__assignedName, paramType) + ';';
            }).join('\n    ');

            output += '\n';
        }

        output += '    ' + this.body.map(function(stmt) {
            return _node(stmt, env, ctx, 0);
        }).join('\n    ');

        var returnType = this.getType(ctx).getReturnType();
        if (returnType && this.body[this.body.length - 1].type !== 'Return') {
            output += '\n     return 0';
            if (returnType.typeName === 'float') {
                output += '.0';
            }
            output += ';';
        }

        output += '\n}';
        return output;
    },
    Type: function() {return '';},
    TypedIdentifier: function(env, ctx, prec) {
        return this.__assignedName;
    },
    Literal: function(env, ctx) {
        if (this.value === true) return '1';
        if (this.value === false) return '0';
        if (this.value === null) return '0';

        var output = this.value.toString();
        if (this.getType(ctx).typeName === 'float' && output.indexOf('.') === -1) {
            output += '.0';
        }
        return output
    },
    Symbol: function() {
        return this.__refName;
    },
    New: function(env, ctx) {
        return '(gcref(malloc(' + (this.getType(ctx).getSize() + 8) + '))|0)';
    },

    Break: function() {
        return 'break';
    },
    Continue: function() {
        return 'continue';
    },
};

module.exports = function translate(ctx) {
    return _node(ctx.scope, ctx.env, ctx, 0);
};

module.exports.typeAnnotation = typeAnnotation;
