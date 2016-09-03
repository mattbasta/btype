import Func from '../../types/Func';
import * as hlirNodes from '../../../hlirNodes';
import Module from '../../types/Module';
import Struct from '../../types/Struct';
import * as symbols from '../../../symbols';
import TranslationContext from '../js/TranslationContext';
import * as types from '../../types';


export const GLOBAL_PREFIX = Symbol();
export const STDLIB_REQUESTED = Symbol();
export const FOREIGN_REQUESTED = Symbol();
export const HAS_NEW_ARRAY = Symbol();
export const HEAP_MODIFIERS = {
    memheap: '>>0',
    intheap: '>>2',
    ptrheap: '>>2',
    sfloatheap: '>>2',
    floatheap: '>>3',
};

function trimSemicolon(inp) {
    inp = inp.trim();
    if (inp[inp.length - 1] === ';') {
        inp = inp.substr(0, inp.length - 1);
    }
    return inp;
}

function _binop(env, ctx, tctx) {
    var out;
    var left = typeAnnotation(_node(this.left, env, ctx, tctx), this.left.resolveType(ctx));
    var right = typeAnnotation(_node(this.right, env, ctx, tctx), this.right.resolveType(ctx));

    var leftTypeRaw = this.left.resolveType(ctx);
    var rightTypeRaw = this.right.resolveType(ctx);

    if (leftTypeRaw && rightTypeRaw) {
        let leftType = leftTypeRaw.flatTypeName();
        let rightType = rightTypeRaw.flatTypeName();
        if (ctx.env.registeredOperators.get(leftType) &&
            ctx.env.registeredOperators.get(leftType).get(rightType) &&
            ctx.env.registeredOperators.get(leftType).get(rightType).get(this.operator)) {

            let operatorStmtFunc = ctx.env.registeredOperators.get(leftType).get(rightType).get(this.operator);
            out = operatorStmtFunc + '(' + left + ',' + right + ')';
            return typeAnnotation(out, ctx.env.registeredOperatorReturns.get(operatorStmtFunc));
        }
    }

    switch (this.operator) {
        case 'and':
            out = `(${left}&${right})`;
            break;
        case 'or':
            out = `(${left}|${right})`;
            break;
        case '*':
            if (leftTypeRaw === types.publicTypes.int &&
                rightTypeRaw === types.publicTypes.int) {

                out = `(imul(${left}, ${right})|0)`;
                break;
            }
        default:
            if (!(this.left instanceof hlirNodes.LiteralHLIR)) left = '(' + typeAnnotation(left, leftTypeRaw) + ')';
            if (!(this.right instanceof hlirNodes.LiteralHLIR)) right = '(' + typeAnnotation(right, rightTypeRaw) + ')';
            out = left + ' ' + this.operator + ' ' + right;
    }

    return typeAnnotation(out, this.resolveType(ctx));
}

const NODES = new Map();
const IGNORE_NODES = new Set([
    hlirNodes.ExportHLIR,
    hlirNodes.ImportHLIR,
    hlirNodes.ObjectMemberHLIR,
]);

function _node(node, env, ctx, tctx, extra = null) {
    if (IGNORE_NODES.has(node.constructor)) {
        return '';
    }
    if (!NODES.has(node.constructor)) {
        throw new Error('Unrecognized node: ' + node.constructor.name);
    }
    return NODES.get(node.constructor).call(node, env, ctx, tctx, extra);
}

export function heapName(type) {
    var typedArr = 'ptrheap';
    if (type.typeName === 'float') return 'floatheap';
    else if (type.typeName === 'sfloat') return 'sfloatheap';
    else if (type.typeName === 'byte') return 'memheap';
    else if (type.typeName === 'bool') return 'memheap';
    else if (type.typeName === 'int') return 'intheap';
    return typedArr;
}

export function typeAnnotation(base, type) {
    if (!type) return base;
    if (/^\-?[\d\.]+$/.exec(base)) return base;

    switch (type.typeName) {
        case 'sfloat':
            return 'fround(' + base + ')';
        case 'float':
            if (base[0] === '+') return base;
            return '+(' + base + ')';
        case 'byte':
        case 'int':
        case 'uint':
        default:
            if (base.substr(-2) === '|0') return base;
            return '(' + base + ')|0';
    }

}

