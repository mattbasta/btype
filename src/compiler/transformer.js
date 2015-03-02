var functionContexts = require('./functionContexts');
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

            // Ignore symbols that are the base of Export nodes.
            if (stack[0].type === 'Export') return false;

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
    return array;
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
    var funcctxType = functionContexts.newFuncCtx(funcctxTypeName, mapping, ctx);

    var wrappedType = new nodes.Type({
        attributes: [],
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

function processRoot(rootContext) {
    // In the root context, the first thing we want to do is convert any
    // function expressions into function references.
    var stack = [];
    var funcsToAppend = [];
    traverser.traverse(rootContext.scope, function(node, member) {
        if (node.type !== 'Function') {
            stack.unshift(node);
            return;
        }

        // Ignore non-expression functions
        if (member === 'body' ||
            stack[0] instanceof nodes.ObjectConstructor ||
            stack[0] instanceof nodes.ObjectMethod) {
            return false;
        }

        funcsToAppend.push(node);

        stack[0][member] = new nodes.FunctionReference({
            base: new nodes.Symbol({
                name: node.name || node.__assignedName,
                __refContext: rootContext,
                __refType: node.getType(rootContext),
                __refName: node.__assignedName,
                __isFunc: true,
            }),
            ctx: null,
        });
        return false;

    }, function() {
        stack.shift();
    });

    rootContext.scope.body = rootContext.scope.body.concat(funcsToAppend);

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
    // transformations is not decreased.

    if (ctx !== rootContext) {
        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(rootContext, tree, ctx);
        processCallNodes(tree, ctx);

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

    var ctxName;
    var funcctx;
    var ctxMapping;
    var ctxType;

    function getContextReference() {
        if (!funcctx) {
            return new nodes.Literal({
                litType: 'null',
                value: null,
            });
        }

        return new nodes.Symbol({
            name: ctxName,
            __refContext: context,
            __refType: ctxType,
            __refName: ctxName,
            __isFunc: false,
        });

    }

    if (willFunctionNeedContext(context)) {

        ctxName = context.env.namer();

        funcctx = getFunctionContext(context, ctxName);
        context.__funcctx = funcctx;

        ctxMapping = funcctx.__mapping;
        node.body.unshift(funcctx);

        ctxType = funcctx.declType.getType(context);
        context.addVar(ctxName, ctxType, ctxName);

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

            node.params.unshift(new nodes.TypedIdentifier({
                idType: funcctx.__ctxTypeNode,
                name: ctxName,
                __assignedName: ctxName,
                __context: ctx,
                __refContext: context,
            }));

            ctx.addVar(ctxName, ctxType, ctxName);
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
            if (node.callee.type !== 'Symbol') return;
            // Ignore calls to non-functions
            if (!node.callee.__isFunc) return;

            node.params.unshift(getContextReference());
        });

    }

    // Replace first class function delcarations with variable declarations
    traverser.iterateBodies(node, function(body) {
        if (!body) return;
        for (var i = 0; i < body.length; i++) {
            (function(iterNode, i) {
                if (!iterNode || iterNode.type !== 'Function') return;
                if (!iterNode.__firstClass) return false;

                var type = iterNode.getType(context);
                context.env.registerFunc(iterNode);
                body.splice(
                    i,
                    1,
                    new nodes.Declaration(
                        iterNode.start,
                        iterNode.end,
                        {
                            declType: new nodes.Type({
                                __type: type,
                                name: type.typeName || type._type,
                            }),
                            identifier: iterNode.name,
                            __assignedName: iterNode.__assignedName,
                            value: new nodes.FunctionReference({
                                base: iterNode,
                                ctx: getContextReference(),
                            }),
                        }
                    )
                );
            }(body[i], i));
        }
    });

    var stack = [];
    traverser.traverse(node, function(node) {
        if (!node) return;

        function replacer(x) {
            if (x !== node) return x;
            context.env.registerFunc(node);
            return new nodes.FunctionReference({
                base: node,
                ctx: getContextReference(),
            });
        }

        if (stack[0] && node.type === 'Function' && node.__firstClass && stack[0].type !== 'FunctionReference') {
            stack[0].substitute(replacer);
            return;
        }

        stack.unshift(node);
    }, function(node) {
        stack.shift();
    });

}

function processCallNodes(node, context) {
    // Replace calls to function declarations with CallDecl nodes and calls to
    // references with CallRef.
    traverser.findAndReplace(node, function(node) {
        if (node.type !== 'CallRaw') return;

        var isDeclaration = !!context.isFuncMap[node.callee.__refName];
        if (!isDeclaration && node.callee.type === 'Member') {
            var baseType = node.callee.base.getType(context);
            if (baseType._type === 'module' || baseType.flatTypeName() === 'foreign') {
                isDeclaration = true;
            }
        } else if (!isDeclaration && node.callee.type === 'Symbol') {
            isDeclaration = node.callee.__refContext.isFuncMap[node.callee.__refName];
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

    }, true);
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

        // If you encounter someting other than the function, ignore it and
        // push it to the stack.
        if (iterNode !== node) {
            stack.unshift(iterNode);
            return;
        }

        // Figure out how to replace the element in its parent.
        marker = marker || 'body';
        if (stack[0][marker] instanceof Array) {
            // If it's an array member in the parent, use `removeItem` to
            // remove it.
            stack[0][marker] = removeItem(stack[0][marker], iterNode);
        } else {
            // Otherwise, replace the function with a symbol referencing the
            // function.
            stack[0][marker] = new nodes.Symbol({
                name: node.name,
                __refContext: rootContext,
                __refType: node.getType(ctxparent),
                __refName: node.__assignedName + '$$origFunc$',
                __refIndex: node.__funclistIndex,
                __isFunc: true,
            });
        }
        return false;
    }, function(iterNode) {
        if (!iterNode) return false;
        stack.shift();
    });

    rootContext.scope.body.push(node);
    var oldName = node.__assignedName;
    var newName = node.__assignedName += '$$origFunc$';

    // Replace the old assigned name with the new one within the uplifted
    // function.
    traverser.traverse(node, function(x) {
        if (x.type !== 'Symbol') return;
        if (x.__refName !== oldName) return;
        x.__refName = newName;
    });

    // Replace the old function name in the old parent context.
    var stack = [];
    traverser.traverse(ctxparent.scope, function(x) {
        if (x.type !== 'Symbol') {
            stack.unshift(x);
            return;
        }
        if (!stack[0]) return;
        if (stack[0].type !== 'CallDecl') return;
        if (x.__refName !== oldName) return;
        x.__refName = newName;
        x.__refContext = rootContext;
    }, function() {
        stack.shift();
    });

    // If the function is in a function table, update it there as well.
    if (node.__funcList) {
        rootContext.env.funcList[node.__funcList][node.__funclistIndex] = newName;
    }


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
    processRoot(rootContext);

    // Perform all uplifting at the end.
    rootContext.__transformEncounteredContexts.forEach(upliftContext.bind(null, rootContext));
};

transform.getFunctionContext = getFunctionContext;
transform.willFunctionNeedContext = willFunctionNeedContext;
transform.markFirstClassFunctions = markFirstClassFunctions;
