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
        if (node.name in encounteredIdentifiers) return;

        encounteredIdentifiers[node.name] = true;
    }, function() {
        stack.shift();
    });

    var anyRemoved = false;
    body.body = body.body.filter(function(node) {
        if (node.type !== 'FunctionDeclaration') return true;
        var removed = node.id.name in encounteredIdentifiers;
        anyRemoved = anyRemoved || !removed;
        return removed;
    });

    if (anyRemoved) trimBody(body);
}

function orderCode(body) {
}

exports.optimize = function(body) {
    var parsed = esprima.parse('(function() {' + body + '})');
    var parsedBody = parsed.body[0].expression.body;

    trimBody(parsedBody);
    orderCode(parsedBody);

    // console.log(parsed.body[0].expression.body.body);
    // console.log(Object.keys(parsed.body[0]));

    parsedBody.type = 'Program';
    return escodegen.generate(parsedBody, {directive: true});

};
