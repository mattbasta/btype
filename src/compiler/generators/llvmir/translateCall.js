import * as hlirNodes from '../../../hlirNodes';
import * as symbols from '../../../symbols';
import {_node} from './translate';
import Func from '../../types/Func';
import Module from '../../types/Module';
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

        let mod = baseType.mod;
        if (baseType instanceof Module &&
            mod.functionDeclarations.get(mod.exports.get(this.callee.child))[symbols.IS_FIRSTCLASS]) {
            return translateDeclarationCall.call(this, env, ctx, tctx, extra);
        }
    }

    if (this.callee instanceof hlirNodes.SymbolHLIR &&
        this.callee[symbols.REFCONTEXT].functionDeclarations.has(this.callee[symbols.REFNAME])) {
        // This is a simple x() where x references a function declaration
        return translateDeclarationCall.call(this, env, ctx, tctx, extra);

    } else if (!(this.callee.resolveType(ctx) instanceof Func)) {
        // This is probably a call to a foreign/stdlib generated function
        return translateDeclarationCall.call(this, env, ctx, tctx, extra);

    } else {
        // console.log(this.toString());
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
        // TODO: Is this correct?
        output += 'void ';
    } else {
        output += getLLVMType(this.resolveType(ctx)) + ' ';
    }

    output += _node(this.callee, env, ctx, tctx, 'callee');

    output += '(';

    output += this.params.map(param => {
        return getLLVMType(param.resolveType(ctx)) + ' ' + _node(param, env, ctx, tctx);
    }).join(', ');

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
    // console.log(type);
    var typeName = getLLVMType(type);

    var typeRefName = getFunctionSignature(type);

    var params;

    var callBody;

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
        var type = p.resolveType(ctx);
        var typeName = getLLVMType(type);
        return typeName + ' ' + _node(p, env, ctx, tctx);
    }).join(', ');

    var isNullCmpReg = tctx.getRegister();
    tctx.write(isNullCmpReg + ' = icmp eq i8* ' + ctxReg + ', null');

    var returnTypeRaw = this.resolveType(ctx);
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
}
