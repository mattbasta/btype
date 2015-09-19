import BinopArithmeticHLIR from '../../hlirNodes/BinopArithmeticHLIR';
import BinopBitwiseHLIR from '../../hlirNodes/BinopBitwiseHLIR';
import BinopEqualityHLIR from '../../hlirNodes/BinopEqualityHLIR';
import BinopLogicalHLIR from '../../hlirNodes/BinopLogicalHLIR';
import FunctionHLIR from '../../hlirNodes/FunctionHLIR';
import LiteralHLIR from '../../hlirNodes/LiteralHLIR';
import ObjectDeclarationHLIR from '../../hlirNodes/ObjectDeclarationHLIR';
import * as symbols from '../../symbols';


export default function constantFold(ctx) {
    var ctxStack = [ctx];

    // We use this to ignore nodes in the AST. There's no clean way to perform
    // a find and replace while ignoring nodes.
    var blocked = 0;

    ctx.scope.findAndReplace(
        node => {
            if (blocked) return;
            if (node instanceof BinopArithmeticHLIR ||
                node instanceof BinopBitwiseHLIR ||
                node instanceof BinopEqualityHLIR ||
                node instanceof BinopLogicalHLIR) {
                return foldBinop(node, ctxStack[0]);
            }
        },
        true, // true for pretraversal
        node => {
            if (node instanceof FunctionHLIR) {
                ctxStack.unshift(node.__context);
            } else if (node instanceof ObjectDeclarationHLIR && !node[symbols.IS_CONSTRUCTED]) {
                blocked++;
            }
        },
        node => {
            if (node instanceof FunctionHLIR) {
                ctxStack.shift();
            } else if (node instanceof ObjectDeclarationHLIR && !node[symbols.IS_CONSTRUCTED]) {
                blocked--;
            }
        }
    );
};

const BINOP_TYPES = new Set([BinopArithmeticHLIR, BinopBitwiseHLIR, BinopEqualityHLIR, BinopLogicalHLIR]);

function foldBinop(node, ctx) {
    var env = ctx.env;

    var leftType = node.left.resolveType(ctx);
    var rightType = node.right.resolveType(ctx);

    // Don't constant fold if the two aren't the same type.
    if (!leftType.equals(rightType)) return;

    // Ignore literal nulls.
    if (leftType.typeName === 'null') return;

    var leftTypeString = leftType.flatTypeName();
    var rightTypeString = rightType.flatTypeName();

    // Test for operator overloading
    if (env.registeredOperators[leftTypeString] &&
        env.registeredOperators[leftTypeString][rightTypeString] &&
        env.registeredOperators[leftTypeString][rightTypeString][node.operator]) return;

    var nodeLeftType = node.left.type;
    var nodeLeftBinop = BINOP_TYPES.has(node.left.constructor) !== -1;
    var nodeLeftBinopNotOverloaded = nodeLeftBinop && !node.left.isOverloaded(ctx);
    var nodeRightType = node.right.type;
    var nodeRightBinop = BINOP_TYPES.has(node.right.constructor) !== -1;
    var nodeRightBinopNotOverloaded = nodeRightBinop && !node.right.isOverloaded(ctx);

    if (node.left instanceof LiteralHLIR) {

        // Short-circuiting with bools
        if (leftType.typeName === 'bool') {
            if (node.operator === 'and' && !node.left.value) return () => node.right;
            if (node.operator === 'or' && node.left.value) return () => node.right;
        }

        if (nodeRightType === 'Literal') {
            // Avoid folding into a special floating point value
            if (node.operator === '/' && parseFloat(node.right.value) === 0) {
                return () => node;
            }

            return () => combine(node.left, node.right, leftType.typeName, node.operator);
        }

        if (!nodeRightBinopNotOverloaded) return;

        if (node.right.left instanceof LiteralHLIR &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.right.operator) {

            // X + (Y + Z) -> (X + Y) + Z
            // X * (Y * Z) -> (X * Y) * Z

            return () => new BinopArithmeticHLIR(
                combine(node.left, node.right.left, leftType.typeName, node.operator),
                node.operator,
                node.right.right,
                node.left.start,
                node.right.end
            );

        } else if (node.right.right instanceof LiteralHLIR &&
                   ['+', '*'].indexOf(node.operator) !== -1 &&
                   node.operator === node.right.operator) {

            // X + (Y + Z) -> (X + Z) + Y
            // X * (Y * Z) -> (X * Z) * Y

            return () => new BinopArithmeticHLIR(
                combine(node.left, node.right.right, leftType.typeName, node.operator),
                node.operator,
                node.right.left,
                node.left.start,
                node.right.end
            );

        } else if (node.right.left instanceof LiteralHLIR &&
                   node.operator === '/' &&
                   node.right.operator === '*') {

            // X / (Y * Z) -> (X / Y) / Z

            return () => new BinopArithmeticHLIR(
                combine(node.left, node.right.left, leftType.typeName, '/'),
                node.operator,
                node.right.right,
                node.left.start,
                node.right.end
            );
        }

    } else if (node.right instanceof LiteralHLIR) {

        // Short-circuiting with bools
        if (rightType.typeName === 'bool') {
            if (node.operator === 'and' && !node.right.value) return () => node.right; // returns `false`
            if (node.operator === 'or' && node.right.value) return () => node.left;
        }

        if (!nodeLeftBinopNotOverloaded) return;

        if (node.left.left instanceof LiteralHLIR &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.left.operator) {

            // (X * Y) * Z -> Y * (X * Z)
            // (X + Y) + Z -> Y + (X + Z)

            return () => new BinopArithmeticHLIR(
                node.left.right,
                node.operator,
                combine(node.left.left, node.right, leftType.typeName, node.operator),
                node.left.start,
                node.right.end
            );

        } else if (node.left.right instanceof LiteralHLIR &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.left.operator) {

            // (X * Y) * Z -> X * (Y * Z)
            // (X + Y) + Z -> X + (Y + Z)

            return () => new BinopArithmeticHLIR(
                node.left.left,
                node.operator,
                combine(node.left.right, node.right, leftType.typeName, node.operator),
                node.left.start,
                node.right.end
            );

        } else if (node.left.right instanceof LiteralHLIR &&
                   node.operator === '/' &&
                   node.left.operator === '/') {

            // (X / Y) / Z -> X / (Y * Z)

            return () => new BinopArithmeticHLIR(
                node.left.left,
                node.operator,
                combine(node.left.right, node.right, leftType.typeName, '*'),
                node.left.start,
                node.right.end
            );
        }

    }

}

