import * as hlirNodes from '../../../hlirNodes';
import Struct from '../../types/Struct';
import * as symbols from '../../../symbols';
import TranslationContext from './TranslationContext';
import * as types from '../../types';


const GLOBAL_PREFIX = '';


function _binop(env, ctx, tctx) {
    var out;
    var left = _node(this.left, env, ctx, tctx);
    var right = _node(this.right, env, ctx, tctx);

    var leftTypeRaw = this.left.resolveType(ctx);
    var rightTypeRaw = this.right.resolveType(ctx);


    if (leftTypeRaw && rightTypeRaw) {
        var leftType = leftTypeRaw.flatTypeName();
        var rightType = rightTypeRaw.flatTypeName();
        if (ctx.env.registeredOperators.has(leftType) &&
            ctx.env.registeredOperators.get(leftType).has(rightType) &&
            ctx.env.registeredOperators.get(leftType).get(rightType).has(this.operator)) {

            var operatorStmtFunc = ctx.env.registeredOperators.get(leftType).get(rightType).get(this.operator);
            return `${operatorStmtFunc}(${left}, ${right})`;
        }
    }

    switch (this.operator) {
        case 'and':
            out = left + ' && ' + right;
            break;
        case 'or':
            out = left + ' || ' + right;
            break;
        case '==':
            out = left + ' === ' + right;
            break;
        case '*':
            if (this.left.resolveType(ctx) === types.publicTypes.int &&
                this.right.resolveType(ctx) === types.publicTypes.int) {

                if (!env.__hasImul) {
                    env.__hasImul = true;
                    env[GLOBAL_PREFIX] += 'var imul = stdlib.Math.imul;\n';
                }
                out = 'imul(' + left + ', ' + right + ')';
                break;
            }
        case '/':
            if (this.operator === '/' &&
                this.left.resolveType(ctx) === types.publicTypes.int &&
                this.right.resolveType(ctx) === types.publicTypes.int) {

                out = '(' + left + ' / ' + right + ' | 0)';
                break;
            }
        default:
            out = left + ' ' + this.operator + ' ' + right;
    }

    return '(' + out + ')';
}

const NODES = new Map();
const IGNORE_NODES = new Set([
    hlirNodes.ExportHLIR,
    hlirNodes.ImportHLIR,
    hlirNodes.ObjectMemberHLIR,
]);

function _node(node, env, ctx, tctx) {
    if (IGNORE_NODES.has(node.constructor)) {
        return '';
    }
    if (!NODES.has(node.constructor)) {
        throw new Error('Unrecognized node: ' + node.constructor.name);
    }
    return NODES.get(node.constructor).call(node, env, ctx, tctx);
}

NODES.set(hlirNodes.RootHLIR, function(env, ctx, tctx) {
    env[GLOBAL_PREFIX] = env[GLOBAL_PREFIX] || '';
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));
    if (env[GLOBAL_PREFIX]) {
        tctx.prepend(env[GLOBAL_PREFIX]);
    }
    env[GLOBAL_PREFIX] = '';
});

NODES.set(hlirNodes.NegateHLIR, function(env, ctx, tctx) {
    // Precedence here will always be 4.
    return '!' + _node(this.base, env, ctx, tctx);
});

NODES.set(hlirNodes.AssignmentHLIR, function(env, ctx, tctx) {
    tctx.write(_node(this.base, env, ctx, tctx) + ' = ' + _node(this.value, env, ctx, tctx) + ';');
});

NODES.set(hlirNodes.BinopArithmeticHLIR, _binop);
NODES.set(hlirNodes.BinopBitwiseHLIR, _binop);
NODES.set(hlirNodes.BinopEqualityHLIR, _binop);
NODES.set(hlirNodes.BinopLogicalHLIR, _binop);

NODES.set(hlirNodes.BreakHLIR, function() {
    tctx.write('break;');
});

NODES.set(hlirNodes.CallStatementHLIR, function(env, ctx, tctx) {
    tctx.write(_node(this.call, env, ctx, tctx) + ';');
});

NODES.set(hlirNodes.CallHLIR, function(env, ctx, tctx) {
    return _node(this.callee, env, ctx, tctx) +
        '(' +
        this.params.map(p => _node(p, env, ctx, tctx)).join(',') +
        ')';
});

NODES.set(hlirNodes.ContinueHLIR, function() {
    tctx.write('continue;');
});

