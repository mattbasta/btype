import * as externalFuncs from './externalFuncs';
import Func from '../../types/Func';
import * as hlirNodes from '../../../hlirNodes';
import * as stdlibFuncs from './stdlibFuncs';
import Struct from '../../types/Struct';
import * as symbols from '../../../symbols';
import translateCall from './translateCall';
import TranslationContext from './TranslationContext';
import * as types from '../../types';
import {getAlignment, getFunctionSignature, getLLVMType, getLLVMParamType, makeName} from './util';


export const GLOBAL_PREFIX = Symbol();
export const FOREIGN_REQUESTED = Symbol();
export const ARRAY_TYPES = Symbol();
export const TUPLE_TYPES = Symbol();
export const FUNCREF_TYPES = Symbol();

const FUNC_LAST_BODY = Symbol();


function _binop(env, ctx, tctx) {
    const left = _node(this.left, env, ctx, tctx);
    const right = _node(this.right, env, ctx, tctx);

    const outType = this.resolveType(ctx);

    const leftType = this.left.resolveType(ctx);
    const rightType = this.right.resolveType(ctx);

    if (leftType && rightType) {
        const leftTypeString = leftType.flatTypeName();
        const rightTypeString = rightType.flatTypeName();

        if (ctx.env.registeredOperators.get(leftTypeString) &&
            ctx.env.registeredOperators.get(leftTypeString).get(rightTypeString) &&
            ctx.env.registeredOperators.get(leftTypeString).get(rightTypeString).get(this.operator)) {

            let operatorStmtFunc = ctx.env.registeredOperators.get(leftTypeString).get(rightTypeString).get(this.operator);

            const outReg = tctx.getRegister();
            tctx.write(outReg + ' = call ' + getLLVMType(outType) + ' @' + makeName(operatorStmtFunc) + '(' +
                getLLVMType(leftType) + ' ' + left + ', ' +
                getLLVMType(rightType) + ' ' + right +
                ')');
            return outReg;
        }

    }

    let out;

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
            else out = 'icmp ne';
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

    const outReg = tctx.getRegister();
    tctx.write(outReg + ' = ' + out + ' ' + getLLVMType(leftType) + ' ' + left + ', ' + right);
    return outReg;
}

const NODES = new Map();
const IGNORE_NODES = new Set([
    hlirNodes.ExportHLIR,
    hlirNodes.ImportHLIR,
    hlirNodes.ObjectMemberHLIR,
]);

export function _node(node, env, ctx, tctx, extra = null) {
    if (IGNORE_NODES.has(node.constructor)) {
        return '';
    }
    if (!NODES.has(node.constructor)) {
        throw new Error('Unrecognized node: ' + node.constructor.name);
    }
    return NODES.get(node.constructor).call(node, env, ctx, tctx, extra);
}


NODES.set(hlirNodes.RootHLIR, function(env, ctx, tctx) {
    env[GLOBAL_PREFIX] = env[GLOBAL_PREFIX] || '';
    env[FOREIGN_REQUESTED] = env[FOREIGN_REQUESTED] || new Set();
    env[stdlibFuncs.STDLIB_REQUESTED] = env[stdlibFuncs.STDLIB_REQUESTED] || new Set();
    env[ARRAY_TYPES] = env[ARRAY_TYPES] || new Map();
    env[TUPLE_TYPES] = env[TUPLE_TYPES] || new Map();
    env[FUNCREF_TYPES] = env[FUNCREF_TYPES] || new Set();

    this.body.forEach(stmt => {
        tctx.write('; Statement: ' + stmt.constructor.name);
        _node(stmt, env, ctx, tctx, 'root');
    });
    if (env[GLOBAL_PREFIX]) {
        tctx.prepend(env[GLOBAL_PREFIX]);
    }
    env[GLOBAL_PREFIX] = '';
});

