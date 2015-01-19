var types = require('../../types');

var getLLVMType = require('./util').getLLVMType;
var makeName = require('./util').makeName;


function TranslationContext(env, ctx) {
    this.env = env;
    this.ctx = ctx;

    this.outputStack = [''];
    this.countStack = [0];
    this.indentation = '';

    this.uniqCounter = 0;

    this.push = function() {
        this.outputStack.unshift('');
        this.countStack.unshift(this.countStack[0]);
        this.indentation += '    ';
    };

    this.pop = function() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
    };

    this.write = function(data, noIndent) {
        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    };

    this.prepend = function(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    };

    this.toString = function() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in LLVM IR generator');
        }
        return this.outputStack[0];
    };

    this.getRegister = function() {
        return '%' + this.countStack[0]++;
    };

    this.getUniqueLabel = function(prefix) {
        return (prefix || 'lbl') + (this.uniqCounter++);
    };
}


function _binop(env, ctx, tctx) {
    var out;
    var left = _node(this.left, env, ctx, tctx);
    var right = _node(this.right, env, ctx, tctx);
    var outReg = tctx.getRegister();

    var outType = this.getType(ctx);

    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);
    var leftTypeString = leftType.toString();
    var rightTypeString = rightType.toString();

    if (ctx.env.registeredOperators[leftTypeString] &&
        ctx.env.registeredOperators[leftTypeString][rightTypeString] &&
        ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator]) {

        var operatorStmtFunc = ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator];

        tctx.write(outReg + ' = call fastcc ' + getLLVMType(outType) + ' @' + makeName(operatorStmtFunc) + '(' +
            getLLVMType(leftType) + ' ' + left + ', ' +
            getLLVMType(rightType) + ' ' + right +
            ')');
        return outReg;
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
            else if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '-':
            if (outType.typeName === 'float') {
                out = 'fsub';
                break;
            }

            out = 'sub ';
            if (outType.typeName === 'uint') out += 'nuw';
            else if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '*':
            if (outType.typeName === 'float') {
                out = 'fmul';
                break;
            }

            out = 'mul ';
            if (outType.typeName === 'uint') out += 'nuw';
            else if (outType.typeName === 'byte') out += 'nuw';
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
            else if (outType.typeName === 'byte') out += 'nuw';
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

        case '==':
            if (outType.typeName === 'float') out = 'fcmp oeq';
            else out = 'icmp eq';
            break;

        case '!=':
            if (outType.typeName === 'float') out = 'fcmp one';
            else out = 'icmp neq';
            break;

        case '>':
            if (outType.typeName === 'uint') out = 'icmp ugt';
            else if (outType.typeName === 'byte') out = 'icmp ugt';
            else if (outType.typeName === 'int') out = 'icmp sgt';
            else if (outType.typeName === 'float') out = 'fcmp ogt';
            break;


        case '>=':
            if (outType.typeName === 'uint') out = 'icmp uge';
            else if (outType.typeName === 'byte') out = 'icmp uge';
            else if (outType.typeName === 'int') out = 'icmp sge';
            else if (outType.typeName === 'float') out = 'fcmp oge';
            break;

        case '<':
            if (outType.typeName === 'uint') out = 'icmp ult';
            else if (outType.typeName === 'byte') out = 'icmp ult';
            else if (outType.typeName === 'int') out = 'icmp slt';
            else if (outType.typeName === 'float') out = 'fcmp olt';
            break;

        case '<=':
            if (outType.typeName === 'uint') out = 'icmp ule';
            else if (outType.typeName === 'byte') out = 'icmp ule';
            else if (outType.typeName === 'int') out = 'icmp sle';
            else if (outType.typeName === 'float') out = 'fcmp ole';
            break;

        default:
            throw new Error('Unknown binary operator: ' + this.operator);
    }

    tctx.write(outReg + ' = ' + out + ' ' + getLLVMType(outType) + ' ' + left + ', ' + right);
    return outReg;
}

function _node(node, env, ctx, tctx, extra) {
    return NODES[node.type].call(node, env, ctx, tctx, extra);
}

