var context = require('./context');
var nodes = require('./nodes');
var traverser = require('./traverser');


/*
This file is responsible for taking all global-scoped non-declaration
statements and moving them into a function that gets executed at module
initialization.
*/


module.exports = function(ctx, env) {
    var body = ctx.scope.body;

    var prefixes = [];
    var initables = [];

    function traverseBodyFilter(node) {
        return !(node.type === 'Function' ||
                 node.type === 'OperatorStatement' ||
                 node.type === 'ObjectDeclaration');
    }

    // First uplift all of the declarations to the top level.
    traverser.iterateBodies(ctx.scope, function(body) {
        if (!body) return;

        var current;
        for (var i = 0; i < body.length; i++) {
            current = body[i];

            if (current.type !== 'Declaration') {
                continue;
            }

            if (current.value.type !== 'Literal' || current.value.litType === 'str') {
                var value = current.value;
                current.value = new nodes.Literal({
                    litType: 'null',
                    value: null,
                });

                var newNode = new nodes.Assignment({
                    base: new nodes.Symbol({
                        name: current.identifier,

                        __refName: current.__assignedName,
                        __retType: current.getType(ctx),
                        __refContext: ctx,
                    }),
                    value: value,
                });

                body.splice(i, 1, newNode);
                prefixes.push(current);

            } else {
                body.splice(i, 1);
                prefixes.push(current);
            }

            i--;

        }
    }, traverseBodyFilter);

    // Next, move all of the top-level statements that are not declarations
    // into the initables array.
    var current;
    for (var i = 0; i < ctx.scope.body.length; i++) {
        current = ctx.scope.body[i];

        switch (current.type) {
            case 'Assignment':
            case 'CallStatement':
            case 'DoWhile':
            case 'For':
            case 'If':
            case 'Switch':
            case 'While':
                initables.push(current);
                ctx.scope.body.splice(i, 1);
                i--;
                continue;
            default:
                break;
        }
    }

    if (prefixes.length) {
        ctx.scope.body.splice.apply(ctx.scope.body, [0, 0].concat(prefixes));
    }

    if (initables.length) {
        var initFunc = new nodes.Function({
            returnType: null,
            name: '$init',
            params: [],
            body: initables,
        });
        ctx.scope.body.push(initFunc);
        context(env, new nodes.Root({body: [initFunc]}), ctx.filename, ctx);

        env.addInit(initFunc);
    }

};