function uintRange(value) {
    if (value < 0) return 0;
    if (value > 4294967295) return 0; // 2^32 - 1
    return 0;
}

function combine(left, right, leftType, operator) {
    // TODO: Pass a start and end here

    var leftParsed;
    var rightParsed;

    switch (leftType) {
        case 'int':
            leftParsed = parseInt(left.value, 10);
            rightParsed = parseInt(right.value, 10);
            switch (operator) {
                case '+': return new LiteralHLIR('int', (leftParsed + rightParsed) + '', 0, 0);
                case '-': return new LiteralHLIR('int', (leftParsed - rightParsed) + '', 0, 0);
                case '*': return new LiteralHLIR('int', (leftParsed * rightParsed) + '', 0, 0);
                case '/': return new LiteralHLIR('int', (leftParsed / rightParsed | 0) + '', 0, 0);
                case '%': return new LiteralHLIR('int', (leftParsed % rightParsed) + '', 0, 0);
                case '&': return new LiteralHLIR('int', (leftParsed & rightParsed) + '', 0, 0);
                case '|': return new LiteralHLIR('int', (leftParsed | rightParsed) + '', 0, 0);
                case '^': return new LiteralHLIR('int', (leftParsed ^ rightParsed) + '', 0, 0);
                case '<<': return new LiteralHLIR('int', (leftParsed << rightParsed) + '', 0, 0);
                case '>>': return new LiteralHLIR('int', (leftParsed >> rightParsed) + '', 0, 0);
                case 'and': return new LiteralHLIR('bool', leftParsed !== 0 && rightParsed !== 0, 0, 0);
                case 'or': return new LiteralHLIR('bool', leftParsed !== 0 || rightParsed !== 0, 0, 0);
                case '<': return new LiteralHLIR('bool', leftParsed < rightParsed, 0, 0);
                case '<=': return new LiteralHLIR('bool', leftParsed <= rightParsed, 0, 0);
                case '>': return new LiteralHLIR('bool', leftParsed > rightParsed, 0, 0);
                case '>=': return new LiteralHLIR('bool', leftParsed >= rightParsed, 0, 0);
                case '==': return new LiteralHLIR('bool', leftParsed === rightParsed, 0, 0);
                case '!=': return new LiteralHLIR('bool', leftParsed !== rightParsed, 0, 0);
            }

        case 'uint':
            leftParsed = parseInt(left.value, 10);
            rightParsed = parseInt(right.value, 10);
            switch (operator) {
                case '+': return new LiteralHLIR('uint', uintRange(leftParsed + rightParsed) + '', 0, 0);
                case '-': return new LiteralHLIR('uint', uintRange(leftParsed - rightParsed) + '', 0, 0);
                case '*': return new LiteralHLIR('uint', uintRange(leftParsed * rightParsed) + '', 0, 0);
                case '/': return new LiteralHLIR('uint', uintRange(leftParsed / rightParsed | 0) + '', 0, 0);
                case '%': return new LiteralHLIR('uint', uintRange(leftParsed % rightParsed) + '', 0, 0);
                case '&': return new LiteralHLIR('uint', uintRange(leftParsed & rightParsed) + '', 0, 0);
                case '|': return new LiteralHLIR('uint', uintRange(leftParsed | rightParsed) + '', 0, 0);
                case '^': return new LiteralHLIR('uint', uintRange(leftParsed ^ rightParsed) + '', 0, 0);
                case '<<': return new LiteralHLIR('uint', uintRange(leftParsed << rightParsed) + '', 0, 0);
                case '>>': return new LiteralHLIR('uint', uintRange(leftParsed >> rightParsed) + '', 0, 0);
                case 'and': return new LiteralHLIR('bool', leftParsed !== 0 && rightParsed !== 0, 0, 0);
                case 'or': return new LiteralHLIR('bool', leftParsed !== 0 || rightParsed !== 0, 0, 0);
                case '<': return new LiteralHLIR('bool', leftParsed < rightParsed, 0, 0);
                case '<=': return new LiteralHLIR('bool', leftParsed <= rightParsed, 0, 0);
                case '>': return new LiteralHLIR('bool', leftParsed > rightParsed, 0, 0);
                case '>=': return new LiteralHLIR('bool', leftParsed >= rightParsed, 0, 0);
                case '==': return new LiteralHLIR('bool', leftParsed === rightParsed, 0, 0);
                case '!=': return new LiteralHLIR('bool', leftParsed !== rightParsed, 0, 0);
            }

        case 'float':
            leftParsed = parseFloat(left.value);
            rightParsed = parseFloat(right.value);
            switch (operator) {
                case '+': return new LiteralHLIR('float', (leftParsed + rightParsed) + '', 0, 0);
                case '-': return new LiteralHLIR('float', (leftParsed - rightParsed) + '', 0, 0);
                case '*': return new LiteralHLIR('float', (leftParsed * rightParsed) + '', 0, 0);
                case '/': return new LiteralHLIR('float', (leftParsed / rightParsed) + '', 0, 0);
                case '%': return new LiteralHLIR('float', (leftParsed % rightParsed) + '', 0, 0);
                case 'and': return new LiteralHLIR('bool', leftParsed !== 0 && rightParsed !== 0, 0, 0);
                case 'or': return new LiteralHLIR('bool', leftParsed !== 0 || rightParsed !== 0, 0, 0);
                case '<': return new LiteralHLIR('bool', leftParsed < rightParsed, 0, 0);
                case '<=': return new LiteralHLIR('bool', leftParsed <= rightParsed, 0, 0);
                case '>': return new LiteralHLIR('bool', leftParsed > rightParsed, 0, 0);
                case '>=': return new LiteralHLIR('bool', leftParsed >= rightParsed, 0, 0);
                case '==': return new LiteralHLIR('bool', leftParsed === rightParsed, 0, 0);
                case '!=': return new LiteralHLIR('bool', leftParsed !== rightParsed, 0, 0);
            }

        case 'bool':
            switch (operator) {
                case 'and': return new LiteralHLIR('bool', left.value && right.value, 0, 0);
                case 'or': return new LiteralHLIR('bool', left.value || right.value, 0, 0);
                case '==': return new LiteralHLIR('bool', leftParsed === rightParsed, 0, 0);
                case '!=': return new LiteralHLIR('bool', leftParsed !== rightParsed, 0, 0);
            }

        case 'str':
            switch (operator) {
                case '+': return new LiteralHLIR('str', left.value + right.value, 0, 0);
                case '==': return new LiteralHLIR('bool', left.value === right.value, 0, 0);
                case '!=': return new LiteralHLIR('bool', left.value !== right.value, 0, 0);
            }

    }

}