var NODES = {
    Root: function(env, ctx, tctx) {
        env.__globalPrefix = '';
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.prepend(env.__globalPrefix);
        delete env.__globalPrefix;
    },
    Unary: function(env, ctx, tctx) {
        var out = _node(this.base, env, ctx, tctx);
        var outType = this.getType(ctx);

        var reg = tctx.getRegister();
        switch (this.operator) {
            case '~':
                tctx.write(reg + ' = xor ' + getLLVMType(outType) + ' ' + out + ', 1');
            case '!':
                tctx.write(reg + ' = xor i1 ' + out + ', 1');
            default:
                throw new Error('Undefined unary operator: ' + this.operator);
        }

        return reg;
    },
    LogicalBinop: _binop,
    EqualityBinop: _binop,
    RelativeBinop: _binop,
    Binop: _binop,
    CallStatement: function(env, ctx, tctx) {
        // TODO: Is there a GC issue here?
        _node(this.base, env, ctx, tctx, 'stmt');
    },
    CallRaw: function(env, ctx, tctx, extra) {
        var outReg = tctx.getRegister();
        var output = outReg + ' = call ';

        // `fastcc` is a calling convention that attempts to make the call as
        // fast as possible.
        output += 'fastcc ';

        // Add the expected return type
        if (extra === 'stmt') {
            // Tell LLVM that we don't care about the return type because this
            // is a call statement.
            // TODO: Is this correct?
            output += 'void ';
        } else {
            output += getLLVMType(this.getType(ctx)) + ' ';
        }

        output += _node(this.callee, env, ctx, tctx, 'callee');

        output += '(';

        output += this.params.map(function(param) {
            var paramType = param.getType(ctx);
            return getLLVMType(paramType) + ' ' + _node(param, env, ctx, tctx);
        }).join(', ');

        output += ')';

        tctx.write(output);
        return outReg;

    },
    CallDecl: function(env, ctx, tctx, extra) {
        return NODES.CallRaw.apply(this, arguments);
    },
    CallRef: function(env, ctx, tctx, extra) {
        throw new Error('Not Implemented');
    },
    FunctionReference: function(env, ctx, tctx) {
        throw new Error('Not Implemented');
    },
    Member: function(env, ctx, tctx, parent) {
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
            return _node(this.base, env, ctx, tctx);
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            throw new Error('Not Implemented');
            var objectMethodFunc = ctx.lookupFunctionByName(baseType.getMethod(this.child));
            var objectMethodFuncIndex = env.registerFunc(objectMethodFunc);
            return '((getboundmethod(' + objectMethodFuncIndex + ', ' + _node(this.base, env, ctx, tctx) + ')|0) | 0)';
        }

        var layoutIndex = baseType.getLayoutIndex(this.child);
        var outReg = tctx.getRegister();

        tctx.write(outReg + ' = extractvalue ' +
            getLLVMType(this.getType(ctx)) + ' ' +
            _node(this.base, env, ctx, tctx),
            ', ' +
            layoutIndex);
        return outReg;
    },
    Assignment: function(env, ctx, tctx) {
        tctx.write(_node(this.base, env, ctx, tctx) + ' = ' + _node(this.value, env, ctx, tctx));
    },
    Declaration: function(env, ctx, tctx) {
        tctx.write('%' + makeName(this.__assignedName) + ' = ' + _node(this.value, env, ctx, tctx));
    },
    ConstDeclaration: function() {
        NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, tctx) {
        if (!this.value) {
            tctx.write('ret void');
            return;
        }
        tctx.write('ret ' + getLLVMType(this.value.getType(ctx)) + ' ' + _node(this.value, env, ctx, tctx));
    },
    Export: function() {},
    Import: function() {},
    For: function(env, ctx, tctx) {
        var innerLbl = tctx.getUniqueLabel('inner');
        var afterLbl = tctx.getUniqueLabel('after');

        _node(this.assignment, env, ctx, tctx);

        var loopLbl = tctx.getUniqueLabel('loop');
        tctx.write(loopLbl + ':', true);

        var condResult = _node(this.condition, env, ctx, tctx);
        tctx.write('br i1 ' + condResult + ', label %' + innerLbl + ', label %' + afterLbl);
        tctx.write(innerLbl + ':', true);

        this.loop.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + loopLbl);
        tctx.write(afterLbl + ':', true);
    },
    DoWhile: function(env, ctx, tctx) {
        var loopLbl = tctx.getUniqueLabel('loop');
        var afterLbl = tctx.getUniqueLabel('after');

        tctx.write(loopLbl + ':', true);

        this.loop.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        var condition = _node(this.condition, env, ctx, tctx);
        tctx.write('br i1 ' + condition + ', label %' + loopLbl + ', label %' + afterLbl);
        tctx.write(afterLbl + ':', true);
    },
    While: function(env, ctx, tctx) {
        var beforeLbl = tctx.getUniqueLabel('before');
        tctx.write(beforeLbl + ':', true);

        var condition = _node(this.condition, env, ctx, tctx);

        var loopLbl = tctx.getUniqueLabel('loop');
        var afterLbl = tctx.getUniqueLabel('after');

        tctx.write('br i1 ' + condition + ', label %' + loopLbl + ', label %' + afterLbl);
        tctx.write(loopLbl + ':', true);

        this.loop.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + afterLbl);
        tctx.write(afterLbl + ':', true);
    },
    Switch: function(env, ctx, tctx) {
        throw new Error('Not Implemented');
    },
    Case: function() {},
    If: function(env, ctx, tctx) {
        var condition = _node(this.condition, env, ctx, tctx);

        var consequentLbl = tctx.getUniqueLabel('conseq');
        var afterLbl = tctx.getUniqueLabel('after');
        var alternateLbl = this.alternate ? tctx.getUniqueLabel('alternate') : afterLbl;

        tctx.write('br i1 ' + condition + ', label %' + consequentLbl + ', label %' + alternateLbl);
        tctx.write(consequentLbl + ':', true);

        this.consequent.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + afterLbl);

        if (this.alternate) {
            tctx.write(alternateLbl + ':', true);
            this.alternate.forEach(function(stmt) {
                _node(stmt, env, ctx, tctx);
            });
        }

        tctx.write(afterLbl + ':', true);

    },
    Function: function(env, ctx, tctx) {
        var context = this.__context;
        var funcType = this.getType(ctx);
        var returnType = funcType.getReturnType();

        tctx.write('define @' + makeName(this.__assignedName) + ' ' +
            (returnType ? getLLVMType(returnType) : 'void') +
            ' (' +
            this.params.map(function(param) {
                return getLLVMType(param.getType(ctx)) + ' ' + _node(param, env, context);
            }).join(', ') + ') nounwind {');

        tctx.push();

        this.body.forEach(function(stmt) {
            _node(stmt, env, context, tctx);
        });

        tctx.pop();

        tctx.write('}');
    },
    OperatorStatement: function(env, ctx, tctx) {
        tctx.write('define @' + makeName(this.__assignedName) +
            getLLVMType(this.returnType.getType(ctx)) +
            ' (' +
            getLLVMType(this.left.getType(ctx)) + ' ' +  _node(this.left, env, ctx, tctx) + ', ' +
            getLLVMType(this.right.getType(ctx)) + ' ' +  _node(this.right, env, ctx, tctx) +
            ') nounwind {');

        tctx.push();

        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        tctx.pop();

        tctx.write('}');
    },
    TypedIdentifier: function(env, ctx, tctx) {
        return makeName(this.__assignedName);
    },
    Literal: function(env, ctx, tctx) {
        if (this.value === true) return 'true';
        if (this.value === false) return 'false';
        if (this.value === null) return 'null';
        return getLLVMType(this.getType(ctx)) + ' ' + this.value.toString();
    },
    Symbol: function() {
        return '%' + makeName(this.__refName);
    },
    New: function(env, ctx, tctx) {
        throw new Error('Not Implemented');
    },

    Break: function() {
        throw new Error('Not Implemented');
    },
    Continue: function() {
        throw new Error('Not Implemented');
    },

    ObjectDeclaration: function(env, ctx, tctx) {
        if (this.objConstructor) {
            _node(this.objConstructor, env, ctx, tctx) + '\n';
        }

        this.methods.forEach(function(method) {
            _node(method, env, ctx, tctx);
        });
    },
    ObjectMember: function() {},
    ObjectMethod: function(env, ctx, tctx) {
        _node(this.base, env, ctx, tctx);
    },
    ObjectConstructor: function(env, ctx, tctx) {
        // Constructors are merged with the JS constructor in `typeTranslate`
        // in the JS generate module.
    },

    TypeCast: function(env, ctx, tctx) {
        throw new Error('Not Implemented');
    },
};

module.exports = function translate(ctx) {
    var tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
