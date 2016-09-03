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
        const baseType = this.callee.base.resolveType(ctx);
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

function callOrInvoke(ctx) {
    if (ctx.scope instanceof hlirNodes.RootHLIR) {
        return 'call';
    }
    while (!(ctx.scope instanceof hlirNodes.FunctionHLIR)) {
        ctx = ctx.parent;
        if (!ctx) {
            return 'call';
        }
    }
    if (ctx.scope.catches.length || ctx.scope.finally) {
        return 'invoke';
    }
    return 'call';
}

function invokeSuffix(tctx) {
    const afterLabel = tctx.getUniqueLabel();
    return [afterLabel, `to label ${afterLabel} unwind label catchstart`];
}

function translateMethodCall(env, ctx, tctx, extra, baseType) {
    const methodBase = _node(this.callee.base, env, ctx, tctx);

    const baseAsI8 = tctx.getRegister();
    const calleeBaseType = getLLVMType(this.callee.base.resolveType(ctx));
    tctx.write(`${baseAsI8} = bitcast ${calleeBaseType} ${methodBase} to i8*`);

    const params = this.params.map(p => {
        return getLLVMType(p.resolveType(ctx)) + ' ' + _node(p, env, ctx, tctx);
    }).join(', ');

    const coi = callOrInvoke(ctx);
    let callBody = coi + ' ' +
        getLLVMType(this.resolveType(ctx)) + ' @' +
        makeName(baseType.getMethod(this.callee.child)) + '(i8* ' +
        baseAsI8 + (params ? ', ' : '') +
        params + ')';

    let afterLabel = null;
    if (coi === 'invoke') {
        const [alab, isuf] = invokeSuffix(tctx);
        callBody += isuf;
        afterLabel = alab;
    }

    callBody += ' ; call:method';

    if (extra === 'stmt') {
        tctx.write(callBody);
        if (afterLabel) {
            tctx.writeLabel(afterLabel);
        }
        return;
    }

    const outReg = tctx.getRegister();
    tctx.write(`${outReg} = ${callBody}`);
    if (afterLabel) {
        tctx.writeLabel(afterLabel);
    }
    return outReg;
}

function translateDeclarationCall(env, ctx, tctx, extra) {
    const coi = callOrInvoke(ctx);
    let output = extra === 'stmt' ? `${coi} ` : ` = ${coi} `;

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
        const ptr = _node(p, env, ctx, tctx);
        const ptrType = p.resolveType(ctx);
        if (ptrType[symbols.IS_CTX_OBJ]) {
            const bitcastReg = tctx.getRegister();
            tctx.write(`${bitcastReg} = bitcast ${getLLVMType(ptrType)} ${ptr} to i8*`);
            return `i8* ${bitcastReg}`;
        }
        return `${getLLVMType(ptrType)} ${ptr}`;
    }).join(', ');
    output += ')';

    let afterLabel = null;
    if (coi === 'invoke') {
        const [alab, isuf] = invokeSuffix(tctx);
        output += isuf;
        afterLabel = alab;
    }

    if (extra === 'stmt') {
        tctx.write(output);
        if (afterLabel) {
            tctx.writeLabel(afterLabel);
        }
        return;
    }

    const outReg = tctx.getRegister();
    tctx.write(`${outReg}${output} ; call:decl`);
    if (afterLabel) {
        tctx.writeLabel(afterLabel);
    }
    return outReg;
}

function translateRefCall(env, ctx, tctx, extra) {
    const coi = callOrInvoke(ctx);

    tctx.write('; funcref:call')
    const type = this.callee.resolveType(ctx);
    const typeName = getLLVMType(type);

    const callee = _node(this.callee, env, ctx, tctx);

    const funcPtrReg = tctx.getRegister();
    tctx.write(`${funcPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 0`);
    const rawFuncReg = tctx.getRegister();
    tctx.write(`${rawFuncReg} = load i8** ${funcPtrReg}, align ${getAlignment(type)} ; funcload`);

    const ctxPtrReg = tctx.getRegister();
    tctx.write(`${ctxPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 1`);
    const ctxReg = tctx.getRegister();
    tctx.write(`${ctxReg} = load i8** ${ctxPtrReg}`);

    const params = this.params.map(p => {
        let node = _node(p, env, ctx, tctx);
        const ptype = p.resolveType(ctx);
        if (ptype[symbols.IS_SELF_PARAM]) {
            let reg = tctx.getRegister();
            tctx.write(`${reg} = bitcast ${getLLVMType(ptype)} ${node} to i8*`);
            node = reg;
        }
        return `${getLLVMParamType(ptype)} ${node}`;
    }).join(', ');

    const isNullCmpReg = tctx.getRegister();
    tctx.write(`${isNullCmpReg} = icmp eq i8* ${ctxReg}, null`);

    const returnTypeRaw = this.resolveType(ctx);
    const returnType = getLLVMType(returnTypeRaw);
    const callRetPtr = tctx.getRegister();
    tctx.write(`${callRetPtr} = alloca ${returnType}`);

    const nullLabel = tctx.getUniqueLabel('isnull');
    const unnullLabel = tctx.getUniqueLabel('unnull');
    const afternullLabel = tctx.getUniqueLabel('afternull');

    tctx.write(`br i1 ${isNullCmpReg}, label %${nullLabel}, label %${unnullLabel}`);

    tctx.writeLabel(nullLabel);

    const nullFuncReg = tctx.getRegister();
    let nullFuncType = type;
    if (type.args.length && type.args[0][symbols.IS_SELF_PARAM]) {
        nullFuncType = new Func(type.returnType, type.args.slice(1));
    }
    tctx.write(`${nullFuncReg} = bitcast i8* ${rawFuncReg} to ${getFunctionSignature(nullFuncType)}`);
    let callBody = `${coi} ${returnType} ${nullFuncReg}(${params}) ; call:ref:null`;

    if (extra === 'stmt') {
        tctx.write(callBody);
    } else {
        let nullRetPtr = tctx.getRegister();
        tctx.write(`${nullRetPtr} = ${callBody}`);
        tctx.write(`store ${returnType} ${nullRetPtr}, ${returnType}* ${callRetPtr}, align 8`);
    }

    tctx.write('br label %' + afternullLabel);

    tctx.writeLabel(unnullLabel);

    const funcReg = tctx.getRegister();
    const unnullCtx = {[symbols.IS_CTX_OBJ]: true}; // Just a dumb flag that generates an i8*
    let unnullFuncType = type;
    if (!type.args.length || !(type.args[0][symbols.IS_SELF_PARAM] || type.args[0][symbols.IS_CTX_OBJ])) {
        unnullFuncType = new Func(type.returnType, [unnullCtx].concat(type.args));
    }
    tctx.write(`${funcReg} = bitcast i8* ${rawFuncReg} to ${getFunctionSignature(unnullFuncType)}`);
    callBody = `${coi} ${returnType} ${funcReg}(i8* ${ctxReg}${params ? ', ' : ''}${params}) ; call:ref:unnull`;

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

    const callRet = tctx.getRegister();
    tctx.write(`${callRet} = load ${returnType}* ${callRetPtr}, align ${getAlignment(returnTypeRaw)}`);
    return callRet;
}
