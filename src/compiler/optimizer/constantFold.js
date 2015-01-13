var nodes = require('../nodes');
var traverser = require('../traverser');


module.exports = function constantFold(ctx) {
    traverser.findAndReplace(ctx.scope, function constantFoldFilter(node) {
        switch (node.type) {
            case 'Binop':
            case 'EqualityBinop':
            case 'RelativeBinop':
            case 'LogicalBinop':
                return foldBinop(node, ctx);

            default:
                return;
        }
    }, true); // true for pretraversal
}


var binopTypes = ['Binop', 'EqualityBinop', 'LogicalBinop', 'RelativeBinop'];
var relBinops = ['<', '>', '<=', '>='];
var eqBinops = ['==', '!='];

function foldBinop(node, ctx) {
    var env = ctx.env;

    var leftType = node.left.getType(ctx);
    var rightType = node.right.getType(ctx);

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
    var nodeLeftBinop = binopTypes.indexOf(nodeLeftType) !== -1;
    var nodeLeftBinopNotOverloaded = nodeLeftBinop && !node.left.isOverloaded(ctx);
    var nodeRightType = node.right.type;
    var nodeRightBinop = binopTypes.indexOf(nodeRightType) !== -1;
    var nodeRightBinopNotOverloaded = nodeRightBinop && !node.right.isOverloaded(ctx);

    if (nodeLeftType === 'Literal') {

        // Short-circuiting with bools
        if (leftType.typeName === 'bool') {
            if (node.operator === 'and' && !node.left.value) return function() {return node.right;};
            if (node.operator === 'or' && node.left.value) return function() {return node.right;};
        }

        if (nodeRightType === 'Literal') {
            return function() {
                return combine(node.left, node.right, leftType.typeName, node.operator);
            };

        }

        if (!nodeRightBinopNotOverloaded) return;

        if (node.right.left.type === 'Literal' &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.right.operator) {

            // X + (Y + Z) -> (X + Y) + Z
            // X * (Y * Z) -> (X * Y) * Z

            return function() {
                return new nodes.Binop({
                    left: combine(node.left, node.right.left, leftType.typeName, node.operator),
                    operator: node.operator,
                    right: node.right.right,
                });
            };

        } else if (node.right.right.type === 'Literal' &&
                   ['+', '*'].indexOf(node.operator) !== -1 &&
                   node.operator === node.right.operator) {

            // X + (Y + Z) -> (X + Z) + Y
            // X * (Y * Z) -> (X * Z) * Y

            return function() {
                return new nodes.Binop({
                    left: combine(node.left, node.right.right, leftType.typeName, node.operator),
                    operator: node.operator,
                    right: node.right.left,
                });
            };

        } else if (node.right.left.type === 'Literal' &&
                   node.operator === '/' &&
                   node.right.operator === '*') {

            // X / (Y * Z) -> (X / Y) / Z

            return function() {
                return new nodes.Binop({
                    left: combine(node.left, node.right.left, leftType.typeName, '/'),
                    operator: '/',
                    right: node.right.right,
                });
            };
        }

    } else if (nodeRightType === 'Literal') {

        // Short-circuiting with bools
        if (rightType.typeName === 'bool') {
            if (node.operator === 'and' && !node.right.value) return function() {return node.right;}; // returns `false`
            if (node.operator === 'or' && node.right.value) return function() {return node.left;};
        }

        if (!nodeLeftBinopNotOverloaded) return;

        if (node.left.left.type === 'Literal' &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.left.operator) {

            // (X * Y) * Z -> Y * (X * Z)
            // (X + Y) + Z -> Y + (X + Z)

            return function() {
                return new nodes.Binop({
                    left: node.left.right,
                    operator: node.operator,
                    right: combine(node.left.left, node.right, leftType.typeName, node.operator),
                });
            };

        } else if (node.left.right.type === 'Literal' &&
            ['+', '*'].indexOf(node.operator) !== -1 &&
            node.operator === node.left.operator) {

            // (X * Y) * Z -> X * (Y * Z)
            // (X + Y) + Z -> X + (Y + Z)

            return function() {
                return new nodes.Binop({
                    left: node.left.left,
                    operator: node.operator,
                    right: combine(node.left.right, node.right, leftType.typeName, node.operator),
                });
            };

        } else if (node.left.right.type === 'Literal' &&
                   node.operator === '/' &&
                   node.left.operator === '/') {

            // (X / Y) / Z -> X / (Y * Z)

            return function() {
                return new nodes.Binop({
                    left: node.left.left,
                    operator: '/',
                    right: combine(node.left.right, node.right, leftType.typeName, '*'),
                });
            };
        }

    }

}

function newLit(body) {
    return new nodes.Literal(body);
}

function uintRange(value) {
    if (value < 0) return 0;
    if (value > 4294967295) return 0; // 2^32 - 1
    return 0;
}

