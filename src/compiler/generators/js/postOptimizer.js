var esprima = require('esprima');
var escodegen = require('escodegen');


function traverse(node, cb, after) {
    cb(node);
    for (var key in node) {
        if (node.hasOwnProperty(key)) {
            var child = node[key];
            if (typeof child === 'object' && child !== null) {
                if (Array.isArray(child)) {
                    child.forEach(function(node) {
                        traverse(node, cb);
                    });
                } else {
                    traverse(child, cb);
                }
            }
        }
    }
    if (after) after(node);
}


function trimBody(body) {
    // TODO: This doesn't work for cycles in the call graph. It should be made
    // to be more robust.

    var encounteredIdentifiers = {};
    var stack = [];
    traverse(body, function(node) {
        stack.unshift(node);
        if (node.type !== 'Identifier') return;
        if (stack[1].type === 'FunctionDeclaration') return;
        if (stack[1].type === 'VariableDeclarator') return;
        if (node.name in encounteredIdentifiers) return;

        encounteredIdentifiers[node.name] = true;
    }, function() {
        stack.shift();
    });

    var anyRemoved = false;
    body.body = body.body.filter(function(node) {
        var kept = true;
        if (node.type === 'FunctionDeclaration') {
            kept = node.id.name in encounteredIdentifiers;
            anyRemoved = anyRemoved || !kept;
        } else if (node.type === 'VariableDeclaration') {
            node.declarations = node.declarations.filter(function(decl) {
                return decl.id.name in encounteredIdentifiers;
            });
            kept = !!node.declarations.length;
            anyRemoved = anyRemoved || !kept;
        }
        return kept;
    });

    if (anyRemoved) trimBody(body);
}

function orderCode(body) {
    function getType(node) {
        if (node.type === 'VariableDeclaration') {
            var decl = node.declarations[0];
            if (decl.init.type === 'MemberExpression') {
                return 0;
            }
            if (decl.init.type === 'NewExpression') {
                return 1;
            }
            if (decl.init.type === 'ArrayExpression') {
                return 3;
            }
            return 0;
        }
        if (node.type === 'FunctionDeclaration') {
            return 2;
        }
        if (node.type === 'ReturnStatement') {
            return 4;
        }
        return -1;
    }
    body.body.sort(function(a, b) {
        return getType(a) - getType(b);
    });

    // Sort function bodies
    traverse(body, function(node) {
        if (node.type !== 'FunctionDeclaration') return;

        var params = node.params.map(function(p) {
            return p.name;
        });

        function isParamAnnotation(node) {
            if (node.type !== 'ExpressionStatement' ||
                node.expression.type !== 'AssignmentExpression' ||
                node.expression.left.type !== 'Identifier' ||
                params.indexOf(node.expression.left.name) === -1) {
                return false;
            }

            if (node.expression.right.type === 'UnaryExpression' &&
                node.expression.right.argument.type === 'Identifier' &&
                node.expression.right.argument.name === node.expression.left.name) {
                return true;
            }
            if (node.expression.right.type === 'BinaryExpression' &&
                node.expression.right.left.type === 'Identifier' &&
                node.expression.right.left.name === node.expression.left.name) {
                return true;
            }

            return false;
        }

        function getInnerType(node) {
            // Identify param type annotations
            var paramIdx;
            if (node.type === 'ExpressionStatement' &&
                node.expression.type === 'AssignmentExpression' &&
                node.expression.left.type === 'Identifier' &&
                (paramIdx = params.indexOf(node.expression.left.name)) !== -1) {

                if (node.expression.right.type === 'UnaryExpression' &&
                    node.expression.right.argument.type === 'Identifier' &&
                    node.expression.right.argument.name === node.expression.left.name) {
                    return paramIdx;
                }
                if (node.expression.right.type === 'BinaryExpression' &&
                    node.expression.right.left.type === 'Identifier' &&
                    node.expression.right.left.name === node.expression.left.name) {
                    return paramIdx;
                }

            }
            if (node.type === 'VariableDeclaration') return params.length;
            return params.length + 1;
        }
        var origBody = node.body.body;
        var bodyPrefix = [];
        while (origBody.length && isParamAnnotation(origBody[0])) {
            bodyPrefix.push(origBody[0]);
            origBody.splice(0, 1);
        }

        bodyPrefix = bodyPrefix.concat(origBody.filter(function(x) {
            return x.type === 'VariableDeclaration';
        }));
        origBody = origBody.filter(function(x) {
            return x.type !== 'VariableDeclaration';
        });

        node.body.body = bodyPrefix.concat(origBody);
    });
}

exports.optimize = function(body) {
    // process.exit(1);
    var parsed = esprima.parse('(function() {' + body + '})', {raw: true});
    var parsedBody = parsed.body[0].expression.body;

    trimBody(parsedBody);
    orderCode(parsedBody);

    // console.log(parsed.body[0].expression.body.body);
    // console.log(Object.keys(parsed.body[0]));

    parsedBody.type = 'Program';
    return escodegen.generate(
        parsedBody,
        {
            directive: true,
            parse: esprima.parse,
            raw: true,
        }
    );

};
