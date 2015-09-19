import AssignmentHLIR from '../hlirNodes/AssignmentHLIR';
import BinopArithmeticHLIR from '../hlirNodes/BinopArithmeticHLIR';
import BinopBitwiseHLIR from '../hlirNodes/BinopBitwiseHLIR';
import BinopEqualityHLIR from '../hlirNodes/BinopEqualityHLIR';
import BinopLogicalHLIR from '../hlirNodes/BinopLogicalHLIR';
import CallHLIR from '../hlirNodes/CallHLIR';
import DeclarationHLIR from '../hlirNodes/DeclarationHLIR';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import IfHLIR from '../hlirNodes/IfHLIR';
import LiteralHLIR from '../hlirNodes/LiteralHLIR';
import MemberHLIR from '../hlirNodes/MemberHLIR';
import NegateHLIR from '../hlirNodes/NegateHLIR';
import NewHLIR from '../hlirNodes/NewHLIR';
import ReturnHLIR from '../hlirNodes/ReturnHLIR';
import SymbolHLIR from '../hlirNodes/SymbolHLIR';
import TypeHLIR from '../hlirNodes/TypeHLIR';
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
            upliftExpressionsFromBody(func[symbols.CONTEXT], body);
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

    function getTempDecl(type) {
        var name = ctx.env.namer();

        var litType = 'null';
        var value = null;

        if (type._type === 'primitive') {
            litType = type.typeName === 'float' ? 'float' : (type.typeName === 'sfloat' ? 'sfloat' : 'int');
            value = (type.typeName === 'float' || type.typeName === 'sfloat') ? '0.0' : '0';
        }

        var type = new TypeHLIR(type.typeName, []);
        type.forceType(type);
        var decl = new DeclarationHLIR(
            type,
            name,
            new LiteralHLIR(litType, value)
        );
        decl[symbols.CONTEXT] = ctx;
        decl[symbols.ASSIGNED_NAME] = name;
        return decl;
    }

    function getDeclReference(decl, type) {
        var sym = new SymbolHLIR(decl.identifier);
        sym[symbols.REFCONTEXT] = ctx;
        sym[symbols.REFTYPE] = type;
        sym[symbols.REFNAME] = decl[symbols.ASSIGNED_NAME];
        return sym;
    }

    for (var i = 0; i < body.length; i++) {
        let current = body[i];

        // Mark which expressions to flatten
        var stack = [];
        current.iterateWithSelf((node, member) => {
            if (isNodeBoundary(node, member)) return false;

            stack.unshift(node);

            var i;
            var temp;
            if (node instanceof BinopLogicalHLIR) {

                if (stack.length === 1 &&
                    current instanceof AssignmentHLIR &&
                    node === current.value) {
                    return;
                }

                for (i = 0; i < stack.length; i++) {
                    let stackItem = stack[i];
                    if (stackItem instanceof BinopLogicalHLIR ||
                        stackItem instanceof BinopEqualityHLIR ||
                        stackItem instanceof BinopBitwiseHLIR ||
                        stackItem instanceof BinopArithmeticHLIR) {
                        stackItem[SHOULD_FLATTEN] = true;
                    }

                    if (i + 1 >= stack.length) continue;
                    if (stackItem instanceof CallHLIR &&
                        stackItem !== stack[i + 1].callee) {
                        stack[i + 1][SHOULD_FLATTEN_CHILDREN] = true;
                    }
                }

            } else if (stack[1] && stack[1] instanceof ReturnHLIR &&
                !(node instanceof LiteralHLIR && SAFELITERALTYPES.has(node.litType)) &&
                !(node instanceof SymbolHLIR) &&
                !(node instanceof NewHLIR)) {
                node[SHOULD_FLATTEN] = true;

            } else if (stack[1] && stack[1] instanceof MemberHLIR &&
                stack[1].resolveType(ctx)[symbols.IS_METHOD] &&
                (!stack[2] || stack[2] instanceof CallHLIR)) {
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

            var type = node.getType(ctx);
            var decl = getTempDecl(type);
            ctx.addVar(decl.identifier, type, decl[symbols.ASSIGNED_NAME]);
            injectBefore(decl);

            if (type._type !== 'primitive' || node.value) {
                injectBefore(new AssignmentHLIR(getDeclReference(decl, type), node));
            }

            return getDeclReference(decl, type);

        });

    }

}

function isNodeBoundary(node, member) {
    return node instanceof FunctionHLIR ||
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
        if (!(current instanceof AssignmentHLIR) || !(current.value instanceof BinopLogicalHLIR)) continue;

        // Put the correct condition in the conditional
        if (current.value.operator === 'and') {
            condition = current.base;
        } else {
            condition = new NegateHLIR(current.base, current.base.start, current.base.end);
        }

        // Create the correct conditional
        conditional = new IfHLIR(
            condition,
            [
                new AssignmentHLIR(current.base, current.value.right)
            ],
            null,
            current.start,
            current.end
        );

        current.value = current.value.left;

        body.splice(i + 1, 0, conditional);
        i++;
    }
}
