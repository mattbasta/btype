var function_contexts = require('./function_contexts');
var generatorNodes = require('./generators/nodes');
var nodes = require('./nodes');
var traverser = require('./traverser');
var types = require('./types');


/*
See the following URL for details on the implementation of this file:
https://github.com/mattbasta/btype/wiki/Transformation

Some notes about transformation:
- Context.functionDeclarations is not updated. This is intentional to prevent
  issues with name collisions.
*/

function markFirstClassFunctions(context) {
    var stack = [];
    traverser.traverse(
        context.scope,
        function(node, marker) {
            if (!node) return false;

            // Ignore non-Symbol nodes but keep them in the stack.
            if (node.type !== 'Symbol') {
                stack.unshift(node);
                return;
            }

            // Ignore symbols that don't point to functions.
            if (!(node.__refType instanceof types.Func)) return false;

            // Ignore symbols that are the callees of Call nodes. Calling a
            // declared function doesn't make the function first-class.
            if (stack[0].type === 'Call' && marker === 'callee') return false;

            // If it's falsey, it means that it's a variable declaration of
            // type `func`, not a function declaration.
            if (!node.__refContext.isFuncMap[node.__refName]) return false;

            node.__refContext.functionDeclarations[node.__refName].__firstClass = true;
            node.__refsFirstClassFunction = true;

            // There's nothing left to do with a symbol, so hard return.
            return false;
        },
        function(node) {
            stack.shift(node);
        }
    );
}

function removeItem(array, item) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === item) {
            array.splice(i, 1);
            return array;
        }
    }
}
function removeElement(obj, val) {
    var out = {};
    for (var k in obj) {
        if (obj[k] === val) continue;
        out[k] = obj[k];
    }
    return out;
}

function updateSymbolReferences(funcNode, tree, rootContext, refName) {
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
        // If one is provided, do the same for the refName
        if (refName) {
            symbol.__refName = refName;
        }
    });
}

function removeNode(target, tree) {
    var stack = [tree];
    traverser.traverse(tree, function(node, marker) {
        if (!node) return false;

        if (node === target) {
            marker = marker || 'body';
            stack[0][marker] = removeItem(stack[0][marker], node);
            return false;
        }

        stack.unshift(node);
    }, function(node) {
        if (!node) return false;
        stack.shift();
    });
}

function objectSize(obj) {
    return Object.keys(obj).length;
}

function willFunctionNeedContext(ctx) {
    return ctx.functions.some(function(func) {
        return func.__context.accessesLexicalScope;
    });
}

function wrapType(baseType) {
    if (!baseType) return null;
    return new nodes.Type({
        __type: baseType,
        traits: baseType.traits.map(wrapType),
        name: baseType.name
    });
}

function getFunctionContext(ctx, name) {
    var mapping = {};
    // Find the lexical lookups in each descendant context and put them into a mapping
    traverser.traverse(ctx.scope, function(node) {
        if (!node) return;
        if (node.type === 'Function') {
            if (node.sideEffectFree) return false;

            for (var lookup in node.__context.lexicalLookups) {
                if (lookup in mapping) continue;
                if (node.__context.lexicalLookups[lookup] === ctx &&
                    lookup in node.__context.lexicalModifications) {
                    mapping[lookup] = ctx.typeMap[lookup];
                }
            }
        }
    });


    var funcctxTypeName = (ctx.scope.name || 'anon') + '$fctx';
    var funcctxType = function_contexts.newFuncCtx(funcctxTypeName, mapping, ctx);

    var wrappedType = new nodes.Type({
        traits: [],
        name: funcctxTypeName,
    });

    var funcctx = new nodes.Declaration({
        __context: ctx,
        declType: wrappedType,
        identifier: name,
        __assignedName: name,
        value: new nodes.New({
            newType: wrappedType,
            params: [],
        }),
    });
    funcctx.__mapping = mapping;
    funcctx.__ctxTypeNode = wrappedType;

    return funcctx;
}

function processContext(rootContext, ctx, tree) {
    rootContext.__transformEncounteredContexts = rootContext.__transformEncounteredContexts || [];
    var encounteredContexts = rootContext.__transformEncounteredContexts;

    // This function runs from the outermost scope to the innermost scope.
    // Though that may be counterintuitive, the result should ultimately be
    // the same. This order is used to allow lexical lookup-to-parameter
    // conversion.
    // Since side effects are not introduced directly when a function
    // contains other nested functions, the efficacy of class 1
    // transfprmations is not decreased.

    if (ctx !== rootContext) {
        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(rootContext, tree, ctx);

        // Don't count encountered contexts twice.
        if (encounteredContexts.indexOf(ctx) === -1) {
            encounteredContexts.push(ctx);
        }
    }

    ctx.__transformed = true;

    // Iterate over each child context.
    ctx.functions.forEach(function(funcNode) {
        processContext(rootContext, funcNode.__context);
    });

}