NODES.set(hlirNodes.AssignmentHLIR, function(env, ctx, tctx) {
    const type = this.value.resolveType(ctx);
    const typeName = getLLVMType(type);

    const value = _node(this.value, env, ctx, tctx);
    const base = _node(this.base, env, ctx, tctx, 'lvalue');

    let annotation = '';
    if (this.base instanceof hlirNodes.SymbolHLIR) {
        annotation = ' ; ' + this.base.name;
    } else if (this.base instanceof hlirNodes.MemberHLIR) {
        annotation = ' ; ';
        if (this.base.base instanceof hlirNodes.SymbolHLIR) annotation += this.base.base.name;
        else annotation += '?';

        annotation += '.';

        annotation += this.base.child;
    }

    tctx.write('store ' + typeName + ' ' + value + ', ' + typeName + '* ' + base + ', align ' + getAlignment(type) + annotation);
});

NODES.set(hlirNodes.BinopArithmeticHLIR, _binop);
NODES.set(hlirNodes.BinopBitwiseHLIR, _binop);
NODES.set(hlirNodes.BinopEqualityHLIR, _binop);
NODES.set(hlirNodes.BinopLogicalHLIR, _binop);

NODES.set(hlirNodes.BreakHLIR, function(env, ctx, tctx) {
    tctx.write('br label %' + tctx.loopStack[0].exit);
});

// CallHLIR is handled in translateCall.js because it's a beast.
NODES.set(hlirNodes.CallHLIR, translateCall);

NODES.set(hlirNodes.CallStatementHLIR, function(env, ctx, tctx) {
    _node(this.call, env, ctx, tctx, 'stmt');
});

NODES.set(hlirNodes.ContinueHLIR, function(env, ctx, tctx) {
    tctx.write('br label %' + tctx.loopStack[0].start);
});

NODES.set(hlirNodes.DeclarationHLIR, function(env, ctx, tctx, parent) {
    const declType = this.resolveType(ctx);
    const typeName = getLLVMType(declType);
    tctx.write(`; decl:type(${declType.toString()})`)

    const annotation = ` ; ${this.name}`;
    if (parent === 'root') {
        let globVal = 'null';
        if (this.value instanceof hlirNodes.LiteralHLIR && this.value.litType !== 'str') {
            globVal = _node(this.value, env, ctx, tctx);
        }
        tctx.write(
            `@${makeName(this[symbols.ASSIGNED_NAME])} = private global ${getLLVMType(declType)} ${globVal}${annotation}`
        );
        return;
    }


    const ptrName = '%' + makeName(this[symbols.ASSIGNED_NAME]);
    if (this.value) {
        tctx.write('store ' + getLLVMType(declType) + ' ' + _node(this.value, env, ctx, tctx) + ', ' + typeName + '* ' + ptrName + ', align ' + getAlignment(declType) + annotation);
    } else {
        tctx.write('store ' + typeName + ' null, ' + typeName + '* ' + ptrName + ', align ' + getAlignment(declType) + annotation);
    }
});

