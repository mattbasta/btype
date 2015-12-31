var externalFuncs = require('./externalFuncs');
var getAlignment = require('./util').getAlignment;
var getFunctionSignature = require('./util').getFunctionSignature;
var getLLVMType = require('./util').getLLVMType;
var makeName = require('./util').makeName;
var stdlibFuncs = require('./stdlibFuncs');
var TranslationContext = require('./TranslationContext');
var types = require('../../types');


function _binop(env, ctx, tctx) {
    var out;
    var left = _node(this.left, env, ctx, tctx);
    var right = _node(this.right, env, ctx, tctx);
    var outReg;

    var outType = this.getType(ctx);

    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);

    if (leftType && rightType) {
        var leftTypeString = leftType.flatTypeName();
        var rightTypeString = rightType.flatTypeName();

        if (ctx.env.registeredOperators[leftTypeString] &&
            ctx.env.registeredOperators[leftTypeString][rightTypeString] &&
            ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator]) {

            var operatorStmtFunc = ctx.env.registeredOperators[leftTypeString][rightTypeString][this.operator];

            outReg = tctx.getRegister();
            tctx.write(outReg + ' = call ' + getLLVMType(outType) + ' @' + makeName(operatorStmtFunc) + '(' +
                getLLVMType(leftType) + ' ' + left + ', ' +
                getLLVMType(rightType) + ' ' + right +
                ')');
            return outReg;
        }

    }

    switch (this.operator) {
        case 'and':
            out = 'and';
            break;
        case 'or':
            out = 'or';
            break;
        case '+':
            if (outType.typeName === 'float' || outType.typeName === 'sfloat') {
                out = 'fadd';
                break;
            }

            out = 'add ';
            if (outType.typeName === 'uint') out += 'nuw';
            else if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '-':
            if (outType.typeName === 'float' || outType.typeName === 'sfloat') {
                out = 'fsub';
                break;
            }

            out = 'sub ';
            if (outType.typeName === 'uint') out += 'nuw';
            else if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '*':
            if (outType.typeName === 'float' || outType.typeName === 'sfloat') {
                out = 'fmul';
                break;
            }

            out = 'mul ';
            if (outType.typeName === 'uint') out += 'nuw';
            else if (outType.typeName === 'byte') out += 'nuw';
            else if (outType.typeName === 'int') out += 'nsw';
            break;

        case '/':
            if (outType.typeName === 'float' || outType.typeName === 'sfloat') {
                out = 'fdiv';
                break;
            } else if (outType.typeName === 'uint') {
                out = 'udiv';
                break;
            }

            out = 'sdiv ';
            break;

        case '%':
            if (outType.typeName === 'float' || outType.typeName === 'sfloat') {
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
            if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp oeq';
            else out = 'icmp eq';
            break;

        case '!=':
            if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp one';
            else out = 'icmp neq';
            break;

        case '>':
            if (leftType.typeName === 'uint') out = 'icmp ugt';
            else if (leftType.typeName === 'byte') out = 'icmp ugt';
            else if (leftType.typeName === 'int') out = 'icmp sgt';
            else if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp ogt';
            break;


        case '>=':
            if (leftType.typeName === 'uint') out = 'icmp uge';
            else if (leftType.typeName === 'byte') out = 'icmp uge';
            else if (leftType.typeName === 'int') out = 'icmp sge';
            else if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp oge';
            break;

        case '<':
            if (leftType.typeName === 'uint') out = 'icmp ult';
            else if (leftType.typeName === 'byte') out = 'icmp ult';
            else if (leftType.typeName === 'int') out = 'icmp slt';
            else if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp olt';
            break;

        case '<=':
            if (leftType.typeName === 'uint') out = 'icmp ule';
            else if (leftType.typeName === 'byte') out = 'icmp ule';
            else if (leftType.typeName === 'int') out = 'icmp sle';
            else if (leftType.typeName === 'float' || leftType.typeName === 'sfloat') out = 'fcmp ole';
            break;

        default:
            throw new Error('Unknown binary operator: ' + this.operator);
    }

    outReg = tctx.getRegister();
    tctx.write(outReg + ' = ' + out + ' ' + getLLVMType(leftType) + ' ' + left + ', ' + right);
    return outReg;
}

function _node(node, env, ctx, tctx, extra) {
    if (!(node.type in NODES)) {
        throw new Error(node.type + ' is not a supported node');
    }
    //
    var output = NODES[node.type].call(node, env, ctx, tctx, extra);
    //
    return output;
}