function processFunc(rootContext, node, context) {

    if (!willFunctionNeedContext(context)) return;

    var ctxName = context.env.namer();

    var funcctx = getFunctionContext(context, ctxName);
    context.__funcctx = funcctx;

    var ctxMapping = funcctx.__mapping;
    node.body.unshift(funcctx);

    var ctxType = funcctx.declType.getType(context);

    function getReference(name) {
        return new nodes.Member({
            base: new nodes.Symbol({
                name: ctxName,
                __refContext: context,
                __refType: ctxType,
                __refName: ctxName,
            }),
            child: name,
        });
    }

    // Replace symbols referencing declarations that are now inside the
    // funcctx with member expressions
    traverser.findAndReplace(node, function(node) {
        if (node.type === 'Symbol' &&
            node.__refContext === context &&
            node.__refName in ctxMapping) {

            return function(node) {
                return getReference(node.__refName);
            };
        }

        if (node.type === 'Declaration' &&
            node.__assignedName in ctxMapping) {
            // Delete the node.
            return function(node) {
                return new nodes.Assignment(
                    node.start,
                    node.end,
                    {
                        base: getReference(node.__refName),
                        value: node.value,
                    }
                );
            };
        }
    });

    // Put initial parameter values into the context
    context.scope.params.forEach(function(param) {
        var assignedName = context.nameMap[param.name];
        if (!(assignedName in ctxMapping)) return;
        var assign = new nodes.Assignment({
            base: getReference(assignedName),
            value: new nodes.Symbol({
                name: param.name,
                __refContext: context,
                __refType: param.getType(context),
                __refName: assignedName,
            }),
        });
        node.body.splice(1, 0, assign);
    });

    // Remove lexical lookups from the context objects and add the parameter
    traverser.traverse(node, function(node) {
        if (!node || node.type !== 'Function') return false;

        var ctx = node.__context;
        for (var mem in ctxMapping) {
            if (!(mem in ctx.lexicalLookups)) return; // Ignore lexical lookups not in this scope
            if (ctx.lexicalLookups[mem] !== context) return; // Ignore lexical lookups from other scopes

            delete ctx.lexicalLookups[mem];
        }

        node.params.push(new nodes.TypedIdentifier({
            idType: funcctx.__ctxTypeNode,
            name: ctxName,
            __assignedName: ctxName,
            __context: ctx,
            __refContext: context,
        }));

        ctx.addVar(ctxName, ctxType);
    });

    // Remove all of the converted variables from the `typeMap` and
    // `nameMap` fields.
    for (var name in ctxMapping) {
        delete context.nameMap[name];
        delete context.typeMap[name];
        context.nameMap = removeElement(context.nameMap, name);
    }

    // Finally, find all of the calls to the functions and add the appropriate
    // new parameter.
    traverser.traverse(node, function(node) {
        if (!node || node.type !== 'Call') return false;
        // Ignore calls to non-symbols
        if (node.callee.type !== 'Symbol') return false;
        // Ignore calls to non-functions
        if (!node.callee.__isFunc) return false;

        node.params.push(new nodes.Symbol({
            name: ctxName,
            __refContext: context,
            __refName: ctxName,
            __refType: ctxType,
            __isFunc: false,
        }));
    });


}

function upliftContext(rootContext, ctx) {
    var ctxparent = ctx.parent;
    if (ctxparent === rootContext) return;

    var node = ctx.scope;
    rootContext.functions.push(node);

    ctxparent.functions = removeItem(ctxparent.functions, node);
    delete ctxparent.nameMap[node.name];
    delete ctxparent.typeMap[node.__assignedName];
    delete ctxparent.isFuncMap[node.__assignedName];
    updateSymbolReferences(node, ctxparent.scope, rootContext);
    ctxparent.accessesGlobalScope = true;
    removeNode(node, ctxparent.scope);
    rootContext.scope.body.push(node);

    // NOTE: We do not update `ctxparent.functionDeclarations` since it
    // shouldn't be used for anything after type checking, name
    // assignment, and context generation has completed.
}

var transform = module.exports = function(rootContext) {

    // First mark all first class functions as such.
    markFirstClassFunctions(rootContext);

    // Traverse down into the context tree and process each context in turn.
    // This uses depth-first search.
    processContext(rootContext, rootContext);

    // Perform all uplifting at the end.
    rootContext.__transformEncounteredContexts.forEach(upliftContext.bind(null, rootContext));
};

transform.getFunctionContext = getFunctionContext;
transform.willFunctionNeedContext = willFunctionNeedContext;
transform.markFirstClassFunctions = markFirstClassFunctions;