NODES.set(hlirNodes.FunctionHLIR, function(env, ctx, tctx) {
    const context = this[symbols.CONTEXT];
    const funcType = this.resolveType(ctx);
    const returnType = funcType.getReturnType();
    const returnTypeName = getLLVMType(returnType);

    function getParamSignature(param, i) {
        const type = param.resolveType(ctx);
        if (i === 0 && this[symbols.IS_METHOD]) {
            return `i8* %param_${makeName(param[symbols.ASSIGNED_NAME])}`;
        }
        return `${getLLVMParamType(type)} %param_${makeName(param[symbols.ASSIGNED_NAME])}`;
    }

    const name = makeName(this[symbols.ASSIGNED_NAME]);
    tctx.write(
        `define private ${returnType ? returnTypeName : 'void'} @${name}(` +
        this.params.map(getParamSignature.bind(this)).join(', ') +
        `) nounwind ssp uwtable { ; func:${this.name || 'anon'}`
    );

    tctx.push();

    // I'm not sure why LLVM has a thing for an entry label (it's not used),
    // but not having it makes the register numbering get all wonked up.
    tctx.writeLabel('entry');

    const isLoneReturn = this.body.length === 1 && this.body[0] instanceof hlirNodes.ReturnHLIR;

    if (returnType && !isLoneReturn) {
        tctx.write(`%retVal = alloca ${returnTypeName}, align ${getAlignment(returnType)}`);
    } else if (isLoneReturn) {
        tctx.write('; Skipping retVal because lone return');
    }

    context.typeMap.forEach((type, v) => {
        tctx.write(`%${makeName(v)} = alloca ${getLLVMType(type)}, align ${getAlignment(type)}`);
    });

    this.params.forEach((p, i) => {
        const type = p.resolveType(context);
        const typeName = getLLVMType(type); // This contains the non-funcsig type
        let sourceLoc = `%param_${makeName(p[symbols.ASSIGNED_NAME])}`;

        if (type[symbols.IS_CTX_OBJ] || i === 0 && this[symbols.IS_METHOD]) {
            const castReg = tctx.getRegister();
            tctx.write(`${castReg} = bitcast i8* ${sourceLoc} to ${typeName} ; ctx obj cast`);
            sourceLoc = castReg;
        }
        tctx.write(`store ${typeName} ${sourceLoc}, ${typeName}* %${makeName(p[symbols.ASSIGNED_NAME])} ; param:${p.name}`);
    });

    if (isLoneReturn) {
        tctx.write('; Abridged function; lone return');
        const valueNode = this.body[0].value;
        const valueReg = _node(valueNode, env, ctx, tctx);
        tctx.write(`ret ${returnTypeName} ${valueReg}`);

        tctx.pop();
        tctx.write('}\n');
        return;
    }

    this.body.forEach((stmt, i) => {
        tctx.write('; Statement: ' + stmt.constructor.name);
        _node(stmt, env, context, tctx, i === this.body.length - 1 ? FUNC_LAST_BODY : null);
    });

    if (this.hasMatchingNodeExceptLastReturn(node => node instanceof hlirNodes.ReturnHLIR)) {
        tctx.write('br label %exitLabel');
        tctx.writeLabel('exitLabel');
    } else {
        tctx.write('; skipping exit labels');
    }

    if (returnType) {
        const outReg = tctx.getRegister();
        tctx.write(`${outReg} = load ${returnTypeName}* %retVal, align ${getAlignment(returnType)}`);
        tctx.write(`ret ${returnTypeName} ${outReg}`);
    } else {
        tctx.write('ret void');
    }

    tctx.pop();

    tctx.write('}\n');
});

NODES.set(hlirNodes.IfHLIR, function(env, ctx, tctx) {
    const condition = _node(this.condition, env, ctx, tctx);

    const consequentLbl = tctx.getUniqueLabel('conseq');
    const afterLbl = tctx.getUniqueLabel('after');
    const alternateLbl = this.alternate ? tctx.getUniqueLabel('alternate') : afterLbl;

    tctx.write('br i1 ' + condition + ', label %' + consequentLbl + ', label %' + alternateLbl);
    tctx.writeLabel(consequentLbl);

    this.consequent.forEach(stmt => {
        tctx.write('; Statement: ' + stmt.constructor.name);
        _node(stmt, env, ctx, tctx);
    });

    tctx.write('br label %' + afterLbl);

    if (this.alternate) {
        tctx.writeLabel(alternateLbl);
        this.alternate.forEach(stmt => {
            tctx.write('; Statement: ' + stmt.constructor.name);
            _node(stmt, env, ctx, tctx);
        });
        tctx.write('br label %' + afterLbl);
    }

    tctx.writeLabel(afterLbl);
});

