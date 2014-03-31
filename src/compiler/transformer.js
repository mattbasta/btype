var nodes = require('./nodes');
var traverser = require('./traverser');

/*
See the following URL for details on the implementation of this file:
https://github.com/mattbasta/btype/wiki/Transformation
*/

function markFirstClassFunctions(context) {
    /*
    This function searches for nested functions within a context that are
    accessed such that first-class function objects are created (references to
    objects of type `func`). This happens when a Symbol node references the
    identifier of a function under these circumstances:

    - It is not the callee of a Call node
    - It is not the l-value of an Assignment
    */
    var result = [];
    var stack = [];
    traverser.traverse(
        context.scope,
        function(node, marker) {
            if (node.type === 'Symbol') {
                // Ignore symbols that don't point to functions.
                if (node.__refType.name !== 'func') return false;
                // Ignore symbols that meet the stop conditions above.
                if (stack[0].type === 'Assignment' && marker === 'base' ||
                    stack[0].type === 'Call' && marker === 'callee') {
                    return false;
                }
                // Get the actual function node and add it to the result set.
                // Note that we don't check for duplicates, but the marking
                // process is idempotent so it shouldn't matter.
                result.push(node.__refContext.functionDeclarations[node.name]);
                // There's nothing left to do with a symbol, so hard return.
                return false;
            }

            stack.unshift(node);
        },
        function() {
            stack.shift(node);
        }
    );

    result.forEach(function(func) {
        func.__firstClass = true;
    });

    return result;
}

var transform = module.exports = function(context) {

    // First step: mark all first class functions as such.
    markFirstClassFunctions(context);

    var resultingFuncs = [];

    function processFunc(node, context) {
        //
    }

    function processContext(ctx, tree) {
        // Iterate over each child context.
        ctx.functions.forEach(function(funcNode) {
            processContext(funcNode.__context);
        });

        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(tree, ctx);
    }

    processContext(context);
};
