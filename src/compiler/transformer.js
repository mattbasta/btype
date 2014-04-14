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
    /*
    This function searches for nested functions within a context that are
    accessed such that first-class function objects are created (references to
    objects of type `func`). This happens when a Symbol node references the
    identifier of a function in any case other than as the callee of a Call
    node.
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

    result.forEach(function(func) {
        func.__firstClass = true;

        // HACK: When a function is first class, it retains its original type
        // signature (like func<null, foo, bar>), but may have bindings to
        // things in the lexical scope that would otherwise be added as params.
        // Since anything outside the parent context's scope have no knowledge
        // of those bindings, EVERYTHING that the function touches needs to be
        // included in the parent context's `funcctx` object. To accomplish
        // this, we mark all lexical lookups as lexical modifications. They
        // aren't [lexical modifications], but it makes the transformer put
        // them into the `funcctx`.
        Object.keys(func.__context.lexicalLookups).forEach(function(lookup) {
            func.__context.lexicalModifications[
                func.__context.lexicalLookups[lookup].nameMap[lookup]
            ] = true;
        });
    });

    return result;
}

function removeItem(array, item) {
    return array.filter(function(x) {return x !== item;});
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
        willIt = willIt || func.__firstClass || !func.__context.lexicalSideEffectFree;
    });
    return willIt;
}

function wrapType(baseType) {
    if (!baseType) return null;
    return new nodes.Type(0, 0, {
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
            if (node.sideEffectFree || node.lexicalSideEffectFree) return false;

            for (var lookup in node.__context.lexicalLookups) {
                if (lookup in mapping) continue;
                if (node.__context.lexicalLookups[lookup] === ctx &&
                    lookup in node.__context.lexicalModifications) {
                    mapping[lookup] = ctx.typeMap[lookup];
                }
            }
        }
    });
    var mappingOrder = Object.keys(mapping);
    var funcctxType = new types(
        'funcctx',
        mappingOrder.map(function(lookup) {
            return mapping[lookup];
        })
    );
    var members = funcctxType.members;
    var offset = 0;
    mappingOrder.forEach(function(mem) {
        var type = mapping[mem];
        (function(offset) {
            funcctxType.members[mem] = {
                generator: function(ptr) {
                    return generatorNodes.HeapLookup({
                        heap: type.getHeap(),
                        pointer: ptr,
                        offset: generatorNodes.Literal({value: offset})
                    });
                },
                type: type
            };
        })(offset);
        offset += type.baseSize();
    });
    funcctxType.fullSize = function() {
        return offset;
    };

    var wrappedType = wrapType(funcctxType);
    wrappedType.getType = function() {return funcctxType;};
    var funcctx = new nodes.Declaration(0, 0, {
        __context: ctx,
        declType: wrappedType,
        identifier: '$ctx',
        value: new nodes.New(0, 0, {
            newType: wrappedType,
            params: []
        })
    });
    funcctx.__mapping = mapping;
    funcctx.__mappingOrder = mappingOrder;

    funcctx.__assignedName = ctx.env.namer();

    return funcctx;
}

var transform = module.exports = function(rootContext) {

    // First step: mark all first class functions as such.
    markFirstClassFunctions(rootContext);

    var resultingFuncs = [];

    function processFunc(node, context) {

        // Perform Class 3 transformations first.
        // These have to be done on the parent context, since the variables
        // that are accessed lexically need to be moved into a funcctx.
        if (willFunctionNeedContext(context)) {

            var funcctx = getFunctionContext(context);
            context.__funcctx = funcctx;
            context.nameMap['$ctx'] = funcctx.__assignedName;
            context.typeMap[funcctx.__assignedName] = funcctx.declType;

            var ctxMapping = funcctx.__mapping;
            node.body.unshift(funcctx);

            traverser.findAndReplace(node, function(node) {

                function getReference(name) {
                    return new nodes.Member(0, 0, {
                        base: new nodes.Symbol(0, 0, {
                            name: '$ctx',
                            __refContext: context,
                            __refType: funcctx.declType,
                            __refName: funcctx.__assignedName
                        }),
                        child: name
                    });
                }

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
                funcctx.__mappingOrder.forEach(function(mem) {
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
            funcctx.__mappingOrder.forEach(function(name) {
                delete context.typeMap[name];
                context.nameMap = removeElement(context.nameMap, name);
            });

            // TODO: If the function's params are used lexically, copy their
            // values into the funcctx and remove their declarations and
            // convert lookups to them into member expressions.
        }

        var ctxparent = context.parent;
        // Detect whether the function is side-effect free to the extent that we care.
        if (!context.accessesLexicalScope && context.lexicalSideEffectFree && !node.__firstClass) {
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
            if (lookupType.name === 'func' &&
                lookupOrigContext.functionDeclarations[lexicalLookup] &&
                !lookupOrigContext.functionDeclarations[lexicalLookup].__firstClass) {

                // Do the same for nested functions.
                traverser.findAll(context.scope, function(node) {
                    return node && node.type === 'Function' &&
                        lexicalLookup in node.__context.lexicalLookups &&
                        node.__context.lexicalLookups[lexicalLookup] === lookupOrigContext;
                }).forEach(function(scope) {
                    delete node.__context.lexicalLookups[lexicalLookup];
                    if (node.__context.lexicalSideEffectFree && !objectSize(node.__context.lexicalLookups)) {
                        node.__context.accessesLexicalScope = false;
                    }
                });
                continue;
            }

            numChanges++;

            context.typeMap[lexicalLookup] = lookupType;
            var newAssignedName = context.nameMap[lexicalLookup] = rootContext.env.namer();

            lookupIdentifier = new nodes.TypedIdentifier(0, 0, {
                idType: lookupType,
                name: lexicalLookup,
                __origName: lexicalLookup,
                __assignedName: newAssignedName,
                __context: node.__context,
                __refContext: lookupOrigContext
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

                if (travNode && travNode.type === 'Call' &&
                    travNode.callee.type === 'Symbol' &&
                    travNode.callee.__refName === node.__assignedName) {

                    if (travNode.params.length === node.params.length) return;

                    lookupOrder.forEach(function(param) {
                        travNode.params.push(new nodes.Symbol(0, 0, {
                            name: param.__assignedName,
                            __refContext: context,
                            __refName: param.__assignedName,
                            __refType: param.idType,
                            __context: travNode.__context
                        }));

                        if (travNode.__context !== travNode.__refContext) {
                            var currCtx = travNode.__context;
                            while (currCtx && currCtx !== travNode.__refContext) {
                                currCtx.lexicalLookups[param.name] = travNode.callee.__refContext;
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

                        processContext(travNode.__context, travNode.__context.scope);
                    }

                }
            });
        }


        if (node.__firstClass) {
            var nodeType = node.getType(node.__context);
            var nodeIndex = node.__context.env.registerFunc(node);
            traverser.findAndReplace(ctxparent.scope, function(travNode) {
                if (travNode.type === 'Symbol' && travNode.__refName === node.__assignedName) {
                    return function(travNode) {
                        return new nodes.New(0, 0, {
                            newType: wrapType(nodeType),
                            params: [
                                new nodes.Literal(0, 0, {
                                    value: nodeIndex,
                                    litType: new nodes.Type(0, 0, {
                                        name: 'int',
                                        traits: []
                                    })
                                }),
                                // TODO/FIXME: This needs to create lookups all
                                // the way up the context chain and then call
                                // for a re-process at the end if __transformed
                                // is truthy.
                                new nodes.Symbol(0, 0, {
                                    name: ctxparent.__funcctx.__assignedName,
                                    __refContext: ctxparent,
                                    __refName: ctxparent.__funcctx.__assignedName,
                                    __refType: ctxparent.typeMap[ctxparent.__funcctx.__assignedName],
                                })
                            ]
                        });
                    };
                }
            });
        }

    }

    var encounteredContexts = [];
    function processContext(ctx, tree) {
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
            processFunc(tree, ctx);

            // Don't count encountered contexts twice.
            if (encounteredContexts.indexOf(ctx) === -1) {
                encounteredContexts.push(ctx);
            }
        }

        ctx.__transformed = true;

        // Iterate over each child context.
        ctx.functions.forEach(function(funcNode) {
            processContext(funcNode.__context);
        });

    }

    processContext(rootContext);

    // Perform all uplifting at the end.
    encounteredContexts.forEach(function(ctx) {
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
    });
};

transform.getFunctionContext = getFunctionContext;
transform.willFunctionNeedContext = willFunctionNeedContext;
transform.markFirstClassFunctions = markFirstClassFunctions;
