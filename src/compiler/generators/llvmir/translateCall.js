import {_node} from './translate';
import Func from '../../types/Func';
import * as hlirNodes from '../../../hlirNodes';
import Module from '../../types/Module';
import * as symbols from '../../../symbols';
import {getAlignment, getFunctionSignature, getLLVMType, getLLVMParamType, makeName} from './util';


export default function translateCall(env, ctx, tctx, extra) {
    // Check whether this is a call to a method.
    // Method calls will always be callees that are MemberHLIR, and
    // resolving the type and checking `hasMethod` will return true.
    if (this.callee instanceof hlirNodes.MemberHLIR) {
        let baseType = this.callee.base.resolveType(ctx);
        if (baseType.hasMethod(this.callee.child)) {
            return translateMethodCall.call(this, env, ctx, tctx, extra, baseType);
        }

        if (baseType instanceof Module &&
            !baseType.mod.functionDeclarations.get(
                baseType.mod.exports.get(this.callee.child))[symbols.IS_FIRSTCLASS]) {
            return translateDeclarationCall.call(this, env, ctx, tctx, extra);
        }
    }

    if (this.callee instanceof hlirNodes.SymbolHLIR &&
        this.callee[symbols.REFCONTEXT].functionDeclarations.has(this.callee[symbols.REFNAME])) {
        // This is a simple x() where x references a function declaration
        return translateDeclarationCall.call(this, env, ctx, tctx, extra);

    } else if (!(this.callee.resolveType(ctx) instanceof Func) ||
               this.callee instanceof hlirNodes.MemberHLIR &&
               this.callee.base.resolveType(ctx)._type === '_stdlib') {
        // This is a call to a foreign or stdlib function
        return translateDeclarationCall.call(this, env, ctx, tctx, extra);

    } else {
        return translateRefCall.call(this, env, ctx, tctx, extra);
    }
};

function translateMethodCall(env, ctx, tctx, extra, baseType) {
    var methodBase = _node(this.callee.base, env, ctx, tctx);

    var baseAsI8 = tctx.getRegister();
    var calleeBaseType = getLLVMType(this.callee.base.resolveType(ctx));
    tctx.write(`${baseAsI8} = bitcast ${calleeBaseType} ${methodBase} to i8*`);

    var params = this.params.map(p => {
        return getLLVMType(p.resolveType(ctx)) + ' ' + _node(p, env, ctx, tctx);
    }).join(', ');

    var callBody = 'call ' +
        getLLVMType(this.resolveType(ctx)) + ' @' +
        makeName(baseType.getMethod(this.callee.child)) + '(i8* ' +
        baseAsI8 + (params ? ', ' : '') +
        params + ') ; call:method';

    if (extra === 'stmt') {
        tctx.write(callBody);
        return;
    }

    var outReg = tctx.getRegister();
    tctx.write(outReg + ' = ' + callBody);
    return outReg;
}

function translateDeclarationCall(env, ctx, tctx, extra) {
    var output = extra === 'stmt' ? 'call ' : ' = call ';

    // Add the expected return type
    if (extra === 'stmt') {
        // Tell LLVM that we don't care about the return type because this
        // is a call statement.
        output += 'void ';
    } else {
        output += getLLVMType(this.resolveType(ctx)) + ' ';
    }

    output += _node(this.callee, env, ctx, tctx, 'callee');

    output += '(';
    output += this.params.map(p => {
        var ptr = _node(p, env, ctx, tctx);
        var ptrType = p.resolveType(ctx);
        if (ptrType[symbols.IS_CTX_OBJ]) {
            let bitcastReg = tctx.getRegister();
            tctx.write(`${bitcastReg} = bitcast ${getLLVMType(ptrType)} ${ptr} to i8*`);
            return `i8* ${bitcastReg}`;
        }
        return `${getLLVMType(ptrType)} ${ptr}`;
    }).join(', ');
    output += ')';

    if (extra === 'stmt') {
        tctx.write(output);
        return;
    }

    let outReg = tctx.getRegister();
    tctx.write(`${outReg}${output} ; call:decl`);
    return outReg;
}