NODES.set(hlirNodes.LiteralHLIR, function(env, ctx, tctx) {
    if (this.litType === 'str') {
        const strLitIdent = '@string.' + makeName(env.getStrLiteralIdentifier(this.value));

        const strPtr = tctx.getRegister();
        tctx.write(strPtr + ' = call i8* @malloc(i32 16)');
        const castStrPtr = tctx.getRegister();
        tctx.write(castStrPtr + ' = bitcast i8* ' + strPtr + ' to %string*');
        const lenPtr = tctx.getRegister();
        tctx.write(lenPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 0');
        tctx.write('store i32 ' + this.value.length + ', i32* ' + lenPtr);
        const capacityPtr = tctx.getRegister();
        tctx.write(capacityPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 1');
        tctx.write('store i32 ' + this.value.length + ', i32* ' + capacityPtr);

        const strBodyPtr = tctx.getRegister();
        tctx.write(strBodyPtr + ' = getelementptr %string* ' + castStrPtr + ', i32 0, i32 2');
        tctx.write('store i16* getelementptr inbounds ([' + (this.value.length + 1) + ' x i16]* ' + strLitIdent + ', i32 0, i32 0), i16** ' + strBodyPtr + ', align 4');

        return castStrPtr;
    }

    if (this.value === true) return 'true';
    if (this.value === false) return 'false';
    if (this.value === null) return 'null';
    return this.value.toString();
});

NODES.set(hlirNodes.LoopHLIR, function(env, ctx, tctx) {
    const beforeLbl = tctx.getUniqueLabel('before');
    tctx.writeLabel(beforeLbl);

    const condition = _node(this.condition, env, ctx, tctx);

    const loopLbl = tctx.getUniqueLabel('loop');
    const afterLbl = tctx.getUniqueLabel('after');
    tctx.pushLoop(loopLbl, afterLbl);

    tctx.write('br i1 ' + condition + ', label %' + loopLbl + ', label %' + afterLbl);
    tctx.writeLabel(loopLbl);

    this.body.forEach(stmt => {
        tctx.write('; Statement: ' + stmt.constructor.name);
        _node(stmt, env, ctx, tctx);
    });

    tctx.write('br label %' + afterLbl);
    tctx.writeLabel(afterLbl);
    tctx.popLoop();
});

NODES.set(hlirNodes.MemberHLIR, function(env, ctx, tctx, extra) {
    const baseType = this.base.resolveType(ctx);
    let base;
    if (baseType._type === 'module') {
        return '@' + makeName(baseType.memberMapping.get(this.child));
    }

    if (baseType._type === '_stdlib') {
        let stdlibName = `stdlib.${baseType.name}.${this.child}`;
        stdlibFuncs.registerFunc(env, stdlibName);
        return '@' + stdlibName;
    }

    if (baseType._type === '_foreign') {
        env.foreigns.push(this.child);
        if (!env[FOREIGN_REQUESTED].has(this.child)) {
            env[FOREIGN_REQUESTED][this.child] = true;
            let funcVal = externalFuncs[this.child](env); // Don't inline this into the next line
            env[GLOBAL_PREFIX] += funcVal + '\n';
        }

        return '@foreign_' + makeName(this.child);
    }

    if (baseType._type === '_foreign_curry') {
        return _node(this.base, env, ctx, tctx);
    }

    if (baseType.hasMethod && baseType.hasMethod(this.child)) {
        let type = this.resolveType(ctx);
        let typeName = getLLVMParamType(type);
        let funcType = getFunctionSignature(type);
        tctx.write(`; member:methodref(${baseType.toString()}.${this.child})`);

        if (!env[FUNCREF_TYPES].has(typeName)) {
            env[GLOBAL_PREFIX] += '\n' + typeName.substr(0, typeName.length - 1) + ' = type { i8*, i8* }'
            env[FUNCREF_TYPES].add(typeName);
        }

        let reg = tctx.getRegister();
        tctx.write(`${reg} = call i8* @malloc(i32 16)`); // 16 is just to be safe for 64 bit
        let regPtr = tctx.getRegister();
        tctx.write(`${regPtr} = bitcast i8* ${reg} to ${typeName}`);

        let funcLocPtr = tctx.getRegister();
        tctx.write(`${funcLocPtr} = getelementptr inbounds ${typeName} ${regPtr}, i32 0, i32 0`);
        let rawFuncLocPtr = tctx.getRegister();
        tctx.write(`${rawFuncLocPtr} = bitcast ${funcType} @${makeName(baseType.getMethod(this.child))} to i8* ; member:method:funccast`);
        tctx.write(`store i8* ${rawFuncLocPtr}, i8** ${funcLocPtr} ; member:method:func`);

        let baseLocPtr = tctx.getRegister();
        tctx.write(`${baseLocPtr} = getelementptr inbounds ${typeName} ${regPtr}, i32 0, i32 1`);
        base = _node(this.base, env, ctx, tctx);

        let baseCastReg = tctx.getRegister();
        tctx.write(`${baseCastReg} = bitcast ${getLLVMType(baseType)} ${base} to i8*`);
        tctx.write(`store i8* ${baseCastReg}, i8** ${baseLocPtr} ; member:method:self`);

        return regPtr;
    }

    if ((baseType._type === 'array' || baseType._type === 'string') && this.child === 'length') {
        base = _node(this.base, env, ctx, tctx);
        let lenRegPtr = tctx.getRegister();
        tctx.write(`${lenRegPtr} = getelementptr inbounds ${getLLVMType(baseType)} ${base}, i32 0, i32 0`);
        let lenReg = tctx.getRegister();
        tctx.write(`${lenReg} = load i32* ${lenRegPtr}, align 4`);

        return lenReg;
    }

    const layoutIndex = baseType.getLayoutIndex(this.child);
    const outType = this.resolveType(ctx);

    tctx.write(`; member(${baseType.toString()}.${outType.toString()})`);

    base = _node(this.base, env, ctx, tctx);

    const outRegPtr = tctx.getRegister();
    tctx.write(`${outRegPtr} = getelementptr inbounds ${getLLVMType(baseType)} ${base}, i32 0, i32 ${layoutIndex}`);

    if (extra === 'lvalue') {
        return outRegPtr;
    }

    const outReg = tctx.getRegister();
    tctx.write(`${outReg} = load ${getLLVMType(outType)}* ${outRegPtr}, align ${getAlignment(outType)}`);
    return outReg;
});

NODES.set(hlirNodes.NegateHLIR, function(env, ctx, tctx) {
    const out = _node(this.base, env, ctx, tctx);
    const reg = tctx.getRegister();
    tctx.write(reg + ' = xor i1 ' + out + ', 1');
    return reg;
});

NODES.set(hlirNodes.NewHLIR, function(env, ctx, tctx) {
    const baseType = this.resolveType(ctx);
    const targetType = getLLVMType(baseType);
    tctx.write(`; NewHLIR(${baseType.toString()})`);

    if (baseType instanceof Func) {
        const funcType = getFunctionSignature(baseType);

        if (!env[FUNCREF_TYPES].has(targetType)) {
            const typeName = targetType.substr(0, targetType.length - 1);
            env[GLOBAL_PREFIX] += `\n${typeName} = type { i8*, i8* }`;
            env[FUNCREF_TYPES].add(targetType);
        }

        const reg = tctx.getRegister();
        tctx.write(reg + ' = call i8* @malloc(i32 16) ; funcref'); // 16 is just to be safe for 64 bit
        const regPtr = tctx.getRegister();
        tctx.write(`${regPtr} = bitcast i8* ${reg} to ${targetType}`);

        const funcLocPtr = tctx.getRegister();
        tctx.write(`${funcLocPtr} = getelementptr inbounds ${targetType} ${regPtr}, i32 0, i32 0`);

        tctx.write(`store i8* bitcast (${funcType} ${_node(this.args[0], env, ctx, tctx)} to i8*), i8** ${funcLocPtr}, align ${getAlignment(baseType)} ; funcref:base`);

        const ctxLocPtr = tctx.getRegister();
        tctx.write(`${ctxLocPtr} = getelementptr inbounds ${targetType} ${regPtr}, i32 0, i32 1`);

        if (this.args.length === 2 &&
            !(this.args[1] instanceof hlirNodes.LiteralHLIR &&
              this.args[1].value === null)) {

            const ctxType = this.args[1].resolveType(ctx);
            const ctxTypeName = getLLVMType(ctxType);
            const ctxRef = _node(this.args[1], env, ctx, tctx);
            const ctxCastLocPtr = tctx.getRegister();
            tctx.write(`${ctxCastLocPtr} = bitcast ${ctxTypeName} ${ctxRef} to i8*`);
            tctx.write(`store i8* ${ctxCastLocPtr}, i8** ${ctxLocPtr}, align 8 ; funcref:ctx`);
        } else {
            tctx.write(`store i8* null, i8** ${ctxLocPtr}, align 8 ; funcref:ctx`);
        }

        return regPtr;
    }

    if (baseType._type === 'array') {
        const flatTypeName = baseType.flatTypeName();
        if (!env[ARRAY_TYPES].has(flatTypeName)) {
            env[ARRAY_TYPES].set(flatTypeName, baseType);
        }

        const length = _node(this.args[0], env, ctx, tctx);
        const arr = tctx.getRegister();
        tctx.write(`${arr} = call ${targetType} @btmake_${targetType.substr(1, targetType.length - 2)}(i32 ${length})`);
        return arr;
    }

    const size = baseType.getSize();
    const reg = tctx.getRegister();
    tctx.write(`${reg} = call i8* @malloc(i32 ${size})`);
    const ptrReg = tctx.getRegister();
    tctx.write(`${ptrReg} = bitcast i8* ${reg} to ${targetType}`);

    tctx.write(`call void @btinit_${targetType.substr(1, targetType.length - 2)}(${targetType} ${ptrReg}) ; new:initcall`);

    if (baseType instanceof Struct && baseType.objConstructor) {
        const args = [
            'i8* ' + reg,
            this.args.map(p => getLLVMType(p.resolveType(ctx)) + ' ' + _node(p, env, ctx, tctx)).join(', '),
        ].join(', ');

        tctx.write(`call void @${makeName(baseType.objConstructor)}(${args}) ; new:constrcall`);
    }
    return ptrReg;
});

NODES.set(hlirNodes.ObjectDeclarationHLIR, function(env, ctx, tctx) {
    // Ignore the unconstructed prototypes
    if (!this[symbols.IS_CONSTRUCTED]) return;

    if (this.objConstructor) {
        _node(this.objConstructor, env, ctx, tctx);
    }

    this.methods.forEach(method => _node(method, env, ctx, tctx));

    this.operatorStatements.forEach(op => _node(op, env, ctx, tctx));
});

NODES.set(hlirNodes.RaiseHLIR, function(env, ctx, tctx, extra) {
    const value = _node(this.value, env, ctx, tctx);
    const raiseTypeRaw = this.value.resolveType(ctx);
    const raiseType = getLLVMType(raiseTypeRaw);

    const rawValueReg = tctx.getRegister();
    tctx.write(`${rawValueReg} = bitcast ${raiseType} ${value} to i8*`);

    tctx.write(
        `call void @__cxa_throw(${rawValueReg}, i8*, i8* null)`
    );
    tctx.write('unreachable');
});

NODES.set(hlirNodes.ReturnHLIR, function(env, ctx, tctx, extra) {
    if (!this.value) {
        tctx.write('br label %exitLabel');
        tctx.writeTerminatorLabel();
        return;
    }
    const value = _node(this.value, env, ctx, tctx);
    const retTypeRaw = this.value.resolveType(ctx);
    const retType = getLLVMType(retTypeRaw);
    tctx.write(`store ${retType} ${value}, ${retType}* %retVal, align ${getAlignment(retTypeRaw)} ; return`);
    if (extra !== FUNC_LAST_BODY) {
        tctx.write('br label %exitLabel');
        tctx.writeTerminatorLabel();
    }
});

NODES.set(hlirNodes.SubscriptHLIR, function(env, ctx, tctx, parent) {
    const baseType = this.base.resolveType(ctx);
    const subscriptType = this.childExpr.resolveType(ctx);

    let temp;
    if ((temp = env.registeredOperators.get(baseType.flatTypeName())) &&
        (temp = temp.get(subscriptType.flatTypeName())) &&
        temp.has('[]')) {

        const operatorStmtFunc = temp.get('[]');

        const base = _node(this.base, env, ctx, tctx);
        const subscript = _node(this.childExpr, env, ctx, tctx);

        const outReg = tctx.getRegister();
        tctx.write(
            `${outReg} = call ${getLLVMType(this.resolveType(ctx))} @` +
            makeName(operatorStmtFunc) + '(' +
            getLLVMType(baseType) + ' ' + base + ', ' +
            getLLVMType(subscriptType) + ' ' + subscript +
            ')');
        return outReg;
    }


    if (baseType._type !== 'array' && baseType._type !== 'tuple') {
        throw new Error('Cannot subscript non-arrays in llvmir');
    }

    let childType;
    let posPtr;

    const base = _node(this.base, env, ctx, tctx);

    if (baseType._type === 'tuple') {
        // TODO: make this validate the subscript?
        childType = baseType.contentsTypeArr[this.childExpr.value];

        posPtr = tctx.getRegister();
        tctx.write(`${posPtr} = getelementptr ${getLLVMType(baseType)} ${base}, i32 0, i32 ${this.childExpr.value}`);

    } else {
        childType = baseType.contentsType;
        const child = _node(this.childExpr, env, ctx, tctx);

        const arrBodyPtr = tctx.getRegister();
        tctx.write(`${arrBodyPtr} = getelementptr inbounds ${getLLVMType(baseType)} ${base}, i32 0, i32 1`);
        const arrBody = tctx.getRegister();
        tctx.write(`${arrBody} = load ${getLLVMType(childType)}** ${arrBodyPtr}`);

        posPtr = tctx.getRegister();
        tctx.write(`${posPtr} = getelementptr ${getLLVMType(childType)}* ${arrBody}, i32 ${child}`);
    }
    if (parent === 'lvalue') {
        return posPtr;
    }

    const valReg = tctx.getRegister();
    tctx.write(`${valReg} = load ${getLLVMType(childType)}* ${posPtr}, align ${getAlignment(childType)}`);
    return valReg;
});

NODES.set(hlirNodes.SymbolHLIR, function(env, ctx, tctx, extra) {
    const refname = makeName(this[symbols.REFNAME]);
    if (this[symbols.IS_FUNC]) {
        return '@' + refname;
    }

    const rootContext = ctx.getRoot();

    if (extra === 'lvalue') {
        return (this[symbols.REFCONTEXT] === rootContext ? '@' : '%') + refname;
    }

    const reg = tctx.getRegister();
    const type = this.resolveType(ctx);

    const alignment = getAlignment(type);

    const ref = (this[symbols.REFCONTEXT] === rootContext ? '@' : '%') + refname;
    tctx.write(`${reg} = load ${getLLVMType(type)}* ${ref}, align ${alignment}`);
    return reg;
});

NODES.set(hlirNodes.TupleLiteralHLIR, function(env, ctx, tctx) {
    const type = this.resolveType(ctx);
    const typeName = getLLVMType(type);

    const flatTypeName = type.flatTypeName();
    if (!env[TUPLE_TYPES].has(flatTypeName)) {
        env[TUPLE_TYPES].set(flatTypeName, type);
    }

    const size = type.getSize() + 8;
    const reg = tctx.getRegister();
    tctx.write(reg + ' = call i8* @malloc(i32 ' + size + ')');
    const ptrReg = tctx.getRegister();
    tctx.write(ptrReg + ' = bitcast i8* ' + reg + ' to ' + typeName);

    // Assign all the tuple values
    this.elements.forEach((exp, i) => {
        const value = _node(exp, env, ctx, tctx);
        const valueType = getLLVMType(exp.resolveType(ctx));

        const pReg = tctx.getRegister();
        tctx.write(`${pReg} = getelementptr inbounds ${typeName} ${ptrReg}, i32 0, i32 ${i}`);
        tctx.write(`store ${valueType} ${value}, ${valueType}* ${pReg}`);
    });

    return ptrReg;
});

NODES.set(hlirNodes.TypeCastHLIR, function(env, ctx, tctx) {
    const baseType = this.base.resolveType(ctx);
    const baseTypeName = getLLVMType(baseType);
    const targetType = this.target.resolveType(ctx);
    const targetTypeName = getLLVMType(targetType);

    const base = _node(this.base, env, ctx, tctx);
    if (baseType.equals(targetType)) return base;

    const resPtr = tctx.getRegister();

    switch (baseType.typeName) {
        case 'int':
            switch (targetType.typeName) {
                case 'float':
                case 'sfloat':
                    tctx.write(`${resPtr} = sitofp ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'byte':
                    tctx.write(`${resPtr} = trunc ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'bool':
                    tctx.write(`${resPtr} = icmp ne ${baseTypeName} ${base}, 0`);
                    return resPtr;
            }
        case 'uint':
            switch (targetType.typeName) {
                case 'float':
                case 'sfloat':
                    tctx.write(`${resPtr} = uitofp ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'byte':
                    tctx.write(`${resPtr} = trunc ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'bool':
                    tctx.write(`${resPtr} = icmp ne ${baseTypeName} ${base}, 0`)
                    return resPtr;
            }
        case 'sfloat':
            switch (targetType.typeName) {
                case 'int':
                    tctx.write(`${resPtr} = fptosi ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'float':
                    tctx.write(`${resPtr} = fext ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'byte':
                case 'uint':
                    tctx.write(`${resPtr} = fptoui ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'bool':
                    tctx.write(`${resPtr} = fcmp one ${baseTypeName} ${base}, 0.0`)
                    return resPtr;
            }
        case 'float':
            switch (targetType.typeName) {
                case 'int':
                    tctx.write(`${resPtr} = fptosi ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'uint':
                case 'byte':
                    tctx.write(`${resPtr} = fptoui ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'bool':
                    tctx.write(`${resPtr} = fcmp one ${baseTypeName} ${base}, 0.0`)
                    return resPtr;
                case 'sfloat':
                    tctx.write(`${resPtr} = fptrunc ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
            }
        case 'byte':
            switch (targetType.typeName) {
                case 'int':
                    tctx.write(`${resPtr} = sext ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'uint':
                    tctx.write(`${resPtr} = zext ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'float':
                case 'sfloat':
                    tctx.write(`${resPtr} = uitofp ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'bool':
                    tctx.write(`${resPtr} = icmp ne ${baseTypeName} ${base}, 0`)
                    return resPtr;
            }
        case 'bool':
            switch (targetType.typeName) {
                case 'int':
                case 'uint':
                case 'byte':
                    tctx.write(`${resPtr} = zext ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
                case 'float':
                case 'sfloat':
                    tctx.write(`${resPtr} = uitofp ${baseTypeName} ${base} to ${targetTypeName}`);
                    return resPtr;
            }
    }

    return base;
});

NODES.set(hlirNodes.TypedIdentifierHLIR, function() {
    return makeName(this[symbols.ASSIGNED_NAME]);
});

export default function translate(ctx) {
    const tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
