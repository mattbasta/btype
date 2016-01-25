import {_node} from './translate';
import Func from '../../types/Func';
import * as hlirNodes from '../../../hlirNodes';
import Module from '../../types/Module';
import * as symbols from '../../../symbols';
import {getAlignment, getFunctionSignature, getLLVMType, makeName} from './util';


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
    var params = this.params.map(p => {
        return getLLVMType(p.resolveType(ctx)) + ' ' + _node(p, env, ctx, tctx);
    }).join(', ');

    var callBody = 'call ' +
        getLLVMType(this.resolveType(ctx)) + ' @' +
        makeName(baseType.getMethod(this.callee.child)) + '(' +
        getLLVMType(this.callee.base.resolveType(ctx)) + ' ' +
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
    output += this.params.map(p => `${getLLVMType(p.resolveType(ctx))} ${_node(p, env, ctx, tctx)}`).join(', ');
    output += ')';

    if (extra === 'stmt') {
        tctx.write(output);
        return;
    }

    let outReg = tctx.getRegister();
    output = outReg + output;
    tctx.write(output);
    return outReg;
}

function translateRefCall(env, ctx, tctx, extra) {
    var type = this.callee.resolveType(ctx);
    var typeName = getLLVMType(type);

    var typeRefName = getFunctionSignature(type);

    var callee = _node(this.callee, env, ctx, tctx);

    var funcPtrReg = tctx.getRegister();
    tctx.write(`${funcPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 0`);
    var funcReg = tctx.getRegister();
    tctx.write(`${funcReg} = load ${typeRefName}* ${funcPtrReg}, align ${getAlignment(type)}`);
    var ctxPtrReg = tctx.getRegister();
    tctx.write(`${ctxPtrReg} = getelementptr inbounds ${typeName} ${callee}, i32 0, i32 1`);
    var ctxReg = tctx.getRegister();
    tctx.write(`${ctxReg} = load i8** ${ctxPtrReg}`);

    var params = this.params.map(p => `${getLLVMType(p.resolveType(ctx))} ${_node(p, env, ctx, tctx)}`).join(', ');

    var isNullCmpReg = tctx.getRegister();
    tctx.write(`${isNullCmpReg} = icmp eq i8* ${ctxReg}, null`);

    var returnTypeRaw = this.resolveType(ctx);
    var returnType = getLLVMType(returnTypeRaw);
    var callRetPtr = tctx.getRegister();
    tctx.write(callRetPtr + ' = alloca ' + returnType);

    var nullLabel = tctx.getUniqueLabel('isnull');
    var unnullLabel = tctx.getUniqueLabel('unnull');
    var afternullLabel = tctx.getUniqueLabel('afternull');

    tctx.write(`br i1 ${isNullCmpReg}, label %${nullLabel}, label %${unnullLabel}`);

    tctx.writeLabel(nullLabel);

    var callBody;
    if (this.params.length === type.args.length - 1) {
        let selflessFuncType = getFunctionSignature(type, true); // true -> no `self`/`ctx` param
        let selflessFuncReg = tctx.getRegister();
        tctx.write(`${selflessFuncReg} = bitcast ${typeRefName} ${funcReg} to ${selflessFuncType} ; callref:selfless_downcast`);

        callBody = `call ${returnType} ${selflessFuncReg}(${params})`;

    } else {
        callBody = `call ${typeRefName} ${funcReg}(${params})`;

    }

    if (extra === 'stmt') {
        tctx.write(callBody);
    } else {
        let nullRetPtr = tctx.getRegister();
        tctx.write(`${nullRetPtr} = ${callBody}`);
        tctx.write(`store ${returnType} ${nullRetPtr}, ${returnType}* ${callRetPtr}, align 8`);
    }

    tctx.write('br label %' + afternullLabel);

    tctx.writeLabel(unnullLabel);

    if (this.params.length === type.args.length) {
        // If we get here, it means there's a non-null context on a
        // function with no room to accept a context.

        tctx.getRegister(); // waste a register for `unreachable`
        tctx.write('unreachable');
    } else {
        let castCtxReg = tctx.getRegister();
        let ctxRegType = getLLVMType(type.args[0]);
        tctx.write(castCtxReg + ' = bitcast i8* ' + ctxReg + ' to ' + ctxRegType);

        callBody = `call ${typeRefName} ${funcReg}(${ctxRegType} ${castCtxReg}${(this.params.length ? ', ' : '')}${params})`;

        if (extra === 'stmt') {
            tctx.write(callBody);
        } else {
            let unnullRetPtr = tctx.getRegister();
            tctx.write(`${unnullRetPtr} = ${callBody}`);
            tctx.write(`store ${returnType} ${unnullRetPtr}, ${returnType}* ${callRetPtr}, align 8`);
        }

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