function getFunctionDerefs(ctx, exclude) {
    var output = '';
    var params = ctx.scope.params.map(p => p[symbols.ASSIGNED_NAME]);
    ctx.typeMap.forEach((type, name) => {
        if (type._type === 'primitive') return;

        // Ignore returned symbols
        if (exclude && exclude instanceof hlirNodes.SymbolHLIR && exclude[symbols.REFNAME] === name) return;

        // Ignore recursion
        if (exclude && exclude instanceof hlirNodes.SymbolHLIR && exclude[symbols.REFNAME] === ctx.scope[symbols.ASSIGNED_NAME]) {
            return;
        }

        // Ignore parameters
        if (params.some(p => p === name)) return;

        output += 'gcderef(' + name + ');\n';
    });

    return output;
}


NODES.set(hlirNodes.RootHLIR, function(env, ctx, tctx) {
    env[GLOBAL_PREFIX] = env[GLOBAL_PREFIX] || '';
    env[STDLIB_REQUESTED] = new Map();
    env[FOREIGN_REQUESTED] = new Map();
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));
    if (env[GLOBAL_PREFIX]) {
        tctx.prepend(env[GLOBAL_PREFIX]);
    }
    env[GLOBAL_PREFIX] = '';
});

NODES.set(hlirNodes.AssignmentHLIR, function(env, ctx, tctx) {
    var baseContent = typeAnnotation(_node(this.value, env, ctx, tctx, 'Assignment'), this.value.resolveType(ctx));

    var lval = _node(this.base, env, ctx, tctx, 'Assignment');
    if (this.base.resolveType(ctx)._type !== 'primitive') {
        tctx.write(`gcderef(${lval} | 0);`);
    }

    var valueType = this.value.resolveType(ctx);
    if (valueType._type !== 'primitive') {
        baseContent = '(gcref((' + baseContent + ')|0)|0)';
    }
    tctx.write(lval + ' = ' + baseContent + ';');
});

NODES.set(hlirNodes.BinopArithmeticHLIR, _binop);
NODES.set(hlirNodes.BinopBitwiseHLIR, _binop);
NODES.set(hlirNodes.BinopEqualityHLIR, _binop);
NODES.set(hlirNodes.BinopLogicalHLIR, _binop);

NODES.set(hlirNodes.BreakHLIR, function() {
    tctx.write('break;');
});

NODES.set(hlirNodes.CallHLIR, function(env, ctx, tctx) {
    var getParamList = () =>
        this.params.map(p => typeAnnotation(_node(p, env, ctx, tctx), p.resolveType(ctx))).join(',');

    if (this.callee instanceof hlirNodes.MemberHLIR) {

        let baseType = this.callee.base.resolveType(ctx);
        if (baseType.hasMethod(this.callee.child)) {
            // Are we calling a method directly?
            return typeAnnotation(
                baseType.getMethod(this.callee.child) + '(' +
                _node(this.callee.base, env, ctx, tctx) + '|0' +
                (this.params.length ? ',' + getParamList() : '') +
                ')',
                this.resolveType(ctx)
            );

        } else if (baseType.hasStaticMethod(this.callee.child)) {
            // Are we calling something static, like an exported method on
            // a module?
            return typeAnnotation(
                baseType.getStaticMethod(this.callee.child) +
                    '(' + getParamList() + ')',
                baseType.getStaticMethodType(this.callee.child).getReturnType()
            );

        } else if (baseType._type === '_foreign_curry' ||
                   baseType._type === '_stdlib') {
            return typeAnnotation(
                _node(this.callee, env, ctx, tctx, 'call') +
                    '(' + getParamList() + ')',
                this.resolveType(ctx)
            );
        }

    } else if (this.callee instanceof hlirNodes.SymbolHLIR) {
        // Is it calling a function declaration directly?
        if (this.callee[symbols.REFCONTEXT].lookupFunctionByName(this.callee[symbols.REFNAME])) {
            return typeAnnotation(
                `${_node(this.callee, env, ctx, tctx)}(${getParamList()})`,
                this.callee.resolveType(ctx).getReturnType()
            );
        }

    }

    // Otherwise, it's a function reference that we're calling.
    var funcType = this.callee.resolveType(ctx);
    var listName = env.getFuncListName(funcType);

    var funcRef = _node(this.callee, env, ctx, tctx);

    return typeAnnotation(
        `calldyn${listName}(${funcRef}` +
            (this.params.length ? ',' : '') +
            getParamList() +
            ')',
        funcType.getReturnType()
    );

});