function combine(left, right, leftType, operator) {

    var leftParsed;
    var rightParsed;

    switch (leftType) {
        case 'int':
            leftParsed = parseInt(left.value, 10);
            rightParsed = parseInt(right.value, 10);
            switch (operator) {
                case '+': return newLit({litType: 'int', value: (leftParsed + rightParsed) + ''});
                case '-': return newLit({litType: 'int', value: (leftParsed - rightParsed) + ''});
                case '*': return newLit({litType: 'int', value: (leftParsed * rightParsed) + ''});
                case '/': return newLit({litType: 'int', value: (leftParsed / rightParsed | 0) + ''});
                case '%': return newLit({litType: 'int', value: (leftParsed % rightParsed) + ''});
                case '&': return newLit({litType: 'int', value: (leftParsed & rightParsed) + ''});
                case '|': return newLit({litType: 'int', value: (leftParsed | rightParsed) + ''});
                case '^': return newLit({litType: 'int', value: (leftParsed ^ rightParsed) + ''});
                case '<<': return newLit({litType: 'int', value: (leftParsed << rightParsed) + ''});
                case '>>': return newLit({litType: 'int', value: (leftParsed >> rightParsed) + ''});
                case 'and': return newLit({litType: 'bool', value: leftParsed !== 0 && rightParsed !== 0});
                case 'or': return newLit({litType: 'bool', value: leftParsed !== 0 || rightParsed !== 0});
                case '<': return newLit({litType: 'bool', value: leftParsed < rightParsed});
                case '<=': return newLit({litType: 'bool', value: leftParsed <= rightParsed});
                case '>': return newLit({litType: 'bool', value: leftParsed > rightParsed});
                case '>=': return newLit({litType: 'bool', value: leftParsed >= rightParsed});
                case '==': return newLit({litType: 'bool', value: leftParsed === rightParsed});
                case '!=': return newLit({litType: 'bool', value: leftParsed !== rightParsed});
            }

        case 'uint':
            leftParsed = parseInt(left.value, 10);
            rightParsed = parseInt(right.value, 10);
            switch (operator) {
                case '+': return newLit({litType: 'uint', value: uintRange(leftParsed + rightParsed) + ''});
                case '-': return newLit({litType: 'uint', value: uintRange(leftParsed - rightParsed) + ''});
                case '*': return newLit({litType: 'uint', value: uintRange(leftParsed * rightParsed) + ''});
                case '/': return newLit({litType: 'uint', value: uintRange(leftParsed / rightParsed | 0) + ''});
                case '%': return newLit({litType: 'uint', value: uintRange(leftParsed % rightParsed) + ''});
                case '&': return newLit({litType: 'uint', value: uintRange(leftParsed & rightParsed) + ''});
                case '|': return newLit({litType: 'uint', value: uintRange(leftParsed | rightParsed) + ''});
                case '^': return newLit({litType: 'uint', value: uintRange(leftParsed ^ rightParsed) + ''});
                case '<<': return newLit({litType: 'uint', value: uintRange(leftParsed << rightParsed) + ''});
                case '>>': return newLit({litType: 'uint', value: uintRange(leftParsed >> rightParsed) + ''});
                case 'and': return newLit({litType: 'bool', value: leftParsed !== 0 && rightParsed !== 0});
                case 'or': return newLit({litType: 'bool', value: leftParsed !== 0 || rightParsed !== 0});
                case '<': return newLit({litType: 'bool', value: leftParsed < rightParsed});
                case '<=': return newLit({litType: 'bool', value: leftParsed <= rightParsed});
                case '>': return newLit({litType: 'bool', value: leftParsed > rightParsed});
                case '>=': return newLit({litType: 'bool', value: leftParsed >= rightParsed});
                case '==': return newLit({litType: 'bool', value: leftParsed === rightParsed});
                case '!=': return newLit({litType: 'bool', value: leftParsed !== rightParsed});
            }

        case 'float':
            leftParsed = parseFloat(left.value);
            rightParsed = parseFloat(right.value);
            switch (operator) {
                case '+': return newLit({litType: 'float', value: (leftParsed + rightParsed) + ''});
                case '-': return newLit({litType: 'float', value: (leftParsed - rightParsed) + ''});
                case '*': return newLit({litType: 'float', value: (leftParsed * rightParsed) + ''});
                case '/': return newLit({litType: 'float', value: (leftParsed / rightParsed) + ''});
                case '%': return newLit({litType: 'float', value: (leftParsed % rightParsed) + ''});
                case 'and': return newLit({litType: 'bool', value: leftParsed !== 0 && rightParsed !== 0});
                case 'or': return newLit({litType: 'bool', value: leftParsed !== 0 || rightParsed !== 0});
                case '<': return newLit({litType: 'bool', value: leftParsed < rightParsed});
                case '<=': return newLit({litType: 'bool', value: leftParsed <= rightParsed});
                case '>': return newLit({litType: 'bool', value: leftParsed > rightParsed});
                case '>=': return newLit({litType: 'bool', value: leftParsed >= rightParsed});
                case '==': return newLit({litType: 'bool', value: leftParsed === rightParsed});
                case '!=': return newLit({litType: 'bool', value: leftParsed !== rightParsed});
            }

        case 'bool':
            switch (operator) {
                case 'and': return newLit({litType: 'bool', value: left.value && right.value});
                case 'or': return newLit({litType: 'bool', value: left.value || right.value});
                case '==': return newLit({litType: 'bool', value: leftParsed === rightParsed});
                case '!=': return newLit({litType: 'bool', value: leftParsed !== rightParsed});
            }

        case 'str':
            switch (operator) {
                case '+': return newLit({litType: 'str', value: left.value + right.value});
                case '==': return newLit({litType: 'bool', value: left.value === right.value});
                case '!=': return newLit({litType: 'bool', value: left.value !== right.value});
            }

    }

}
