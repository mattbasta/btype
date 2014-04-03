var nodes = require('./nodes');
var traverser = require('./traverser');

/*
See the following URL for details on the implementation of this file:
https://github.com/mattbasta/btype/wiki/Transformation

Some notes about transformation:
- Context.functionDeclarations is not updated. This is intentional to prevent
  issues with name collisions.
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
            if (!node) return false;

            if (node.type === 'Symbol') {
                // Ignore symbols that don't point to functions.
                if (node.__refType.name !== 'func') return false;
                // Ignore symbols that meet the stop conditions above.
                if (stack[0].type === 'Assignment' && marker !== 'base' ||
                    stack[0].type === 'Call' && marker !== 'callee') {
                    return false;
                }
                // Get the actual function node and add it to the result set.
                // Note that we don't check for duplicates, but the marking
                // process is idempotent so it shouldn't matter.
                var funcDecl = node.__refContext.functionDeclarations[node.name];

                // If it's null, it means that it's a variable declaration of
                // type `func`, not a function declaration.
                if (!funcDecl) return false;

                result.push(funcDecl);

                // There's nothing left to do with a symbol, so hard return.
                return false;
            }

            stack.unshift(node);
        },
        function(node) {
            stack.shift(node);
        }
    );

    result.forEach(function(func) {
        func.__firstClass = true;
    });

    return result;
}

function removeItem(array, item) {
    return array.filter(function(x) {return x !== item;});
}

function updateSymbolReferences(funcNode, tree, rootContext) {
    var targetContext = funcNode.__context.parent;
    traverser.findAll(tree, function(node) {
        if (!node) return false;
        // Target every Symbol that references the function that's passed
        // (lives in the function's parent's context and references the
        // function's name).
        return node.type === 'Symbol' &&
            node.__refContext === targetContext &&
            node.name === funcNode.name;
    }).forEach(function(symbol) {
        // Update the symbol's reference context to the root context.
        symbol.__refContext = rootContext;
    });
}

var transform = module.exports = function(rootContext) {

    // First step: mark all first class functions as such.
    markFirstClassFunctions(rootContext);

    var resultingFuncs = [];

    function processFunc(node, context) {
        var ctxparent = context.parent;
        // Detect whether the function is side-effect free to the extent that we care.
        if (!context.accessesLexicalScope &&
            context.lexicalSideEffectFree &&
            !node.__firstClass) {
            // In this case, the function can be directly uplifted to the
            // global scope with no modifications.

            // If we're already in the global scope, just ignore everything. No
            // changes are needed.
            if (ctxparent === rootContext) return;

            rootContext.functions.push(node);
            ctxparent.functions = removeItem(ctxparent.functions, node);
            ctxparent.accessesGlobalScope = true;  // Since the function is in the global scope now.
            // NOTE: We do not update `ctxparent.functionDeclarations` since it
            // shouldn't be used for anything after type checking, name
            // assignment, and context generation has completed.

            // Update all references to the function to point to the global scope.
            updateSymbolReferences(node, ctxparent.scope, rootContext);

        } else if (false) {
        } else {}
    }

    function processContext(ctx, tree) {
        // Iterate over each child context.
        ctx.functions.forEach(function(funcNode) {
            processContext(funcNode.__context);
        });

        if (ctx === rootContext) return;

        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(tree, ctx);
    }

    processContext(rootContext);
};

transform.markFirstClassFunctions = markFirstClassFunctions;
