import * as hlirNodes from '../hlirNodes';
import * as symbols from '../symbols';


const SHOULD_FLATTEN = Symbol();
const SHOULD_FLATTEN_CHILDREN = Symbol();


// TODO: should this also include sfloat?
const SAFELITERALTYPES = new Set([
    'bool',
    'float',
    'int',
    'null',
]);


export default function flatten(rootCtx) {
    rootCtx.functions.forEach(f => {
        f.iterateBodies(body => {
            upliftExpressionsFromBody(f[symbols.CONTEXT], body);
            convertLogicalBinops(body);
        });
    });
};

function upliftExpressionsFromBody(ctx, body) {
    var i;

    function injectBefore(newNode) {
        body.splice(i, 0, newNode);
        i++;
    }

    function getTempDecl(type, value = null) {
        var name = ctx.env.namer();

        var litType = 'null';
        var litValue = null;

        if (type._type === 'primitive') {
            litType = type.typeName === 'float' ? 'float' : (type.typeName === 'sfloat' ? 'sfloat' : 'int');
            litValue = (type.typeName === 'float' || type.typeName === 'sfloat') ? '0.0' : '0';
        }

        var type = new hlirNodes.TypeHLIR(type.typeName, []);
        type.forceType(type);
        var decl = new hlirNodes.DeclarationHLIR(
            type,
            name,
            value || new hlirNodes.LiteralHLIR(litType, litValue)
        );
        decl[symbols.CONTEXT] = ctx;
        decl[symbols.ASSIGNED_NAME] = name;
        return decl;
    }

    function getDeclReference(decl, type) {
        var sym = new hlirNodes.SymbolHLIR(decl.name);
        sym[symbols.REFCONTEXT] = ctx;
        sym[symbols.REFTYPE] = type;
        sym[symbols.REFNAME] = decl[symbols.ASSIGNED_NAME];
        return sym;
    }

    for (i = 0; i < body.length; i++) {
        let current = body[i];
        let stack = [];

        // Mark which expressions to flatten
        current.iterateWithSelf((node, member) => {
            if (isNodeBoundary(node, member)) return false;

            stack.unshift(node);

            var i;
            var temp;
            if (node instanceof hlirNodes.BinopLogicalHLIR) {

                if (stack.length === 1 &&
                    current instanceof hlirNodes.AssignmentHLIR &&
                    node === current.value) {
                    return;
                }

                for (i = 0; i < stack.length; i++) {
                    let stackItem = stack[i];
                    if (stackItem instanceof hlirNodes.BinopLogicalHLIR ||
                        stackItem instanceof hlirNodes.BinopEqualityHLIR ||
                        stackItem instanceof hlirNodes.BinopBitwiseHLIR ||
                        stackItem instanceof hlirNodes.BinopArithmeticHLIR) {
                        stackItem[SHOULD_FLATTEN] = true;
                    }

                    if (i + 1 >= stack.length) continue;
                    if (stackItem instanceof hlirNodes.CallHLIR &&
                        stackItem !== stack[i + 1].callee) {
                        stack[i + 1][SHOULD_FLATTEN_CHILDREN] = true;
                    }
                }

            } else if (stack[1] && stack[1] instanceof hlirNodes.ReturnHLIR &&
                !(node instanceof hlirNodes.LiteralHLIR && SAFELITERALTYPES.has(node.litType)) &&
                !(node instanceof hlirNodes.SymbolHLIR) &&
                !(node instanceof hlirNodes.NewHLIR)) {
                node[SHOULD_FLATTEN] = true;

            } else if (stack[1] && stack[1] instanceof hlirNodes.MemberHLIR &&
                stack[1].resolveType(ctx)[symbols.IS_METHOD] &&
                (!stack[2] || stack[2] instanceof hlirNodes.CallHLIR)) {
                stack[1][SHOULD_FLATTEN] = true;
            }

        }, () => stack.shift());

        traverse(current, (node, member) => {
            if (isNodeBoundary(node, member)) return false;
            stack.unshift(node);
        }, node => {
            if (stack.length > 1 && stack[1][SHOULD_FLATTEN_CHILDREN] && node !== stack[1].callee) {
                node[SHOULD_FLATTEN] = true;
            }

            stack.shift();
            if (!node[SHOULD_FLATTEN]) {
                return;
            }

            var type = node.resolveType(ctx);
            var decl = getTempDecl(type, node);
            ctx.addVar(decl.name, type, decl[symbols.ASSIGNED_NAME]);
            injectBefore(decl);

            // injectBefore(
            //     new hlirNodes.AssignmentHLIR(
            //         getDeclReference(decl, type),
            //         node
            //     )
            // );

            return getDeclReference(decl, type);

        });

    }

}

function isNodeBoundary(node, member) {
    return node instanceof hlirNodes.FunctionHLIR ||
        member === 'consequent' ||
        member === 'alternate' ||
        member === 'body';
}

function traverse(tree, filter, replacer) {
    tree.traverse((node, member) => {
        if (filter(node) === false) return;
        traverse(node, filter, replacer);

        var replacement = replacer(node, member);
        if (!replacement) return;

        tree.substitute(x => x === node ? replacement : x);
    });
}


function convertLogicalBinops(body) {
    var condition;
    var conditional;

    for (var i = 0; i < body.length; i++) {
        let current = body[i];
        if (!(current instanceof hlirNodes.AssignmentHLIR) ||
            !(current.value instanceof hlirNodes.BinopLogicalHLIR)) {
            continue;
        }

        // Put the correct condition in the conditional
        if (current.value.operator === 'and') {
            condition = current.base;
        } else {
            condition = new hlirNodes.NegateHLIR(current.base, current.base.start, current.base.end);
        }

        // Create the correct conditional
        conditional = new hlirNodes.IfHLIR(
            condition,
            [new hlirNodes.AssignmentHLIR(current.base, current.value.right)],
            null,
            current.start,
            current.end
        );

        current.value = current.value.left;

        body.splice(i + 1, 0, conditional);
        i++;
    }
}
