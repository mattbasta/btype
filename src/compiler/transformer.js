var function_contexts = require('./function_contexts');
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

                // Mark function expressions directly.
                if (node.type === 'Function') {
                    if (marker === 'body') return;
                    if (marker === 'loop') return;
                    if (marker === 'consequent') return;
                    if (marker === 'alternate') return;
                    node.__firstClass = true;
                }

                stack.unshift(node);
                return;
            }

            // Ignore symbols that don't point to functions.
            if (!(node.__refType instanceof types.Func)) return false;

            // Ignore symbols that are the callees of Call nodes. Calling a
            // declared function doesn't make the function first-class.
            if (stack[0].type === 'CallRaw' && marker === 'callee') return false;

            // If it's falsey, it means that it's a variable declaration of
            // type `func`, not a function declaration.
            if (!node.__refContext.isFuncMap[node.__refName]) return false;

            node.__refContext.functionDeclarations[node.__refName].__firstClass = true;

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

function updateSymbolReferences(funcNode, tree, rootContext, refType) {
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
        // If one is provided, do the same for the refType
        if (refType) {
            symbol.__refType = refType;
        }
    });
}

function willFunctionNeedContext(ctx) {
    return ctx.functions.some(function(func) {
        return func.__context.accessesLexicalScope;
    });
}

function getFunctionContext(ctx, name) {
    var mapping = {};
    // Find the lexical lookups in each descendant context and put them into a mapping
    traverser.traverse(ctx.scope, function(node) {
        if (!node || node.type !== 'Function') return;
        if (node.sideEffectFree) return false;

        for (var lookup in node.__context.lexicalLookups) {
            if (lookup in mapping) continue;
            if (node.__context.lexicalLookups[lookup] === ctx) {
                mapping[lookup] = ctx.typeMap[lookup];
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
                        base: getReference(node.__assignedName),
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
        if (!node || node.type !== 'Function') return;

        if (!node.__originalType) {
            node.__originalType = node.getType(node.__context);
        }

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
        if (!node || node.type !== 'CallRaw') return;
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

    // Replace calls to function declarations with CallDecl nodes and calls to
    // references with CallRef.
    traverser.findAndReplace(node, function(node) {
        if (node.type !== 'CallRaw') return;

        var isDeclaration = !!context.isFuncMap[node.callee.__refName];
        if (!isDeclaration &&
            node.callee.type === 'Member' &&
            node.callee.base.getType(context)._type === 'module') {
            isDeclaration = true;
        }
        var newNodeType = nodes[isDeclaration ? 'CallDecl' : 'CallRef'];
        return function(node) {
            return new newNodeType(
                node.start,
                node.end,
                {
                    callee: node.callee,
                    params: node.params,
                }
            );
        };

    });

    // Replace first class function delcarations with variable declarations
    traverser.iterateBodies(node, function(body) {
        if (!body) return;
        for (var i = 0; i < body.length; i++) {
            (function(iterNode, i) {
                if (!iterNode || iterNode.type !== 'Function') return;
                if (!iterNode.__firstClass) return false;

                body.splice(
                    i,
                    1,
                    new nodes.Declaration(
                        iterNode.start,
                        iterNode.end,
                        {
                            declType: iterNode.getType(context),
                            identifier: iterNode.name,
                            __assignedName: iterNode.__assignedName,
                            value: new nodes.FunctionReference({
                                base: iterNode,
                                ctx: new nodes.Symbol({
                                    name: ctxName,
                                    __refContext: context,
                                    __refType: ctxType,
                                    __refName: ctxName,
                                }),
                            }),
                        }
                    )
                );
            }(body[i], i));
        }
    });

    var stack = [];
    traverser.traverse(node, function(node) {
        if (node.type === 'Function' && node.__firstClass && stack[0].type !== 'FunctionReference') {
            stack[0].substitute(function(x) {
                if (x !== node) return x;
                return new nodes.FunctionReference({
                    base: node,
                    ctx: new nodes.Symbol({
                        name: ctxName,
                        __refContext: context,
                        __refType: ctxType,
                        __refName: ctxName,
                    }),
                });
            });
            return;
        }

        stack.unshift(node);
    }, function(node) {
        stack.shift();
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
    updateSymbolReferences(node, ctxparent.scope, rootContext, node.getType(rootContext));
    ctxparent.accessesGlobalScope = true;

    // Replace the function itself with a symbol rather than a direct reference
    // or nothing if it is defined as a declaration.
    var stack = [ctxparent.scope];
    var newName;
    var oldName = node.__assignedName;
    traverser.traverse(ctxparent.scope, function(iterNode, marker) {
        if (!iterNode) return false;

        if (iterNode === node) {
            marker = marker || 'body';
            if (stack[0][marker] instanceof Array) {
                stack[0][marker] = removeItem(stack[0][marker], iterNode);
            } else {
                newName = node.__assignedName = ctx.env.namer();
                stack[0][marker] = new nodes.Symbol({
                    name: node.name,
                    __refContext: rootContext,
                    __refType: node.getType(ctxparent),
                    __refName: newName,
                });
            }
            return false;
        }

        stack.unshift(iterNode);
    }, function(iterNode) {
        if (!iterNode) return false;
        stack.shift();
    });

    // If we gave the function a new name to prevent collisions with local
    // variables, we need to update CallDecl nodes that point at the old name.
    if (newName) {
        traverser.traverse(ctxparent.scope, function(iterNode, marker) {
            if (!iterNode || iterNode.type !== 'CallDecl') return;
            if (iterNode.callee.type !== 'Symbol') return;
            if (iterNode.callee.__refName !== oldName) return;

            iterNode.callee.__refName = newName;
        });
    }
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

    debugger;
};

transform.getFunctionContext = getFunctionContext;
transform.willFunctionNeedContext = willFunctionNeedContext;
transform.markFirstClassFunctions = markFirstClassFunctions;