NODES.set(hlirNodes.CallStatementHLIR, function(env, ctx, tctx) {
    var output = _node(this.call, env, ctx, tctx);

    var baseType = this.call.resolveType(ctx);
    if (baseType && baseType._type !== 'primitive') {
        output = 'gcderef(' + output + ')';
    }

    tctx.write(output + ';');
});

NODES.set(hlirNodes.ContinueHLIR, function() {
    tctx.write('continue;');
});

NODES.set(hlirNodes.DeclarationHLIR, function(env, ctx, tctx) {
    var type = this.value.resolveType(ctx);
    var output = 'var ' + this[symbols.ASSIGNED_NAME] + ' = ';

    if (this.value instanceof hlirNodes.LiteralHLIR &&
        this.value.litType !== 'str') {
        output += (this.value.value || '0').toString() + ';';
        tctx.write(output);
        return;
    }

    var def = (type && type.typeName === 'float') ? '0.0' : '0';
    output += def + ';\n';

    tctx.write(output);

    if (!this.value) return;

    var baseContent = _node(this.value, env, ctx, tctx);
    var valueType = this.value.resolveType(ctx);
    if (valueType._type !== 'primitive') {
        baseContent = '(gcref((' + baseContent + ')|0)|0)';
    }
    tctx.write(this[symbols.ASSIGNED_NAME] + ' = ' + baseContent + ';');
});

NODES.set(hlirNodes.FunctionHLIR, function(env, parentCtx, tctx) {
    var ctx = this[symbols.CONTEXT];

    tctx.write(
        'function ' + this[symbols.ASSIGNED_NAME] + '(' +
        this.params.map(param => _node(param, env, ctx, tctx)).join(',') +
        ') {'
    );
    if (this.name) {
        tctx.write('/* ' + this.name + ' */');
    }

    tctx.push();

    // asm.js parameter annotations
    if (this.params.length) {
        this.params.forEach(param => {
            var paramType = param.resolveType(ctx);
            tctx.write(param[symbols.ASSIGNED_NAME] + ' = ' + typeAnnotation(param[symbols.ASSIGNED_NAME], paramType) + ';');
        });
    }

    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));

    var returnType = this.resolveType(ctx).getReturnType();
    var hasReturnStatement = this.body.length && this.body[this.body.length - 1] instanceof hlirNodes.ReturnHLIR;
    if (returnType && !hasReturnStatement) {
        tctx.write(getFunctionDerefs(ctx));
        if (returnType.typeName === 'float' ||
            returnType.typeName === 'sfloat') {
            tctx.write('return 0.0;');
        } else {
            tctx.write('return 0;');
        }

    } else if (!returnType && this[symbols.IS_CONSTRUCTOR]) {
        tctx.write(getFunctionDerefs(ctx));
        // Constructors always are "void", but the implementation always
        // returns the pointer to the initialized object.
        tctx.write('return ' + this.params[0][symbols.ASSIGNED_NAME] + ' | 0;');

    } else if (!hasReturnStatement) {
        tctx.write(getFunctionDerefs(ctx));
    }

    tctx.pop();
    tctx.write('}');
});

NODES.set(hlirNodes.IfHLIR, function(env, ctx, tctx) {
    tctx.write('if (' + _node(this.condition, env, ctx, tctx) + ') {');
    tctx.push();
    this.consequent.forEach(stmt => _node(stmt, env, ctx, tctx));
    tctx.pop();
    if (this.alternate) {
        tctx.write('} else {');
        tctx.push();
        this.alternate.forEach(stmt => _node(stmt, env, ctx, tctx));
        tctx.pop();
    }
    tctx.write('}');
});