var NODES = {
    Root: function(env, ctx, tctx) {
        env.__globalPrefix = env.__globalPrefix || '';
        env.__foreignRequested = env.__foreignRequested || {};
        env.__stdlibRequested = env.__stdlibRequested || {};
        env.__arrayTypes = env.__arrayTypes || {};
        env.__tupleTypes = env.__tupleTypes || {};
        env.__funcrefTypes = env.__funcrefTypes || {};
        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, ctx, tctx, 'root');
        });
        tctx.prepend(env.__globalPrefix);
        env.__globalPrefix = '';
    },
    Block: function(env, ctx, tctx) {
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
    },
    Unary: function(env, ctx, tctx) {
        var out = _node(this.base, env, ctx, tctx);
        var outType = this.getType(ctx);

        var reg = tctx.getRegister();
        switch (this.operator) {
            case '~':
                tctx.write(reg + ' = xor ' + getLLVMType(outType) + ' ' + out + ', 1');
                break;
            case '!':
                tctx.write(reg + ' = xor i1 ' + out + ', 1');
                break;
            default:
                throw new Error('Undefined unary operator: "' + this.operator + '"');
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
        var output = extra === 'stmt' ? 'call ' : ' = call ';

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
            return getLLVMType(param.getType(ctx)) + ' ' + _node(param, env, ctx, tctx);
        }).join(', ');

        output += ')';

        if (extra !== 'stmt') {
            var outReg = tctx.getRegister();
            output = outReg + output;
            tctx.write(output);
            return outReg;
        } else {
            tctx.write(output);
        }

    },
    CallDecl: function(env, ctx, tctx, extra) {
        return NODES.CallRaw.apply(this, arguments);
    },
    CallRef: function(env, ctx, tctx, extra) {
        var type = this.callee.getType(ctx);
        var typeName = getLLVMType(type);

        var typeRefName = getFunctionSignature(type);

        var params;

        var callBody;

        var temp;
        if (this.callee.type === 'Member' &&
            (temp = this.callee.base.getType(ctx)).hasMethod &&
            temp.hasMethod(this.callee.child)) {

            var methodBase = _node(this.callee.base, env, ctx, tctx);
            var params = this.params.map(function(p) {
                var type = p.getType(ctx);
                var typeName = getLLVMType(type);
                return typeName + ' ' + _node(p, env, ctx, tctx);
            }).join(', ');

            callBody = 'call ' +
                getLLVMType(this.getType(ctx)) + ' @' +
                makeName(temp.getMethod(this.callee.child)) + '(' +
                getLLVMType(this.callee.base.getType(ctx)) + ' ' +
                methodBase + (params ? ', ' : '') +
                params + ')';

            if (extra === 'stmt') {
                tctx.write(callBody);
                return;
            }

            var outReg = tctx.getRegister();
            tctx.write(outReg + ' = ' + callBody);
            return outReg;
        }

        var callee = _node(this.callee, env, ctx, tctx);

        var funcPtrReg = tctx.getRegister();
        tctx.write(funcPtrReg + ' = getelementptr inbounds ' + typeName + ' ' + callee + ', i32 0, i32 0');
        var funcReg = tctx.getRegister();
        tctx.write(funcReg + ' = load ' + typeRefName + '* ' + funcPtrReg + ', align ' + getAlignment(type));
        var ctxPtrReg = tctx.getRegister();
        tctx.write(ctxPtrReg + ' = getelementptr inbounds ' + typeName + ' ' + callee + ', i32 0, i32 1');
        var ctxReg = tctx.getRegister();
        tctx.write(ctxReg + ' = load i8** ' + ctxPtrReg);

        params = this.params.map(function(p) {
            var type = p.getType(ctx);
            var typeName = getLLVMType(type);
            return typeName + ' ' + _node(p, env, ctx, tctx);
        }).join(', ');

        var isNullCmpReg = tctx.getRegister();
        tctx.write(isNullCmpReg + ' = icmp eq i8* ' + ctxReg + ', null');

        var returnTypeRaw = this.getType(ctx);
        var returnType = getLLVMType(returnTypeRaw);
        var callRetPtr = tctx.getRegister();
        tctx.write(callRetPtr + ' = alloca ' + returnType);


        var nullLabel = tctx.getUniqueLabel('isnull');
        var unnullLabel = tctx.getUniqueLabel('unnull');
        var afternullLabel = tctx.getUniqueLabel('afternull');

        tctx.write('br i1 ' + isNullCmpReg + ', label %' + nullLabel + ', label %' + unnullLabel);

        tctx.writeLabel(nullLabel);

        var selflessFuncType = getFunctionSignature(type, true); // true -> no `self`/`ctx` param

        var nullRetPtr;
        if (this.params.length === type.args.length - 1) {
            var selflessFuncReg = tctx.getRegister();
            tctx.write(selflessFuncReg + ' = bitcast ' + typeRefName + ' ' + funcReg + ' to ' + selflessFuncType + ' ; callref:selfless_downcast');

            callBody = 'call ' + returnType + ' ' + selflessFuncReg + '(' + params + ')';

        } else {
            callBody = 'call ' + returnType + ' ' + funcReg + '(' + params + ')';

        }

        if (extra === 'stmt') {
            tctx.write(callBody);
        } else {
            var nullRetPtr = tctx.getRegister();
            tctx.write(nullRetPtr + ' = ' + callBody);
            tctx.write('store ' + returnType + ' ' + nullRetPtr + ', ' + returnType + '* ' + callRetPtr + ', align 8');
        }

        tctx.write('br label %' + afternullLabel);

        tctx.writeLabel(unnullLabel);

        if (this.params.length === type.args.length) {
            // If we get here, it means there's a non-null context on a
            // function with no room to accept a context.

            tctx.getRegister(); // waste a register for `unreachable`
            tctx.write('unreachable');
        } else {
            var castCtxReg = tctx.getRegister();
            var ctxRegType = getLLVMType(type.args[0]);
            tctx.write(castCtxReg + ' = bitcast i8* ' + ctxReg + ' to ' + ctxRegType);

            callBody = 'call ' + returnType + ' ' + funcReg +
                '(' +
                ctxRegType + ' ' + castCtxReg +
                (this.params.length ? ', ' : '') +
                params +
                ')';

            if (extra === 'stmt') {
                tctx.write(callBody);
            } else {
                var unnullRetPtr = tctx.getRegister();
                tctx.write(unnullRetPtr + ' = ' + callBody);
                tctx.write('store ' + returnType + ' ' + unnullRetPtr + ', ' + returnType + '* ' + callRetPtr + ', align 8');
            }

        }

        tctx.write('br label %' + afternullLabel);

        tctx.writeLabel(afternullLabel);

        if (extra === 'stmt') {
            return;
        }

        var callRet = tctx.getRegister();
        tctx.write(callRet + ' = load ' + returnType + '* ' + callRetPtr + ', align ' + getAlignment(returnTypeRaw));
        return callRet;

    },
    FunctionReference: function(env, ctx, tctx) {
        var type = this.getType(ctx);
        var typeName = getLLVMType(type);

        var funcType = getFunctionSignature(type);

        if (!(typeName in env.__funcrefTypes)) {
            env.__globalPrefix += '\n' + typeName.substr(0, typeName.length - 1) + ' = type { ' + funcType + ', i8* }'
            env.__funcrefTypes[typeName] = true;
        }

        var reg = tctx.getRegister();
        tctx.write(reg + ' = call i8* @malloc(i32 16) ; funcref'); // 16 is just to be safe for 64 bit
        var regPtr = tctx.getRegister();
        tctx.write(regPtr + ' = bitcast i8* ' + reg + ' to ' + typeName);

        var funcLocPtr = tctx.getRegister();
        tctx.write(funcLocPtr + ' = getelementptr inbounds ' + typeName + ' ' + regPtr + ', i32 0, i32 0');

        tctx.write('store ' + funcType + ' ' + _node(this.base, env, ctx, tctx) + ', ' + funcType + '* ' + funcLocPtr + ', align ' + getAlignment(type) + ' ; funcref:base');

        var ctxLocPtr = tctx.getRegister();
        tctx.write(ctxLocPtr + ' = getelementptr inbounds ' + typeName + ' ' + regPtr + ', i32 0, i32 1');
        if (this.ctx && !(this.ctx.type === 'Literal' && this.ctx.value === null)) {
            var ctxType = this.ctx.getType(ctx);
            var ctxTypeName = getLLVMType(ctxType);
            var ctxCastLocPtr = tctx.getRegister();
            tctx.write(ctxCastLocPtr + ' = bitcast ' + ctxTypeName + ' ' + _node(this.ctx, env, ctx, tctx) + ' to i8*');
            tctx.write('store i8* ' + ctxCastLocPtr + ', i8** ' + ctxLocPtr + ', align 8 ; funcref:ctx');
        } else {
            tctx.write('store i8* null, i8** ' + ctxLocPtr + ', align 8 ; funcref:ctx');
        }

        return regPtr;
    },
    Member: function(env, ctx, tctx, extra) {
        var baseType = this.base.getType(ctx);
        var base;
        if (baseType._type === 'module') {
            return '@' + makeName(baseType.memberMapping[this.child]);
        }

        if (baseType._type === '_stdlib') {
            var stdlibName = 'stdlib.' + baseType.name + '.' + this.child;
            stdlibFuncs.registerFunc(env, stdlibName);
            return '@' + stdlibName;
        }

        if (baseType._type === '_foreign') {
            env.foreigns.push(this.child);
            if (!(this.child in env.__foreignRequested)) {
                env.__foreignRequested[this.child] = true;
                var funcVal = externalFuncs[this.child](env); // Don't inline this into the next line
                env.__globalPrefix += funcVal + '\n';
            }

            return '@foreign_' + makeName(this.child);
        }

        if (baseType._type === '_foreign_curry') {
            return _node(this.base, env, ctx, tctx);
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            var type = this.getType(ctx);
            var typeName = getLLVMType(type);

            var funcType = getFunctionSignature(type);

            if (!(typeName in env.__funcrefTypes)) {
                env.__globalPrefix += '\n' + typeName.substr(0, typeName.length - 1) + ' = type { ' + funcType + ', i8* }'
                env.__funcrefTypes[typeName] = true;
            }

            var reg = tctx.getRegister();
            tctx.write(reg + ' = call i8* @malloc(i32 16)'); // 16 is just to be safe for 64 bit
            var regPtr = tctx.getRegister();
            tctx.write(regPtr + ' = bitcast i8* ' + reg + ' to ' + typeName);

            var funcLocPtr = tctx.getRegister();
            tctx.write(funcLocPtr + ' = getelementptr inbounds ' + typeName + ' ' + regPtr + ', i32 0, i32 0');
            tctx.write('store ' + funcType + ' @' + makeName(baseType.getMethod(this.child)) + ', ' + funcType + '* ' + funcLocPtr + ' ; member:method:func');

            var baseLocPtr = tctx.getRegister();
            tctx.write(baseLocPtr + ' = getelementptr inbounds ' + typeName + ' ' + regPtr + ', i32 0, i32 1');
            var baseTypeName = getLLVMType(baseType);
            base = _node(this.base, env, ctx, tctx);
            var baseCastLocPtr = tctx.getRegister();
            tctx.write(baseCastLocPtr + ' = bitcast ' + baseTypeName + ' ' + base + ' to i8*');
            tctx.write('store i8* ' + baseCastLocPtr + ', i8** ' + baseLocPtr + ' ; member:method:self');

            return regPtr;
        }

        if ((baseType._type === 'array' || baseType._type === 'string') && this.child === 'length') {
            base = _node(this.base, env, ctx, tctx);
            var lenRegPtr = tctx.getRegister();
            tctx.write(lenRegPtr + ' = getelementptr inbounds ' + getLLVMType(baseType) + ' ' + base + ', i32 0, i32 0');
            var lenReg = tctx.getRegister();
            tctx.write(lenReg + ' = load i32* ' + lenRegPtr + ', align 4');

            return lenReg;
        }

        var layoutIndex = baseType.getLayoutIndex(this.child);

        base = _node(this.base, env, ctx, tctx);

        var outRegPtr = tctx.getRegister();
        tctx.write(outRegPtr + ' = getelementptr inbounds ' +
            getLLVMType(baseType) + ' ' +
            base + ', i32 0, i32 ' + layoutIndex);

        if (extra === 'lvalue') {
            return outRegPtr;
        }

        var outReg = tctx.getRegister();
        var outType = this.getType(ctx);
        tctx.write(outReg + ' = load ' + getLLVMType(outType) + '* ' + outRegPtr + ', align ' + getAlignment(outType));
        return outReg;
    },
    Assignment: function(env, ctx, tctx) {
        var type = this.value.getType(ctx);
        var typeName = getLLVMType(type);

        var value = _node(this.value, env, ctx, tctx);
        var base = _node(this.base, env, ctx, tctx, 'lvalue');

        var annotation = '';
        if (this.base.type === 'Symbol') {
            annotation = ' ; ' + this.base.name;
        } else if (this.base.type === 'Member') {
            annotation = ' ; ';
            if (this.base.base.type === 'Symbol') annotation += this.base.base.name;
            else annotation += '?';

            annotation += '.';

            annotation += this.base.child;
        }

        tctx.write('store ' + typeName + ' ' + value + ', ' + typeName + '* ' + base + ', align ' + getAlignment(type) + annotation);
    },
    Declaration: function(env, ctx, tctx, parent) {
        var declType = this.getType(ctx);
        var typeName = getLLVMType(declType);

        var annotation = ' ; ' + this.name;
        if (parent === 'root') {
            var globVal = 'null';
            if (this.value.type === 'Literal' && this.value.litType !== 'str') {
                globVal = _node(this.value, env, ctx, tctx);
            }
            tctx.write('@' + makeName(this.__assignedName) + ' = private global ' + getLLVMType(declType) + ' ' + globVal + annotation);
            return;
        }


        var ptrName = '%' + makeName(this.__assignedName);
        if (this.value) {
            tctx.write('store ' + getLLVMType(declType) + ' ' + _node(this.value, env, ctx, tctx) + ', ' + typeName + '* ' + ptrName + ', align ' + getAlignment(declType) + annotation);
        } else {
            tctx.write('store ' + typeName + ' null, ' + typeName + '* ' + ptrName + ', align ' + getAlignment(declType) + annotation);
        }
    },
    Return: function(env, ctx, tctx) {
        if (!this.value) {
            tctx.write('br label %exitLabel');
            tctx.writeTerminatorLabel();
            return;
        }
        var value = _node(this.value, env, ctx, tctx);
        var retTypeRaw = this.value.getType(ctx);
        var retType = getLLVMType(retTypeRaw);
        tctx.write('store ' + retType + ' ' + value + ', ' + retType + '* %retVal, align ' + getAlignment(retTypeRaw) + ' ; return');
        tctx.write('br label %exitLabel');
        tctx.writeTerminatorLabel();
    },
    Export: function() {},
    Import: function() {},
    For: function(env, ctx, tctx) {
        var innerLbl = tctx.getUniqueLabel('inner');
        var afterLbl = tctx.getUniqueLabel('after');

        _node(this.assignment, env, ctx, tctx);

        var loopLbl = tctx.getUniqueLabel('loop');
        tctx.writeLabel(loopLbl);

        tctx.pushLoop(loopLbl, afterLbl);

        var condResult = _node(this.condition, env, ctx, tctx);
        tctx.write('br i1 ' + condResult + ', label %' + innerLbl + ', label %' + afterLbl);
        tctx.writeLabel(innerLbl);

        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + loopLbl);
        tctx.writeLabel(afterLbl);
        tctx.popLoop();
    },
    DoWhile: function(env, ctx, tctx) {
        var loopLbl = tctx.getUniqueLabel('loop');
        var afterLbl = tctx.getUniqueLabel('after');

        tctx.writeLabel(loopLbl);
        tctx.pushLoop(loopLbl, afterLbl);

        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, ctx, tctx);
        });

        var condition = _node(this.condition, env, ctx, tctx);
        tctx.write('br i1 ' + condition + ', label %' + loopLbl + ', label %' + afterLbl);
        tctx.writeLabel(afterLbl);
        tctx.popLoop();
    },
    While: function(env, ctx, tctx) {
        var beforeLbl = tctx.getUniqueLabel('before');
        tctx.writeLabel(beforeLbl);

        var condition = _node(this.condition, env, ctx, tctx);

        var loopLbl = tctx.getUniqueLabel('loop');
        var afterLbl = tctx.getUniqueLabel('after');
        tctx.pushLoop(loopLbl, afterLbl);

        tctx.write('br i1 ' + condition + ', label %' + loopLbl + ', label %' + afterLbl);
        tctx.writeLabel(loopLbl);

        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + afterLbl);
        tctx.writeLabel(afterLbl);
        tctx.popLoop();
    },
    If: function(env, ctx, tctx) {
        var condition = _node(this.condition, env, ctx, tctx);

        var consequentLbl = tctx.getUniqueLabel('conseq');
        var afterLbl = tctx.getUniqueLabel('after');
        var alternateLbl = this.alternate ? tctx.getUniqueLabel('alternate') : afterLbl;

        tctx.write('br i1 ' + condition + ', label %' + consequentLbl + ', label %' + alternateLbl);
        tctx.writeLabel(consequentLbl);

        this.consequent.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, ctx, tctx);
        });

        tctx.write('br label %' + afterLbl);

        if (this.alternate) {
            tctx.writeLabel(alternateLbl);
            this.alternate.forEach(function(stmt) {
                tctx.write('; Statement: ' + stmt.type);
                _node(stmt, env, ctx, tctx);
            });
            tctx.write('br label %' + afterLbl);
        }

        tctx.writeLabel(afterLbl);

    },
    Function: function(env, ctx, tctx) {
        var context = this.__context;
        var funcType = this.getType(ctx);
        var returnType = funcType.getReturnType();
        var returnTypeName = getLLVMType(returnType);

        var annotation = ' ; func:' + (this.name || 'anon');

        tctx.write('define private ' +
            (returnType ? returnTypeName : 'void') +
            ' @' + makeName(this.__assignedName) +
            '(' +
            this.params.map(function(param) {
                return getLLVMType(param.getType(ctx)) + ' %param_' + makeName(param.__assignedName);
            }).join(', ') + ') nounwind ssp uwtable {' +
            annotation
        );

        tctx.push();

        tctx.writeLabel('entry');

        if (returnType) {
            tctx.write('%retVal = alloca ' + returnTypeName + ', align ' + getAlignment(returnType));
        }

        Object.keys(context.typeMap).forEach(function(v) {
            var type = context.typeMap[v];
            tctx.write('%' + makeName(v) + ' = alloca ' + getLLVMType(type) + ', align ' + getAlignment(type));
        });

        this.params.forEach(function(p) {
            var type = p.getType(context);
            var typeName = getLLVMType(type);
            tctx.write('store ' + typeName + ' %param_' + makeName(p.__assignedName) + ', ' + typeName + '* %' + makeName(p.__assignedName) + ' ; param:' + p.name)
        });

        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, context, tctx);
        });

        tctx.write('br label %exitLabel');

        tctx.writeLabel('exitLabel');

        if (returnType) {
            var outReg = tctx.getRegister();
            tctx.write(outReg + ' = load ' + returnTypeName + '* %retVal, align ' + getAlignment(returnType));
            tctx.write('ret ' + returnTypeName + ' ' + outReg);
        } else {
            tctx.write('ret void');
        }

        tctx.pop();

        tctx.write('}\n');
    },
    OperatorStatement: function(env, ctx, tctx) {
        var context = this.__context;
        var funcType = this.getType(ctx);
        var returnType = funcType.getReturnType();
        var returnTypeName = getLLVMType(returnType);

        tctx.write('define private ' +
            getLLVMType(this.returnType.getType(ctx)) +
            ' @' + makeName(this.__assignedName) +
            ' (' +
            getLLVMType(this.left.getType(ctx)) + ' %param_' +  _node(this.left, env, ctx, tctx) + ', ' +
            getLLVMType(this.right.getType(ctx)) + ' %param_' +  _node(this.right, env, ctx, tctx) +
            ') nounwind ssp uwtable alwaysinline {');

        tctx.push();

        tctx.writeLabel('entry');

        var leftName = makeName(this.left.__assignedName);
        var leftType = this.left.getType(ctx);
        var leftTypeName = getLLVMType(leftType);
        var rightName = makeName(this.right.__assignedName);
        var rightType = this.right.getType(ctx);
        var rightTypeName = getLLVMType(rightType);

        Object.keys(context.typeMap).forEach(function(v) {
            var type = context.typeMap[v];
            tctx.write('%' + makeName(v) + ' = alloca ' + getLLVMType(type) + ', align ' + getAlignment(type));
        });

        tctx.write('store ' + leftTypeName + ' %param_' + leftName + ', ' + leftTypeName + '* %' + leftName);
        tctx.write('store ' + rightTypeName + ' %param_' + rightName + ', ' + rightTypeName + '* %' + rightName);

        tctx.write('%retVal = alloca ' + returnTypeName + ', align ' + getAlignment(returnType));

        this.body.forEach(function(stmt) {
            tctx.write('; Statement: ' + stmt.type);
            _node(stmt, env, context, tctx);
        });

        tctx.write('br label %exitLabel');

        tctx.writeLabel('exitLabel');

        var outReg = tctx.getRegister();
        tctx.write(outReg + ' = load ' + returnTypeName + '* %retVal, align ' + getAlignment(returnType));
        tctx.write('ret ' + returnTypeName + ' ' + outReg);

        tctx.pop();

        tctx.write('}\n');
    },
    TypedIdentifier: function(env, ctx, tctx) {
        return makeName(this.__assignedName);
    },
    Literal: function(env, ctx, tctx) {
        if (this.litType === 'str') {
            var strLitIdent = '@string.' + makeName(env.getStrLiteralIdentifier(this.value));

            var strPtr = tctx.getRegister();
            tctx.write(strPtr + ' = call i8* @malloc(i32 16)');
            var castStrPtr = tctx.getRegister();
            tctx.write(castStrPtr + ' = bitcast i8* ' + strPtr + ' to %string*');
            var lenPtr = tctx.getRegister();
            tctx.write(lenPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 0');
            tctx.write('store i32 ' + this.value.length + ', i32* ' + lenPtr);
            var capacityPtr = tctx.getRegister();
            tctx.write(capacityPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 1');
            tctx.write('store i32 ' + this.value.length + ', i32* ' + capacityPtr);

            var strBodyPtr = tctx.getRegister();
            tctx.write(strBodyPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 2');
            tctx.write('store i16* getelementptr inbounds ([' + (this.value.length + 1) + ' x i16]* ' + strLitIdent + ', i32 0, i32 0), i16** ' + strBodyPtr + ', align 4');

            return castStrPtr;
        }

        if (this.value === true) return 'true';
        if (this.value === false) return 'false';
        if (this.value === null) return 'null';
        return this.value.toString();
    },
    Symbol: function(env, ctx, tctx, extra) {
        if (this.__isFunc) {
            return '@' + makeName(this.__refName);
        }

        var rootContext = ctx.parent;
        while (rootContext.parent) rootContext = rootContext.parent;

        if (extra === 'lvalue') {
            return (this.__refContext === rootContext ? '@' : '%') + makeName(this.__refName);
        }

        var reg = tctx.getRegister();
        var type = this.getType(ctx);

        var alignment = ', align ' + getAlignment(type);

        if (this.__refContext === rootContext) {
            tctx.write(reg + ' = load ' + getLLVMType(type) + '* @' + makeName(this.__refName) + alignment);
        } else {
            tctx.write(reg + ' = load ' + getLLVMType(type) + '* %' + makeName(this.__refName) + alignment);
        }
        return reg;
    },
    New: function(env, ctx, tctx) {
        var type = this.getType(ctx);
        var targetType = getLLVMType(type);

        if (type._type === 'array') {

            var flatTypeName = type.flatTypeName();
            if (!(flatTypeName in env.__arrayTypes)) {
                env.__arrayTypes[flatTypeName] = type;
            }

            var length = _node(this.params[0], env, ctx, tctx);
            var arr = tctx.getRegister();
            tctx.write(arr + ' = call ' + targetType + ' @btmake_' + targetType.substr(1, targetType.length - 2) + '(i32 ' + length + ')');
            return arr;
        }

        var size = type.getSize();
        var reg = tctx.getRegister();
        tctx.write(reg + ' = call i8* @malloc(i32 ' + size + ')');
        var ptrReg = tctx.getRegister();
        tctx.write(ptrReg + ' = bitcast i8* ' + reg + ' to ' + targetType);

        tctx.write('call void @btinit_' + targetType.substr(1, targetType.length - 2) + '(' + targetType + ' ' + ptrReg + ')');

        if (type instanceof types.Struct && type.objConstructor) {
            var params = [
                targetType + ' ' + ptrReg,
                this.params.map(function(p) {
                    return getLLVMType(p.getType(ctx)) + ' ' + _node(p, env, ctx, tctx);
                }).join(', '),
            ].join(', ');

            tctx.write('call void @' + makeName(type.objConstructor) + '(' + params + ')');
        }
        return ptrReg;
    },

    Break: function() {
        tctx.write('br label %' + this.loopStack[0].exitLabel);
    },
    Continue: function() {
        tctx.write('br label %' + this.loopStack[0].startLabel);
    },

    ObjectDeclaration: function(env, ctx, tctx) {
        if (!this.__isConstructed) return;
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
        _node(this.base, env, ctx, tctx);
    },

    TypeCast: function(env, ctx, tctx) {
        var baseType = this.left.getType(ctx);
        var baseTypeName = getLLVMType(baseType);
        var targetType = this.rightType.getType(ctx);
        var targetTypeName = getLLVMType(targetType);

        var base = _node(this.left, env, ctx, tctx);
        if (baseType.equals(targetType)) return base;

        var resPtr = tctx.getRegister();

        switch (baseType.typeName) {
            case 'int':
                switch (targetType.typeName) {
                    case 'float':
                    case 'sfloat':
                        tctx.write(resPtr + ' = sitofp ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'byte':
                        tctx.write(resPtr + ' = trunc ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'bool':
                        tctx.write(resPtr + ' = icmp ne ' + baseTypeName + ' ' + base + ', 0');
                        return resPtr;
                }
            case 'uint':
                switch (targetType.typeName) {
                    case 'float':
                    case 'sfloat':
                        tctx.write(resPtr + ' = uitofp ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'byte':
                        tctx.write(resPtr + ' = trunc ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'bool':
                        tctx.write(resPtr + ' = icmp ne ' + baseTypeName + ' ' + base + ', 0')
                        return resPtr;
                }
            case 'sfloat':
                switch (targetType.typeName) {
                    case 'int':
                        tctx.write(resPtr + ' = fptosi ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'float':
                        tctx.write(resPtr + ' = fext ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'byte':
                    case 'uint':
                        tctx.write(resPtr + ' = fptoui ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'bool':
                        tctx.write(resPtr + ' = fcmp one ' + baseTypeName + ' ' + base + ', 0.0')
                        return resPtr;
                }
            case 'float':
                switch (targetType.typeName) {
                    case 'int':
                        tctx.write(resPtr + ' = fptosi ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'uint':
                    case 'byte':
                        tctx.write(resPtr + ' = fptoui ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'bool':
                        tctx.write(resPtr + ' = fcmp one ' + baseTypeName + ' ' + base + ', 0.0')
                        return resPtr;
                    case 'sfloat':
                        tctx.write(resPtr + ' = fptrunc ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                }
            case 'byte':
                switch (targetType.typeName) {
                    case 'int':
                        tctx.write(resPtr + ' = sext ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'uint':
                        tctx.write(resPtr + ' = zext ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'float':
                    case 'sfloat':
                        tctx.write(resPtr + ' = uitofp ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'bool':
                        tctx.write(resPtr + ' = icmp ne ' + baseTypeName + ' ' + base + ', 0')
                        return resPtr;
                }
            case 'bool':
                switch (targetType.typeName) {
                    case 'int':
                    case 'uint':
                    case 'byte':
                        tctx.write(resPtr + ' = zext ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                    case 'float':
                    case 'sfloat':
                        tctx.write(resPtr + ' = uitofp ' + baseTypeName + ' ' + base + ' to ' + targetTypeName);
                        return resPtr;
                }
        }

        return base;
    },

    Subscript: function(env, ctx, tctx, parent) {
        var baseType = this.base.getType(ctx);
        var subscriptType = this.subscript.getType(ctx);

        var base;
        var subscript;

        var temp;
        if ((temp = env.registeredOperators[baseType.flatTypeName()]) &&
            (temp = temp[subscriptType.flatTypeName()]) &&
            '[]' in temp) {

            var operatorStmtFunc = ctx.env.registeredOperators[baseType.flatTypeName()][subscriptType.flatTypeName()]['[]'];

            base = _node(this.base, env, ctx, tctx);
            subscript = _node(this.subscript, env, ctx, tctx);

            var outReg = tctx.getRegister();
            tctx.write(outReg + ' = call ' + getLLVMType(this.getType(ctx)) + ' @' + makeName(operatorStmtFunc) + '(' +
                getLLVMType(baseType) + ' ' + base + ', ' +
                getLLVMType(subscriptType) + ' ' + subscript +
                ')');
            return outReg;
        }


        if (baseType._type !== 'array' && baseType._type !== 'tuple') {
            throw new Error('Cannot subscript non-arrays in llvmir');
        }

        var childType;
        var posPtr;
        var valReg;

        base = _node(this.base, env, ctx, tctx);

        if (baseType._type === 'tuple') {
            // TODO: make this validate the subscript?
            childType = baseType.contentsTypeArr[this.subscript.value];

            posPtr = tctx.getRegister();
            tctx.write(posPtr + ' = getelementptr inbounds ' + getLLVMType(baseType) + ' ' + base + ', i32 0, i32 ' + this.subscript.value);
            valReg = tctx.getRegister();
            tctx.write(valReg + ' = load ' + getLLVMType(childType) + '* ' + posPtr + ', align ' + getAlignment(childType));
            return valReg;
        }

        childType = baseType.contentsType;
        var child = _node(this.subscript, env, ctx, tctx);

        posPtr = tctx.getRegister();
        tctx.write(posPtr + ' = getelementptr inbounds ' + getLLVMType(baseType) + ' ' + base + ', i32 0, i32 1, i64 ' + child);
        valReg = tctx.getRegister();
        tctx.write(valReg + ' = load ' + getLLVMType(childType) + '* ' + posPtr + ', align ' + getAlignment(childType));

        return valReg;
    },

    TupleLiteral: function(env, ctx, tctx) {
        var type = this.getType(ctx);
        var typeName = getLLVMType(type);

        var flatTypeName = type.flatTypeName();
        if (!(flatTypeName in env.__arrayTypes)) {
            env.__tupleTypes[flatTypeName] = type;
        }

        var size = type.getSize() + 8;
        var reg = tctx.getRegister();
        tctx.write(reg + ' = call i8* @malloc(i32 ' + size + ')');
        var ptrReg = tctx.getRegister();
        tctx.write(ptrReg + ' = bitcast i8* ' + reg + ' to ' + typeName);

        // Assign all the tuple values
        this.content.forEach(function(exp, i) {
            var value = _node(exp, env, ctx, tctx);
            var valueType = getLLVMType(exp.getType(ctx));

            var pReg = tctx.getRegister();
            tctx.write(pReg + ' = getelementptr inbounds ' + typeName + ' ' + ptrReg + ', i32 0, i32 ' + i);
            tctx.write('store ' + valueType + ' ' + value + ', ' + valueType + '* ' + pReg);
        });

        return ptrReg;
    },
};

module.exports = function translate(ctx) {
    var tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
