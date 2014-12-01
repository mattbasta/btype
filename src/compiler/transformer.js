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

            // There's nothing left to do with a symbol, so hard return.
            return false;
        },
        function(node) {
            stack.shift(node);
        }
    );
}

function convertFCFuncsToVariables(context) {
    var stack = [];
    traverser.traverse(
        context.scope,
        function(node, marker) {
            if (!node) return false;

            if (node.type === 'Symbol') {
                // Ignore symbols that don't point to functions.
                if (!(node.__refType instanceof types.Func)) return false;
                // Ignore symbols that are the callees of Call nodes
                if (stack[0].type === 'Call' && marker === 'callee') {
                    return false;
                }

                // If it's falsey, it means that it's a variable declaration of
                // type `func`, not a function declaration.
                if (!node.__refContext.isFuncMap[node.__refName]) return false;

                result.push(node.__refContext.functionDeclarations[node.__refName]);

                // There's nothing left to do with a symbol, so hard return.
                return false;
            }

            stack.unshift(node);
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
            return;
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
    var willIt = false;
    ctx.functions.forEach(function(func) {
        willIt = willIt || func.__firstClass || !func.sideEffectFree;
    });
    return willIt;
}

function wrapType(baseType) {
    if (!baseType) return null;
    return new nodes.Type({
        __type: baseType,
        traits: baseType.traits.map(wrapType),
        name: baseType.name
    });
}

function getFunctionContext(ctx) {
    var mapping = {};
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
        identifier: '$ctx',
        value: new nodes.New({
            newType: wrappedType,
            params: []
        })
    });
    funcctx.__mapping = mapping;

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
    // Perform Class 3 transformations first.
    // These have to be done on the parent context, since the variables
    // that are accessed lexically need to be moved into a funcctx.
    if (willFunctionNeedContext(context)) {

        var funcctx = getFunctionContext(context);
        context.__funcctx = funcctx;
        context.nameMap['$ctx'] = funcctx.__assignedName;
        context.typeMap[funcctx.__assignedName] = funcctx.declType.getType(context);

        var ctxMapping = funcctx.__mapping;
        node.body.unshift(funcctx);

        function getReference(name) {
            return new nodes.Member({
                base: new nodes.Symbol({
                    name: '$ctx',
                    __refContext: context,
                    __refType: funcctx.declType.getType(context),
                    __refName: funcctx.__assignedName,
                }),
                child: name,
            });
        }

        traverser.findAndReplace(node, function(node) {
            // Replace symbols referencing declarations that are now inside
            // the funcctx with member expressions
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
                            value: node.value
                        }
                    );
                };
            }
        });

        // Find all of the functions that reference any of those variables
        // and replace the lexical lookups with lookups to the context
        // object.
        traverser.traverse(node, function(node) {
            if (!node || node.type !== 'Function') return false;
            var ctx = node.__context;
            var hasChanged = false;
            funcctx.contentsTypeArr.forEach(function(mem) {
                if (!(mem in ctx.lexicalLookups)) return;
                if (ctx.lexicalLookups[mem] !== context) return;

                delete ctx.lexicalLookups[mem];

                if (hasChanged) return;
                ctx.lexicalLookups[funcctx.__assignedName] = context;
                hasChanged = true;
            });
        });

        // Remove all of the converted variables from the `typeMap` and
        // `nameMap` fields.
        funcctx.contentsTypeArr.forEach(function(name) {
            delete context.typeMap[name];
            context.nameMap = removeElement(context.nameMap, name);
        });

        // TODO: If the function's params are used lexically, copy their
        // values into the funcctx and remove their declarations and
        // convert lookups to them into member expressions.
    }

    var ctxparent = context.parent;
    // Detect whether the function is side-effect free to the extent that we care.
    if (!context.accessesLexicalScope && context.sideEffectFree && !node.__firstClass) {
        // Class 1 transformations are no-op, so just return.
        return;
    }


    // If we're already in the global scope, no changes are needed.
    if (ctxparent === rootContext) return;

    // Convert lexical scope lookups to function parameters
    var lookupType;
    var lookupOrigContext;
    var lookupIdentifier;
    var lookupOrder = [];
    var numChanges = 0;
    for (var lexicalLookup in context.lexicalLookups) {
        lookupOrigContext = context.lexicalLookups[lexicalLookup];
        lookupType = lookupOrigContext.typeMap[lexicalLookup];

        delete context.lexicalLookups[lexicalLookup];

        // If the lookup is for a non-first class function declaration,
        // don't make it a param.
        if (lookupType.typeName === 'func' &&
            lookupOrigContext.functionDeclarations[lexicalLookup] &&
            !lookupOrigContext.functionDeclarations[lexicalLookup].__firstClass) {

            // Do the same for nested functions.
            traverser.findAll(context.scope, function(node) {
                return node && node.type === 'Function' &&
                    lexicalLookup in node.__context.lexicalLookups &&
                    node.__context.lexicalLookups[lexicalLookup] === lookupOrigContext;
            }).forEach(function(scope) {
                delete node.__context.lexicalLookups[lexicalLookup];
                if (node.__context.sideEffectFree && !objectSize(node.__context.lexicalLookups)) {
                    node.__context.accessesLexicalScope = false;
                }
            });
            continue;
        }

        numChanges++;

        context.typeMap[lexicalLookup] = lookupType;
        var newAssignedName = context.nameMap[lexicalLookup] = rootContext.env.namer();

        lookupIdentifier = new nodes.TypedIdentifier({
            idType: new nodes.Type({
                name: lookupType.typeName || lookupType.name,
                traits: [],
                __type: lookupType,
            }),
            name: lexicalLookup,
            __origName: lexicalLookup,
            __assignedName: newAssignedName,
            __context: node.__context,
            __refContext: lookupOrigContext,
        })
        node.params.push(lookupIdentifier);
        lookupOrder.push(lookupIdentifier);

        // Find all symbols that reference the lexical lookup from
        // within our own scope and update them to use the param.
        traverser.findAll(ctxparent.scope, function(node) {
            return node && node.type === 'Symbol' &&
                node.__refName === lexicalLookup &&
                node.__refContext === lookupOrigContext;
        }).forEach(function(symbol) {
            symbol.name = lexicalLookup;
            symbol.__refContext = context;
            symbol.__refName = newAssignedName;
        });

        // Update any nested functions to use the parameter as well.
        traverser.traverse(ctxparent.scope, function(node) {
            if (node && node.type === 'Function' &&
                lexicalLookup in node.__context.lexicalLookups &&
                node.__context.lexicalLookups[lexicalLookup] === lookupOrigContext) {

                node.__context.lexicalLookups[lexicalLookup] = context;
                // node.__context.
            }
        });

    }

    // Don't do any more modifications if we aren't modifying the parameter set.
    if (numChanges) {
        // Find all function calls that point to the current function,
        // then iterate over them and add the updated parameters.
        traverser.traverse(ctxparent.scope, function(travNode) {
            // Ignore functions which override the function.
            if (travNode && travNode.type === 'Function' &&
                travNode.__assignedName in travNode.__context.functionDeclarations) {
                return false;
            }

            if (!travNode || travNode.type !== 'Call' ||
                travNode.callee.type !== 'Symbol' ||
                travNode.callee.__refName !== node.__assignedName) {
                return;
            }

            if (travNode.params.length === node.params.length) return;

            lookupOrder.forEach(function(param) {
                travNode.params.push(new nodes.Symbol({
                    name: param.__assignedName,
                    __refContext: context,
                    __refName: param.__assignedName,
                    __refType: param.getType(context),
                    __context: travNode.__context,
                }));

                if (travNode.__context !== travNode.__refContext) {
                    var currCtx = travNode.__context;
                    while (currCtx && currCtx !== travNode.__refContext) {
                        currCtx.lexicalLookups[param.name] = travNode.callee.__refContext;

                        console.log(travNode.callee.__refType);
                        currCtx.typeMap[param.name] = travNode.callee.__refType;
                        currCtx.accessesLexicalScope = true;
                        currCtx = currCtx.parent;
                    }
                }
            });

            // If we're causing a new lexical lookup for a node
            // that has already gone through the transformation
            // process, process it a second time. If we don't,
            // those lexical lookups won't get processed.
            if (travNode.__context !== ctxparent &&
                travNode.__context.parent &&  // Don't do this on the global scope
                travNode.__context.__transformed) {

                processContext(rootContext, travNode.__context, travNode.__context.scope);
            }

        });
    }


    if (node.__firstClass) {
        var nodeType = node.getType(node.__context);
        var nodeIndex = node.__context.env.registerFunc(node);

        // Replace lexical lookups with lookups to members in the passed function context.
        traverser.findAndReplace(ctxparent.scope, function(travNode) {
            if (travNode.type !== 'Symbol' || travNode.__refName !== node.__assignedName) {
                return;
            }
            return function(travNode) {
                return new nodes.New({
                    newType: wrapType(nodeType),
                    params: [
                        new nodes.Literal({
                            value: nodeIndex,
                            litType: new nodes.Type({
                                name: 'int',
                                traits: []
                            })
                        }),
                        // TODO/FIXME: This needs to create lookups all
                        // the way up the context chain and then call
                        // for a re-process at the end if __transformed
                        // is truthy.
                        new nodes.Symbol({
                            name: ctxparent.__funcctx.__assignedName,
                            __refContext: ctxparent,
                            __refName: ctxparent.__funcctx.__assignedName,
                            __refType: ctxparent.typeMap[ctxparent.__funcctx.__assignedName],
                        })
                    ]
                });
            };
        });
    }

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

    // Then, convert all first class function declarations to variable declarations
    convertFCFuncsToVariables(rootContext);

    // Traverse down into the context tree and process each context in turn.
    // This uses depth-first search.
    processContext(rootContext, rootContext);

    // Perform all uplifting at the end.
    rootContext.__transformEncounteredContexts.forEach(upliftContext.bind(null, rootContext));
};

transform.getFunctionContext = getFunctionContext;
transform.willFunctionNeedContext = willFunctionNeedContext;
transform.markFirstClassFunctions = markFirstClassFunctions;
