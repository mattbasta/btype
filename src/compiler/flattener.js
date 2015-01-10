var nodes = require('./nodes');
var traverser = require('./traverser');
var types = require('./types');


var safeLiteralTypes = {
    bool: true,
    float: true,
    int: true,
    'null': true,
};


module.exports = function(rootContext) {
    rootContext.functions.forEach(function(func) {
        traverser.iterateBodies(func, function(body, member) {
            if (!body) return;
            upliftExpressionsFromBody(func.__context, body);
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
        return new nodes.Declaration({
            __context: ctx,

            declType: new nodes.Type({
                traits: [],
                name: type.typeName,
            }),

            identifier: name,
            __assignedName: name,
            value: new nodes.Literal({
                litType: (type.typeName === 'float' ? 'float' : 'int'),
                value: 0,
            }),
        });
    }

    function getDeclReference(decl, type) {
        return new nodes.Symbol({
            name: decl.identifier,
            __refContext: ctx,
            __refName: decl.__assignedName,
            __refType: type,
        });
    }

    var current;
    for (var i = 0; i < body.length; i++) {

        current = body[i];

        // Mark which expressions to flatten
        var stack = [];
        traverser.traverseWithSelf(current, function(node, member) {
            if (isNodeBoundary(node, member)) return false;

            stack.unshift(node);

            var i;
            var temp;
            if (node.type === 'LogicalBinop') {

                if (stack.length === 1 &&
                    current.type === 'Assignment' &&
                    node === current.value) {
                    return;
                }

                for (i = 0; i < stack.length; i++) {
                    if (stack[i].type === 'LogicalBinop' ||
                        stack[i].type === 'EqualityBinop' ||
                        stack[i].type === 'RelativeBinop' ||
                        stack[i].type === 'Binop') {
                        stack[i].__shouldFlatten = true;
                    }

                    if (i + 1 >= stack.length) continue;
                    if ((stack[i + 1].type === 'CallRaw' ||
                         stack[i + 1].type === 'CallDecl' ||
                         stack[i + 1].type === 'CallRef') &&
                        stack[i] !== stack[i + 1].callee) {

                        stack[i + 1].__shouldFlattenChildren = true;
                    }
                }

            } else if (stack[1] && stack[1].type === 'Return' &&
                !(node.type === 'Literal' && node.litType in safeLiteralTypes) &&
                node.type !== 'Symbol' &&
                node.type !== 'New') {
                node.__shouldFlatten = true;

            } else if (stack[1] && stack[1].type === 'Member' &&
                stack[1].getType(ctx).__isMethod) {
                stack[1].__shouldFlatten = true;
            }

        }, function(node) {
            stack.shift();
        });

        traverse(current, function(node, member) {
            if (isNodeBoundary(node, member)) {
                return false;
            }
            stack.unshift(node);
        }, function(node) {
            if (stack.length > 1 && stack[1].__shouldFlattenChildren && node !== stack[1].callee) {
                node.__shouldFlatten = true;
            }

            stack.shift();
            if (!node.__shouldFlatten) {
                return;
            }

            var type = node.getType(ctx);
            var decl = getTempDecl(type);
            ctx.addVar(decl.identifier, type, decl.__assignedName);
            injectBefore(decl);

            if (node.type !== 'Primitive' || node.value) {
                injectBefore(new nodes.Assignment({
                    base: getDeclReference(decl, type),
                    value: node,
                }));
            }

            return getDeclReference(decl, type);

        });

    }

}

function isNodeBoundary(node, member) {
    return node.type === 'Function' ||
        member === 'consequent' ||
        member === 'alternate' ||
        member === 'loop' ||
        member === 'body';
}

function traverse(tree, filter, replacer) {
    if (!tree || !tree.traverse) return;
    tree.traverse.call(tree, function(node, member) {
        if (filter(node) === false) return;
        traverse(node, filter, replacer);

        var replacement = replacer(node, member);
        if (!replacement) return;

        tree.substitute(function(x) {
            if (x === node) return replacement;
            return x;
        });

    });
}


function convertLogicalBinops(body) {
    var condition;
    var conditional;

    var current;
    for (var i = 0; i < body.length; i++) {
        current = body[i];
        if (current.type !== 'Assignment' || current.value.type !== 'LogicalBinop') continue;

        // Put the correct condition in the conditional
        if (current.value.operator === 'and') {
            condition = current.base;
        } else {
            condition = new nodes.Unary({
                base: current.base,
                operator: '!',
            });
        }

        // Create the correct conditional
        conditional = new nodes.If({
            condition: condition,
            consequent: [
                new nodes.Assignment({
                    base: current.base,
                    value: current.value.right,
                }),
            ]
        });

        current.value = current.value.left;

        body.splice(i + 1, 0, conditional);
        i++;
    }
}