NODES.set(hlirNodes.LoopHLIR, function(env, ctx, tctx) {
    // FIXME: Make this valid asm
    tctx.write('while (' + _node(this.condition, env, ctx, tctx) + '|0) {');
    tctx.push();
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));
    tctx.pop();
    tctx.write('}');
});

NODES.set(hlirNodes.LiteralHLIR, function(env, ctx, tctx) {
    if (this.litType === 'str') {
        return '(gcref(' + env.getStrLiteralIdentifier(this.value) + '|0)|0)';
    }

    if (this.value === true) return '1';
    if (this.value === false) return '0';
    if (this.value === null) return '0';

    var output = this.value.toString();
    var type = this.resolveType(ctx);

    var isSfloat = type.typeName === 'sfloat';

    if ((type.typeName === 'float' || isSfloat) && output.indexOf('.') === -1) {
        output += '.0';
    }

    if (isSfloat) {
        output = 'fround(' + output + ')';
    }

    return output;
});

NODES.set(hlirNodes.MemberHLIR, function(env, ctx, tctx, parent) {
    var baseType = this.base.resolveType(ctx);
    if (baseType instanceof Module) {
        return baseType.memberMapping[this.child];
    }

    if (baseType._type === '_stdlib') {
        let stdlibName = baseType.name + '.' + this.child;
        if (env[STDLIB_REQUESTED].has(stdlibName)) {
            return env[STDLIB_REQUESTED].get(stdlibName);
        }
        let stdlibAssignedName = env.namer();
        env[GLOBAL_PREFIX] += 'var ' + stdlibAssignedName + ' = stdlib.' + stdlibName + ';\n';
        env[STDLIB_REQUESTED].set(stdlibName, stdlibAssignedName);
        return stdlibAssignedName;
    }

    if (baseType._type === '_foreign') {
        env.foreigns.push(this.child);
        if (env[FOREIGN_REQUESTED].has(this.child)) {
            return env[FOREIGN_REQUESTED].get(this.child);
        }

        let foreignAssignedName = env.namer();
        env[GLOBAL_PREFIX] += 'var ' + foreignAssignedName + ' = foreign.' + this.child + ';\n';
        env[FOREIGN_REQUESTED].set(this.child, foreignAssignedName);
        return foreignAssignedName;
    }

    if (baseType._type === '_foreign_curry') {
        if (parent !== 'call') throw new Error('Cannot generate references to foreign functions');
        return typeAnnotation(
            _node(this.base, env, ctx, tctx, parent),
            this.resolveType(ctx)
        );
    }

    var base = '(' + typeAnnotation(_node(this.base, env, ctx, tctx), this.base.resolveType(ctx)) + ')';

    if ((baseType._type === 'string' || baseType._type === 'array') && this.child === 'length') {
        return '(ptrheap[' + base + ' + 8 >> 2]|0)';
    }

    if (baseType.hasMethod && baseType.hasMethod(this.child)) {
        let objectMethodFunc = ctx.lookupFunctionByName(baseType.getMethod(this.child));
        let objectMethodFuncIndex = env.registerFunc(objectMethodFunc);
        return '((getboundmethod(' + objectMethodFuncIndex + ', ' + typeAnnotation(_node(this.base, env, ctx, tctx), this.base.resolveType(ctx)) + ')|0) | 0)';
    }

    var layout = baseType.getLayout();
    var childType = this.resolveType(ctx);
    var typedArr = 'ptrheap';
    if (childType.typeName === 'float') typedArr = 'floatheap';
    if (childType.typeName === 'sfloat') typedArr = 'sfloatheap';
    else if (childType.typeName === 'byte') typedArr = 'memheap';
    else if (childType.typeName === 'bool') typedArr = 'memheap';
    else if (childType.typeName === 'int') typedArr = 'intheap';

    var lookup = typedArr + '[(' + base + ' + (' + (layout[this.child] + 8) + '))' + HEAP_MODIFIERS[typedArr] + ']';
    if (parent !== 'Assignment' && parent !== 'Return') {
        lookup = typeAnnotation(lookup, childType);
    }
    return lookup;
});

