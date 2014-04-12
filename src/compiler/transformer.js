var generatorNodes = require('./generators/nodes');
var nodes = require('./nodes');
var traverser = require('./traverser');
var types = require('./types');



function node(name, start, end, args) {
    return new (nodes[name])(start, end, args);
}

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
                if (stack[0].type === 'Call' && marker !== 'callee') {
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
function removeElement(obj, key) {
    var out = {};
    for (var k in obj) {
        if (k === key) continue;
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

function getFunctionContext(ctx) {
    var mapping = {};
    traverser.traverse(ctx.scope, function(node) {
        if (!node) return;
        if (node.type === 'Function') {
            if (node.sideEffectFree || node.lexicalSideEffectFree) return false;

            for (var lookup in node.__context.lexicalLookups) {
                if (lookup in mapping) continue;
                if (node.__context.lexicalLookups[lookup] === ctx &&
                    ctx.nameMap[lookup] in node.__context.lexicalModifications) {
                    mapping[lookup] = ctx.vars[lookup];
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
    var members = funcctxType.members = {};
    var offset = 0;
    mappingOrder.forEach(function(mem) {
        var type = mapping[mem];
        (function(offset) {
            members[mem] = function(ptr) {
                return generatorNodes.HeapLookup({
                    heap: type.getHeap(),
                    pointer: ptr,
                    offset: generatorNodes.Literal({value: offset})
                });
            };
        })(offset);
        offset += type.baseSize();
    });
    funcctxType.fullSize = function() {
        return offset;
    };
    var funcctx = new nodes.Declaration(0, 0, {
        declType: funcctxType,
        identifier: '$ctx',
        value: new nodes.New(0, 0, {
            newType: funcctxType,
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
            context.vars['$ctx'] = funcctx.declType;
            context.nameMap['$ctx'] = funcctx.__assignedName;

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
                    node.name in ctxMapping) {

                    return function(node) {
                        return getReference(node.name);
                    };
                }

                if (node.type === 'Declaration' &&
                    node.identifier in ctxMapping) {
                    // Delete the node.
                    return function(node) {
                        return new nodes.Assignment(
                            node.start,
                            node.end,
                            {
                                base: getReference(node.name),
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
                    ctx.lexicalLookups['$ctx'] = context;
                    hasChanged = true;
                });
            });

            // Remove all of the converted variables from the `vars` and
            // `nameMap` fields.
            funcctx.__mappingOrder.forEach(function(name) {
                context.vars = removeElement(context.vars, name);
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

        } else if (context.accessesLexicalScope && context.lexicalSideEffectFree && !node.__firstClass) {

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
                lookupType = lookupOrigContext.vars[lexicalLookup];

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

                context.vars[lexicalLookup] = lookupType;
                var newAssignedName = context.nameMap[lexicalLookup] = rootContext.env.namer();

                lookupIdentifier = new nodes.TypedIdentifier(0, 0, {
                    idType: lookupType,
                    name: '$$' + lexicalLookup,
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
                        node.name === lexicalLookup &&
                        node.__refContext === lookupOrigContext;
                }).forEach(function(symbol) {
                    symbol.name = '$$' + symbol.name;
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
                    if (travNode && travNode.type === 'Function' && travNode.name in travNode.__context.vars) {
                        return false;
                    }

                    if (travNode && travNode.type === 'Call' &&
                        travNode.callee.type === 'Symbol' &&
                        travNode.callee.__refName === node.__assignedName) {

                        if (travNode.params.length === node.params.length) return;

                        lookupOrder.forEach(function(param) {
                            travNode.params.push(new nodes.Symbol(
                                0,
                                0,
                                {
                                    name: param.name,
                                    __refContext: context,
                                    __refName: param.__assignedName,
                                    __refType: param.idType,
                                    __context: travNode.__context
                                }
                            ));

                            if (travNode.__context !== travNode.__refContext) {
                                var currCtx = travNode.__context;
                                while (currCtx && currCtx !== travNode.__refContext) {
                                    currCtx.lexicalLookups[param.__assignedName] = travNode.__refContext;
                                    currCtx = currCtx.parent;
                                }
                            }
                        });

                        // If we're causing a new lexical lookup for a node
                        // that has already gone through the transformation
                        // process, process it a second time. If we don't,
                        // those lexical lookups won't get processed.
                        console.log(travNode.callee.name, travNode.__context.scope.name);
                        if (travNode.__context !== ctxparent &&
                            travNode.__context.parent &&  // Don't do this on the global scope
                            travNode.__context.__transformed) {

                            processContext(travNode.__context, travNode.__context.scope);
                        }

                    }
                });
            }

        }

        // TODO: Handle Class 3 functions by replacing references to them with
        // `New` nodes creating `func` types.

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
        ctxparent.vars = removeElement(ctxparent.vars, node.name);
        ctxparent.nameMap = removeElement(ctxparent.nameMap, node.name);
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
