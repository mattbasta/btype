var types = require('../../types');

var getLLVMType = require('./util').getLLVMType;
var makeName = require('./util').makeName;


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
    var out;
    var left = _node(this.left, env, ctx, OP_PREC[this.operator]);
    var right = _node(this.right, env, ctx, OP_PREC[this.operator]);

    var outType = this.getType(ctx);

    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);
    var leftTypeString = leftType.toString();
    var rightTypeString = rightType.toString();

    if (ctx.env.registeredOperators[leftTypeString] &&
        ctx.env.registeredOperators[leftTypeString][rightTypeString] &&
        ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator]) {

        var operatorStmtFunc = ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator];
        return operatorStmtFunc + '(' + left + ',' + right + ')';
    }

    switch (this.operator) {
        case 'and':
            out = 'and';
            break;
        case 'or':
            out = 'or';
            break;
        case '+':
            if (outType.typeName === 'float') {
                out = 'fadd';
                break;
            }

            out = 'add ';
            if (outType.typeName === 'uint') out += 'nuw';
            if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '-':
            if (outType.typeName === 'float') {
                out = 'fsub';
                break;
            }

            out = 'sub ';
            if (outType.typeName === 'uint') out += 'nuw';
            if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '*':
            if (outType.typeName === 'float') {
                out = 'fmul';
                break;
            }

            out = 'mul ';
            if (outType.typeName === 'uint') out += 'nuw';
            if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '/':
            if (outType.typeName === 'float') {
                out = 'fdiv';
                break;
            } else if (outType.typeName === 'uint') {
                out = 'udiv';
                break;
            }

            out = 'sdiv ';
            break;

        case '%':
            if (outType.typeName === 'float') {
                out = 'frem';
                break;
            } else if (outType.typeName === 'uint') {
                out = 'urem';
                break;
            }

            out = 'srem ';
            break;

        case '<<':
            out = 'shl ';
            if (outType.typeName === 'uint') out += 'nuw';
            if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '>>':
            if (outType.typeName === 'uint') out = 'lshr';
            else if (outType.typeName === 'int') out = 'ashr';
            break;

        case '&':
            out = 'and';
            break;
        case '|':
            out = 'or';
            break;
        case '^':
            out = 'xor';
            break;

        default:
            throw new Error('Unknown binary operator: ' + this.operator);
    }

    out += getLLVMType(outType) + ' ' + left + ', ' + right;
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
        var outType = this.getType(ctx);

        switch (this.operator) {
            case '~':
                return 'xor ' + getLLVMType(outType) + ' ' + out + ', 1';
            case '!':
                return 'xor i1 ' + out + ', 1';
        }

        throw new Error('Undefined unary operator: ' + this.operator);
    },
    LogicalBinop: _binop,
    EqualityBinop: _binop,
    RelativeBinop: _binop,
    Binop: _binop,
    CallStatement: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 0, 'stmt');
    },
    CallRaw: function(env, ctx, prec, extra) {

        var output = 'call ';

        // `fastcc` is a calling convention that attempts to make the call as
        // fast as possible.
        output += 'fastcc ';

        // Add the expected return type
        if (extra === 'stmt') {
            // Tell LLVM that we don't care about the return type because this
            // is a call statement.
            output += 'void ';
        } else {
            output += getLLVMType(this.getType(ctx)) + ' ';
        }

        output += _node(this.callee, env, ctx, 1);

        output += '(';

        output += this.params.map(function(param) {
            var paramType = param.getType(ctx);
            return getLLVMType(paramType) + ' ' + _node(param, env, ctx, 18);
        }).join(', ');

        output += ')';

        return output;

    },
    CallDecl: function(env, ctx, prec) {
        return NODES.CallRaw.apply(this, arguments);
    },
    CallRef: function(env, ctx, prec) {
        throw new Error('Not Implemented');
    },
    FunctionReference: function(env, ctx, prec) {
        throw new Error('Not Implemented');
    },
    Member: function(env, ctx, prec, parent) {
        var baseType = this.base.getType(ctx);
        if (baseType._type === 'module') {
            return baseType.memberMapping[this.child];
        }

        if (baseType._type === '_stdlib') {
            throw new Error('Not Implemented');
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
            throw new Error('Not Implemented');
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

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            throw new Error('Not Implemented');
            var objectMethodFunc = ctx.lookupFunctionByName(baseType.getMethod(this.child));
            var objectMethodFuncIndex = env.registerFunc(objectMethodFunc);
            return '((getboundmethod(' + objectMethodFuncIndex + ', ' + _node(this.base, env, ctx, 1) + ')|0) | 0)';
        }

        var layoutIndex = baseType.getLayoutIndex(this.child);

        return 'extractvalue ' +
            getLLVMType(this.getType(ctx)) + ' ' +
            _node(this.base, env, ctx, 1),
            ', ' +
            layoutIndex;
    },
    Assignment: function(env, ctx, prec) {
        return _node(this.base, env, ctx, 1) + ' = ' + _node(this.value, env, ctx, 1);
    },
    Declaration: function(env, ctx, prec) {
        return makeName(this.__assignedName) + ' = ' + _node(this.value, env, ctx, 17);
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
            }).join('\n') + '}' : '');
    },
    Function: function(env, ctx, prec) {
        var context = this.__context;
        var funcType = this.getType(ctx);
        var returnType = funcType.getReturnType();

        var output = 'define @' + makeName(this.__assignedName) + ' ' +
            (returnType ? getLLVMType(returnType) : 'void') +
            ' (' +
            this.params.map(function(param) {
                return getLLVMType(param.getType(ctx)) + ' ' + _node(param, env, context, 1);
            }).join(', ') + ') nounwind {\n' +
            this.body.map(function(stmt) {
                return _node(stmt, env, context, 0);
            }).join('\n');

        output += '\n}';
        return output;
    },
    OperatorStatement: function(env, ctx, prec) {
        return 'define @' + makeName(this.__assignedName) +
            getLLVMType(this.returnType.getType(ctx)) +
            ' (' +
            getLLVMType(this.left.getType(ctx)) + ' ' +  _node(this.left, env, ctx, 1) + ', ' +
            getLLVMType(this.right.getType(ctx)) + ' ' +  _node(this.right, env, ctx, 1) +
            ') nounwind {\n    ' +
            this.body.map(function(stmt) {
                return _node(stmt, env, ctx, 0);
            }).join('\n    ') + '\n}';
    },
    TypedIdentifier: function(env, ctx, prec) {
        return makeName(this.__assignedName);
    },
    Literal: function(env, ctx) {
        if (this.value === true) return 'true';
        if (this.value === false) return 'false';
        if (this.value === null) return 'null';
        return getLLVMType(this.getType(ctx)) + ' ' + this.value.toString();
    },
    Symbol: function() {
        return makeName(this.__refName);
    },
    New: function(env, ctx) {
        var type = this.getType(ctx);
        var output = 'new ' + type.typeName;

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
                    case 'byte': return base;
                    case 'bool': return '(!!' + base + ')';
                }
            case 'uint':
                switch (targetType.typeName) {
                    case 'int': return 'uint2int(' + base + ')';
                    case 'float': return '(+(' + base + '))';
                    case 'byte': return base;
                    case 'bool': return '(' + base + ' != 0)';
                }
            case 'float':
                switch (targetType.typeName) {
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
                    case 'bool': return '(!!' + base + ')';
                }
            case 'bool':
                return '(' + base + '?1:0)';
        }

    },
};

module.exports = function translate(ctx) {
    return _node(ctx.scope, ctx.env, ctx, 0);
};