NODES.set(hlirNodes.NegateHLIR, function(env, ctx, tctx) {
    return '!(' + typeAnnotation(_node(this.base, env, ctx, tctx), types.publicTypes.int) + ')';
});

NODES.set(hlirNodes.NewHLIR, function(env, ctx, tctx) {
    var baseType = this.resolveType(ctx);

    if (baseType instanceof Func) {
        let ref = this.args[0];
        let func = ref[symbols.REFCONTEXT].lookupFunctionByName(ref[symbols.REFNAME]);
        if (this.args.length === 2) {
            let ctxObj = _node(this.args[1], env, ctx, tctx);
            return `getfuncref(${func[symbols.FUNCLIST_IDX]}|0, ${ctxObj})`;
        }
        return `getfuncref(${func[symbols.FUNCLIST_IDX]}|0, 0)`;
    }

    if (baseType._type === 'array') {
        if (!env[HAS_NEW_ARRAY]) {
            env[GLOBAL_PREFIX] += `function makeArray(length, elemSize) {
                length = length | 0;
                elemSize = elemSize | 0;
                var ptr = 0;
                ptr = gcref(calloc((length * elemSize | 0) + 16 | 0) | 0) | 0;
                ptrheap[ptr + 8 >> 2] = length | 0;
                ptrheap[ptr + 12 >> 2] = length | 0;
                return ptr | 0;
            }`;
            env[HAS_NEW_ARRAY] = true;
        }

        var innerTypeSize = baseType.contentsType._type === 'primitive' ? baseType.contentsType.getSize() : 4;
        return '(makeArray(' +
            typeAnnotation(
                '(' + _node(this.args[0], env, ctx, tctx) + ')',
                this.args[0].resolveType(ctx)
            ) +
            ', ' +
            innerTypeSize +
            ')|0)';
    }
    var size = baseType.getSize() + 8;
    var output = '(gcref(calloc(' + size + ')|0)|0)';
    if (baseType instanceof Struct && baseType.objConstructor) {
        output = '(' + baseType.objConstructor + '(' + output + (this.args.length ? ', ' + this.args.map(param => {
            return typeAnnotation(_node(param, env, ctx, tctx), param.resolveType(ctx));
        }).join(', ') : '') + ')|0)';
    }

    return output;
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

NODES.set(hlirNodes.RaiseHLIR, function(env, ctx, tctx) {
    tctx.write(getFunctionDerefs(ctx, this.value));

    tctx.write(
        `foreign.throwErr(${_node(this.value, env, ctx, tctx)} | 0);`
    );
});

NODES.set(hlirNodes.ReturnHLIR, function(env, ctx, tctx) {
    tctx.write(getFunctionDerefs(ctx, this.value));

    if (!this.value) {
        if (ctx.scope[symbols.IS_CONSTRUCTOR]) {
            tctx.write('return ' + ctx.scope.params[0][symbols.ASSIGNED_NAME] + ';');
            return;
        }
        tctx.write('return;');
        return;
    }

    tctx.write('return ' + typeAnnotation(_node(this.value, env, ctx, tctx, 'Return'), this.value.resolveType(ctx)) + ';');
});

NODES.set(hlirNodes.SubscriptHLIR, function(env, ctx, tctx, parent) {
    var baseType = this.base.resolveType(ctx);
    var subscriptType = this.childExpr.resolveType(ctx);

    var temp;
    if ((temp = env.registeredOperators.get(baseType.flatTypeName())) &&
        (temp = temp.get(subscriptType.flatTypeName())) &&
        temp.has('[]')) {

        var operatorStmtFunc = ctx.env.registeredOperators.get(baseType.flatTypeName()).get(subscriptType.flatTypeName()).get('[]');
        return operatorStmtFunc + '(' +
            _node(this.base, env, ctx, tctx) + ',' +
            _node(this.childExpr, env, ctx, tctx) + ')';
    }


    if (baseType._type !== 'array' && baseType._type !== 'tuple') {
        throw new Error('Cannot subscript non-arrays in asmjs');
    }

    var childType;
    var typedArr;

    if (baseType._type === 'tuple') {
        // TODO: make this validate the subscript?
        childType = baseType.contentsTypeArr[this.childExpr.value];
        typedArr = heapName(childType);
        return typeAnnotation(
            typedArr + '[' + _node(this.base, env, ctx, tctx) + ' + ' +
            (baseType.getLayoutIndex(this.childExpr.value) + 8) +
            HEAP_MODIFIERS[typedArr] + ']',
            childType
        );
    }

    childType = baseType.contentsType;
    typedArr = heapName(childType);

    var elementSize = childType.typeName === 'primitive' ? childType.getSize() : '4';
    var lookup = typedArr + '[((' +
        _node(this.base, env, ctx, tctx) + ') + (' +
        // +8 for memory overhead, +8 for the array length
        '((' + _node(this.childExpr, env, ctx, tctx) + ') * ' + elementSize + ') | 0) + 16)' +
        HEAP_MODIFIERS[typedArr] + ']';
    if (parent !== 'Assignment' && parent !== 'Return') {
        lookup = typeAnnotation(lookup, childType);
    }
    return lookup;
});

NODES.set(hlirNodes.SymbolHLIR, function() {
    return this[symbols.REFNAME];
});

NODES.set(hlirNodes.TupleLiteralHLIR, function(env, ctx, tctx) {
    var type = this.resolveType(ctx);
    env.registerType(null, type, ctx);
    return '(makeTuple$' + type.flatTypeName() + '(' +
        this.elements.map((c, i) => {
            return typeAnnotation(_node(c, env, ctx, tctx), type.contentsTypeArr[i]);
        }).join(',') +
        ')|0)';
});

NODES.set(hlirNodes.TypeCastHLIR, function(env, ctx, tctx) {
    var baseType = this.base.resolveType(ctx);
    var targetType = this.target.resolveType(ctx);

    var base = _node(this.base, env, ctx, tctx);
    if (baseType.equals(targetType)) return base;

    switch (baseType.typeName) {
        case 'int':
            switch (targetType.typeName) {
                case 'uint': return '(+int2uint(' + base + '))';
                case 'sfloat': return typeAnnotation(typeAnnotation(base, baseType), types.publicTypes.sfloat);
                case 'float': return typeAnnotation(typeAnnotation(base, baseType), types.publicTypes.float);
                case 'byte': return base;
                case 'bool': return '(' + base + ' != 0)';
            }
        case 'uint':
            switch (targetType.typeName) {
                case 'int': return '(uint2int(' + base + ')|0)';
                case 'float': return typeAnnotation(base, types.publicTypes.float);
                case 'byte': return base;
                case 'bool': return '(' + base + ' != 0)';
            }
        case 'sfloat':
            switch (targetType.typeName) {
                case 'int': return typeAnnotation('(~~(' + base + '))', types.publicTypes.int);
                case 'float': return typeAnnotation(base, targetType);
                case 'byte':
                case 'uint': return '(float2uint(+' + base + ')|0)';
                case 'bool': return '(' + base + ' != 0.0)';
            }
        case 'float':
            switch (targetType.typeName) {
                case 'int': return typeAnnotation('(~~(' + base + '))', types.publicTypes.int);
                case 'uint': return '(+float2uint(' + base + '))';
                case 'byte': return typeAnnotation(base, types.publicTypes.byte);
                case 'bool': return '(' + base + ' != 0.0)';
                case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
            }
        case 'byte':
            switch (targetType.typeName) {
                case 'int': return base;
                case 'uint': return typeAnnotation(base, types.publicTypes.uint);
                case 'float': return typeAnnotation(base, types.publicTypes.float);
                case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
                case 'bool': return '(' + base + ' != 0)';
            }
        case 'bool':
            switch (targetType.typeName) {
                case 'int': return typeAnnotation(base, types.publicTypes.int);
                case 'uint': return typeAnnotation(base, types.publicTypes.uint);
                case 'float': return typeAnnotation(base, types.publicTypes.float);
                case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
                case 'byte': return typeAnnotation(base, types.publicTypes.byte);
            }
    }
});

NODES.set(hlirNodes.TypedIdentifierHLIR, function() {
    return this[symbols.ASSIGNED_NAME];
});


export default function translate(ctx) {
    const tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