NODES.set(hlirNodes.DeclarationHLIR, function(env, ctx, tctx) {
    var type = this.value.resolveType(ctx);
    var output = 'var ' + this[symbols.ASSIGNED_NAME] + ' = ';

    if (this.value instanceof hlirNodes.LiteralHLIR) {
        output += _node(this.value, env, ctx, tctx) + ';';
        tctx.write(output);
        return;
    }

    var def;
    if (type && type._type === 'primitive') {
        def = type && (type.typeName === 'float' || type.typeName === 'sfloat') ? '0.0' : '0';
    } else if (type) {
        def = 'null';
    }
    tctx.write(output + def + ';');
    tctx.write(this[symbols.ASSIGNED_NAME] + ' = ' + _node(this.value, env, ctx, tctx) + ';');
});

NODES.set(hlirNodes.DoWhileHLIR, function(env, ctx, tctx) {
    tctx.write('do {');
    tctx.push();
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));
    tctx.pop();
    tctx.write('} while (' + _node(this.condition, env, ctx, tctx) + ');');
});

NODES.set(hlirNodes.FunctionHLIR, function(env, ctx, tctx) {
    var context = this[symbols.CONTEXT];

    tctx.write(
        `function ${this[symbols.ASSIGNED_NAME]}(${
            this.params.map(param => _node(param, env, context, tctx)).join(',')
        }) {`
    );

    tctx.push();
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));

    if (this[symbols.IS_CONSTRUCTOR]) {
        tctx.write('return ' + this.params[0][symbols.ASSIGNED_NAME] + ';');
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

NODES.set(hlirNodes.LiteralHLIR, function(env, ctx, tctx) {
    if (this.litType === 'str') {
        return env.getStrLiteralIdentifier(this.value);
    }

    if (this.value === true) return 'true';
    if (this.value === false) return 'false';
    if (this.value === null) return 'null';
    return this.value.toString();
});

NODES.set(hlirNodes.LoopHLIR, function(env, ctx, tctx) {
    tctx.write('while (' + _node(this.condition, env, ctx, tctx) + ') {');
    tctx.push();
    this.body.forEach(stmt => _node(stmt, env, ctx, tctx));
    tctx.pop();
    tctx.write('}');
});

NODES.set(hlirNodes.MemberHLIR, function(env, ctx, tctx) {
    var baseType = this.base.resolveType(ctx);
    if (baseType._type === 'module') {
        return baseType.memberMapping.get(this.child);
    }

    var base;
    if (baseType._type === '_stdlib') {
        base = 'stdlib.' + baseType.name;
    } else if (baseType._type === '_foreign') {
        if (env.foreigns.indexOf(this.child) === -1) {
            env.foreigns.push(this.child);
        }
        return 'foreign.' + this.child;
    } else {
        base = _node(this.base, env, ctx, tctx);
    }

    if (baseType._type === '_foreign_curry') {
        return base;
    }

    if (baseType.hasMethod && baseType.hasMethod(this.child)) {
        return baseType.getMethod(this.child) + '.bind(null, ' + _node(this.base, env, ctx, tctx) + ')';
    }

    if (baseType._type === 'string' || baseType._type === 'array') {
        switch (this.child) {
            case 'length':
                return base + '.length';
        }
    }

    return base + '.' + this.child;
});

NODES.set(hlirNodes.NewHLIR, function(env, ctx, tctx) {
    var baseType = this.resolveType(ctx);

    if (baseType._type === 'array') {
        var arrLength = _node(this.args[0], env, ctx, tctx);
        if (baseType.contentsType._type === 'primitive') {
            switch (baseType.contentsType.typeName) {
                case 'float': return 'new Float64Array(' + arrLength + ')';
                case 'sfloat': return 'new Float32Array(' + arrLength + ')';
                case 'int': return 'new Int32Array(' + arrLength + ')';
                case 'uint': return 'new Uint32Array(' + arrLength + ')';
                case 'byte': return 'new Uint8Array(' + arrLength + ')';
            }
        }
        return 'new Array(' + arrLength + ')';
    }

    if (baseType._type === 'func') {
        let funcRef = _node(this.args[0], env, ctx, tctx);
        if (this.args.length === 1 ||
            this.args[1] instanceof hlirNodes.LiteralHLIR && this.args[1].value === null) {
            return funcRef;
        }

        return `${funcRef}.bind(null, ${this.args.slice(1).map(a => _node(a, env, ctx, tctx)).join(', ')})`;
    }

    var output = 'new ' + baseType.flatTypeName();

    if (baseType instanceof Struct && baseType.objConstructor) {
        output += '(' + this.args.map(a => _node(a, env, ctx, tctx)).join(', ') + ')';
    } else {
        output += '()';
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

NODES.set(hlirNodes.ReturnHLIR, function(env, ctx, tctx) {
    if (!this.value) {
        if (ctx.scope[symbols.IS_CONSTRUCTOR] === 'constructor') {
            tctx.write('return ' + ctx.scope.params[0][symbols.ASSIGNED_NAME] + ';');
            return;
        }
        tctx.write('return;');
        return;
    }
    tctx.write('return ' + _node(this.value, env, ctx, tctx) + ';');
});

NODES.set(hlirNodes.SubscriptHLIR, function(env, ctx, tctx) {
    var baseType = this.base.resolveType(ctx);
    var subscriptType = this.childExpr.resolveType(ctx);

    var baseOutput = _node(this.base, env, ctx, tctx);
    var subscriptOutput = _node(this.childExpr, env, ctx, tctx);

    var temp;
    if ((temp = env.registeredOperators.get(baseType.flatTypeName())) &&
        (temp = temp.get(subscriptType.flatTypeName())) &&
        temp.has('[]')) {
        return temp.get('[]') + '(' + baseOutput + ',' + subscriptOutput + ')';
    }

    if (baseType._type === 'string') {
        return baseOutput + '.charCodeAt(' + subscriptOutput + ')';
    }

    return baseOutput + '[' + subscriptOutput + ']';
});

NODES.set(hlirNodes.SymbolHLIR, function() {
    return this[symbols.REFNAME];
});

NODES.set(hlirNodes.TypeCastHLIR, function(env, ctx, tctx) {
    var baseType = this.base.resolveType(ctx);
    var targetType = this.target.resolveType(ctx);

    var base = _node(this.base, env, ctx, tctx);

    if (targetType.equals(types.publicTypes.str) &&
        baseType instanceof types.Array &&
        baseType.contentsType.equals(types.privateTypes.uint)) {
        return 'foreign.arr2str(' + base + ')';
    }

    if (baseType.equals(targetType)) return base;

    switch (baseType.typeName) {
        case 'int':
            switch (targetType.typeName) {
                case 'uint':
                    if (this.base.type === 'Literal' && /^[\d\.]+/.exec(this.base.value)) {
                        return base; // 123 as uint -> 123
                    } else if (this.base.type === 'Literal') {
                        return '0'; // -123 as uint -> 0
                    }
                    return 'int2uint(' + base + ')';
                case 'float': return '(+(' + base + '))';
                case 'sfloat': return '(fround(' + base + '))';
                case 'byte': return base;
                case 'bool': return '(!!' + base + ')';
            }
        case 'uint':
            switch (targetType.typeName) {
                case 'int': return 'uint2int(' + base + ')';
                case 'float': return '(+(' + base + '))';
                case 'sfloat': return '(fround(' + base + '))';
                case 'byte': return base;
                case 'bool': return '(' + base + ' != 0)';
            }
        case 'float':
            switch (targetType.typeName) {
                case 'sfloat': return '(fround(' + base + '))';
                case 'uint': return 'float2uint(' + base + ')';
                case 'int': return '(' + base + '|0)';
                case 'byte': return '(' + base + '|0)';
                case 'bool': return '(!!' + base + ')';
            }
        case 'sfloat':
            switch (targetType.typeName) {
                case 'float': return '(+(' + base + '))';
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
                case 'sfloat': return '(fround(' + base + '))';
                case 'bool': return '(!!' + base + ')';
            }
        case 'bool':
            return '(' + base + '?1:0)';
    }
});

NODES.set(hlirNodes.TypedIdentifierHLIR, function() {
    return this[symbols.ASSIGNED_NAME];
});

NODES.set(hlirNodes.TupleLiteralHLIR, function(env, ctx, tctx) {
    return '[' + this.elements.map(x => _node(x, env, ctx, tctx)).join(',') + ']';
});




var NODES_OLD = {
    CallRaw: function(env, ctx, tctx) {
        return _node(this.callee, env, ctx, tctx) + '(/* CallRaw */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, tctx);
            }).join(',') +
            ')';
    },
    CallDecl: function(env, ctx, tctx) {
        return _node(this.callee, env, ctx, tctx) +
            '(/* CallDecl */' +
            this.params.map(function(param) {
                return _node(param, env, ctx, tctx);
            }).join(',') +
            ')';
    },
    CallRef: function(env, ctx, tctx) {
        var funcType = this.callee.resolveType(ctx);

        var paramList = this.params.map(function(param) {
            return _node(param, env, ctx, tctx);
        }).join(',');

        var temp;
        if (this.callee.type === 'Member' &&
            (temp = this.callee.base.resolveType(ctx)).hasMethod &&
            temp.hasMethod(this.callee.child)) {

            return temp.getMethod(this.callee.child) + '(/* CallRef:Method */' +
                _node(this.callee.base, env, ctx, tctx) + (paramList ? ', ' : '') + paramList + ')';
        }

        return _node(this.callee, env, ctx, tctx) +
            '(/* CallRef */' + paramList + ')';
    },

};

export default function translateJS(ctx) {
    var tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};