function translateRefCall(env, ctx, tctx, extra) {
    tctx.write('; funcref:call')
    var type = this.callee.resolveType(ctx);
    var typeName = getLLVMType(type);

    var callee = _node(this.callee, env, ctx, tctx);

    var funcPtrReg = tctx.getRegister();
    tctx.write(`${funcPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 0`);
    var rawFuncReg = tctx.getRegister();
    tctx.write(`${rawFuncReg} = load i8** ${funcPtrReg}, align ${getAlignment(type)} ; funcload`);

    var ctxPtrReg = tctx.getRegister();
    tctx.write(`${ctxPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 1`);
    var ctxReg = tctx.getRegister();
    tctx.write(`${ctxReg} = load i8** ${ctxPtrReg}`);

    var params = this.params.map(p => {
        var node = _node(p, env, ctx, tctx);
        var ptype = p.resolveType(ctx);
        if (ptype[symbols.IS_SELF_PARAM]) {
            let reg = tctx.getRegister();
            tctx.write(`${reg} = bitcast ${getLLVMType(ptype)} ${node} to i8*`);
            node = reg;
        }
        return `${getLLVMParamType(ptype)} ${node}`;
    }).join(', ');

    var isNullCmpReg = tctx.getRegister();
    tctx.write(`${isNullCmpReg} = icmp eq i8* ${ctxReg}, null`);

    var returnTypeRaw = this.resolveType(ctx);
    var returnType = getLLVMType(returnTypeRaw);
    var callRetPtr = tctx.getRegister();
    tctx.write(`${callRetPtr} = alloca ${returnType}`);

    var nullLabel = tctx.getUniqueLabel('isnull');
    var unnullLabel = tctx.getUniqueLabel('unnull');
    var afternullLabel = tctx.getUniqueLabel('afternull');

    tctx.write(`br i1 ${isNullCmpReg}, label %${nullLabel}, label %${unnullLabel}`);

    tctx.writeLabel(nullLabel);

    var nullFuncReg = tctx.getRegister();
    tctx.write(`${nullFuncReg} = bitcast i8* ${rawFuncReg} to ${getFunctionSignature(type)}`);
    var callBody = `call ${returnType} ${nullFuncReg}(${params}) ; call:ref:null`;

    if (extra === 'stmt') {
        tctx.write(callBody);
    } else {
        let nullRetPtr = tctx.getRegister();
        tctx.write(`${nullRetPtr} = ${callBody}`);
        tctx.write(`store ${returnType} ${nullRetPtr}, ${returnType}* ${callRetPtr}, align 8`);
    }

    tctx.write('br label %' + afternullLabel);

    tctx.writeLabel(unnullLabel);

    var funcReg = tctx.getRegister();
    var unnullCtx = {[symbols.IS_CTX_OBJ]: true}; // Just a dumb flag that generates an i8*
    var unnullFuncType = new Func(type.returnType, [unnullCtx].concat(type.args));
    tctx.write(`${funcReg} = bitcast i8* ${rawFuncReg} to ${getFunctionSignature(unnullFuncType)}`);
    callBody = `call ${returnType} ${funcReg}(i8* ${ctxReg}${params ? ', ' : ''}${params}) ; call:ref:unnull`;

    if (extra === 'stmt') {
        tctx.write(callBody);
    } else {
        let unnullRetPtr = tctx.getRegister();
        tctx.write(`${unnullRetPtr} = ${callBody}`);
        tctx.write(`store ${returnType} ${unnullRetPtr}, ${returnType}* ${callRetPtr}, align 8`);
    }

    tctx.write('br label %' + afternullLabel);

    tctx.writeLabel(afternullLabel);

    if (extra === 'stmt') {
        return;
    }

    var callRet = tctx.getRegister();
    tctx.write(`${callRet} = load ${returnType}* ${callRetPtr}, align ${getAlignment(returnTypeRaw)}`);
    return callRet;
}
