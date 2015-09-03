import CallHLIR from '../hlirNodes/CallHLIR';
import DeclarationHLIR from '../hlirNodes/DeclarationHLIR';
import ExportHLIR from '../hlirNodes/ExportHLIR';
import Func from './types/Func';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import NewHLIR from '../hlirNodes/NewHLIR';
import SymbolHLIR from '../hlirNodes/SymbolHLIR';
import * as symbols from '../symbols';
import TypeHLIR from '../hlirNodes/TypeHLIR';


const TRANSFORM_ENCOUNTERED_CTXS = Symbol();
const TRANSFORMED = Symbol();
const MAPPING = Symbol();
const CTX_TYPEMAPPING = Symbol();

/*
See the following URL for details on the implementation of this file:
https://github.com/mattbasta/btype/wiki/Transformation

Some notes about transformation:
- Context.functionDeclarations is not updated. This is intentional to prevent
  issues with name collisions.
*/

function markFirstClassFunctions(context) {
    var stack = [];
    context.scope.iterate(
        (node, marker) => {
            if (!(node instanceof SymbolHLIR)) {

                if (node instanceof FunctionHLIR) {
                    if (marker === 'body') return;
                    if (marker === 'consequent') return;
                    if (marker === 'alternate') return;
                    node[symbols.IS_FIRSTCLASS] = true;
                }

                stack.unshift(node);
                return;
            }

            // Ignore symbols that don't point to functions.
            if (!(node[symbols.REFTYPE] instanceof Func)) return false;

            // Ignore symbols that are the callees of Call nodes. Calling a
            // declared function doesn't make the function first-class.
            if (stack[0] instanceof CallHLIR && marker === 'callee') return false;

            // Ignore symbols that are the base of Export nodes.
            if (stack[0] instanceof ExportHLIR) return false;

            // If it's falsey, it means that it's a variable declaration of
            // type `func`, not a function declaration.
            if (!node[symbols.REFCONTEXT].isFuncMap.has(node[symbols.REFNAME])) return false;

            node[symbols.REFCONTEXT].functionDeclarations.get(node[symbols.REFNAME])[symbols.IS_FIRSTCLASS] = true;

            // There's nothing left to do with a symbol, so hard return.
            return false;
        },
        node => stack.shift(node)
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

function updateSymbolReferences(funcNode, tree, rootContext, refType) {
    var targetContext = funcNode[symbols.CONTEXT].parent;
    tree.iterate(node => {
        if (node instanceof SymbolHLIR &&
            node[symbols.REFCONTEXT] === targetContext &&
            node.name === funcNode.name) {

            // Update the symbol's reference context to the root context.
            node[symbols.REFCONTEXT] = rootContext;
            // If one is provided, do the same for the refType
            if (refType) {
                node[symbols.REFTYPE] = refType;
            }
        }
    });
}

function willFunctionNeedContext(ctx) {
    return Array.from(ctx.functions.entries()).some(f => f[symbols.CONTEXT].accessesLexicalScope);
}

function getFunctionContext(ctx, name) {
    var mapping = new Map();
    // Find the lexical lookups in each descendant context and put them into a mapping
    ctx.scope.iterate(node => {
        if (!(node instanceof FunctionHLIR)) return;
        if (node.sideEffectFree) return false;

        for (var lookup of node[symbols.CONTEXT].lexicalLookups.keys()) {
            if (mapping.has(lookup)) continue;
            if (node[symbols.CONTEXT].lexicalLookups.get(lookup) === ctx) {
                mapping.set(lookup, ctx.typeMap.get(lookup));
            }
        }
    });


    var funcctxTypeName = (ctx.scope.name || 'anon') + '$fctx';
    var wrappedType = TypeHLIR(funcctxTypeName, [], ctx.scope.start, ctx.scope.end);

    var funcctx = new DeclarationHLIR(
        wrappedType,
        name,
        new NewHLIR(
            wrappedType,
            [],
            ctx.scope.start,
            ctx.scope.end
        ),
        ctx.scope.start,
        ctx.scope.end
    );
    funcctx[symbols.CONTEXT] = ctx;
    funcctx[symbols.ASSIGNED_NAME] = name;
    funcctx[MAPPING] = mapping;
    funcctx[CTX_TYPEMAPPING] = wrappedType;

    return funcctx;
}

function processRoot(rootContext) {
    // In the root context, the first thing we want to do is convert any
    // function expressions into function references.
    var stack = [];
    var funcsToAppend = [];
    rootContext.scope.iterate((node, member) => {
        if (!(node instanceof FunctionHLIR)) {
            stack.unshift(node);
            return;
        }

        // Ignore non-expression functions
        if (member === 'body' || stack[0][symbols.IS_METHOD]) {
            return false;
        }

        funcsToAppend.push(node);

        var funcType = node.resolveType(rootContext);
        var freftype = new TypeHLIR('func', [], node.start, node.end);
        freftype.forceType(funcType);

        var refSym = new SymbolHLIR(node.name || node[symbols.ASSIGNED_NAME], node.start, node.end);
        refSym[symbols.REFCONTEXT] = rootContext;
        refSym[symbols.REFTYPE] = funcType;
        refSym[symbols.REFNAME] = node[symbols.ASSIGNED_NAME];

        stack[0][member] = new NewHLIR(
            frefType,
            [refSym]
            node.start,
            node.end
        );
        return false;

    }, () => stack.shift());

    rootContext.scope.body = rootContext.scope.body.concat(funcsToAppend);

}

function processContext(rootCtx, ctx, tree) {
    var encounteredContexts = rootCtx[TRANSFORM_ENCOUNTERED_CTXS] = rootCtx[TRANSFORM_ENCOUNTERED_CTXS] || new Set();

    // This function runs from the outermost scope to the innermost scope.
    // Though that may be counterintuitive, the result should ultimately be
    // the same. This order is used to allow lexical lookup-to-parameter
    // conversion.
    // Since side effects are not introduced directly when a function
    // contains other nested functions, the efficacy of class 1
    // transformations is not decreased.

    if (ctx !== rootCtx) {
        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(rootCtx, tree, ctx);
        processCallNodes(tree, ctx);

        // Don't count encountered contexts twice.
        encounteredContexts.add(ctx);
    }

    ctx[TRANSFORMED] = true;

    // Iterate over each child context.
    ctx.functions.forEach(funcNode => processContext(rootCtx, funcNode[symbols.CONTEXT]));

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

        ctxMapping = funcctx[MAPPING];
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
                node[symbols.ASSIGNED_NAME] in ctxMapping) {
                // Delete the node.
                return function(node) {
                    return new nodes.Assignment(
                        node.start,
                        node.end,
                        {
                            base: getReference(node[symbols.ASSIGNED_NAME]),
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
                idType: funcctx[CTX_TYPEMAPPING],
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
            context.nameMap.delete(name);
            context.typeMap.delete(name);
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
                            __assignedName: iterNode[symbols.ASSIGNED_NAME],
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
    rootContext.functions.add(node);
    ctxparent.functions.delete(node);

    ctxparent.nameMap.delete(node.name);
    ctxparent.typeMap.delete(node[symbols.ASSIGNED_NAME]);
    ctxparent.isFuncSet.delete(node[symbols.ASSIGNED_NAME]);
    updateSymbolReferences(node, ctxparent.scope, rootContext, node.resolveType(rootContext));
    ctxparent.accessesGlobalScope = true;

    // Replace the function itself with a symbol rather than a direct reference
    // or nothing if it is defined as a declaration.
    var stack = [ctxparent.scope];
    var newName;
    var oldName = node[symbols.ASSIGNED_NAME];
    ctxparent.scope.iterate((iterNode, marker) => {
        // If you encounter someting other than the function, ignore it and
        // push it to the stack.
        if (iterNode !== node) {
            stack.unshift(iterNode);
            return;
        }

        // Figure out how to replace the element in its parent.
        marker = marker || 'body';
        if (Array.isArray(stack[0][marker])) {
            // If it's an array member in the parent, use `removeItem` to
            // remove it.
            stack[0][marker] = removeItem(stack[0][marker], iterNode);
        } else {
            // Otherwise, replace the function with a symbol referencing the
            // function.
            let newSymbol = stack[0][marker] = new SymbolHLIR(
                node.name,
                node.start,
                node.end
            );
            newSymbol[symbols.REFCONTEXT] = rootContext;
            newSymbol[symbols.REFTYPE] = node.resolveType(ctxparent);
            newSymbol[symbols.REFNAME] = node[symbols.ASSIGNED_NAME] + '$$origFunc$';
            newSymbol[symbols.REFINDEX] = node[FUNCLIST_IDX];
            newSymbol[symbols.IS_FUNC] = true;
        }
        return false;

    }, iterNode => stack.shift());

    rootContext.scope.body.push(node);
    var oldName = node[symbols.ASSIGNED_NAME];
    var newName = node[symbols.ASSIGNED_NAME] += '$$origFunc$';

    // Replace the old assigned name with the new one within the uplifted
    // function.
    node.iterate(x => {
        if (!(x instanceof SymbolHLIR)) return;
        if (x[symbols.REFNAME] !== oldName) return;
        x[symbols.REFNAME] = newName;
    });

    // Replace the old function name in the old parent context.
    var stack = [];
    ctxparent.scope.iterate(
        x => {
            if (!(x instanceof SymbolHLIR)) {
                stack.unshift(x);
                return;
            }
            if (!stack[0]) return;
            if (!(stack[0] instanceof CallHLIR)) return;
            if (x[symbols.REFNAME] !== oldName) return;
            x[symbols.REFNAME] = newName;
            x[symbols.REFCONTEXT] = rootContext;
        },
        () => stack.shift()
    );

    // If the function is in a function table, update it there as well.
    if (node[symbols.FUNCLIST]) {
        rootContext.env.funcList.get(node[symbols.FUNCLIST]).set(node[symbols.FUNCLIST_IDX], newName);
    }


    // NOTE: We do not update `ctxparent.functionDeclarations` since it
    // shouldn't be used for anything after type checking, name
    // assignment, and context generation has completed.
}

export default function transform(rootCtx) {
    // First mark all first class functions as such.
    markFirstClassFunctions(rootCtx);

    // Traverse down into the context tree and process each context in turn.
    // This uses depth-first search.
    processContext(rootCtx, rootCtx);
    processRoot(rootCtx);

    // Perform all uplifting at the end.
    rootCtx[TRANSFORM_ENCOUNTERED_CTXS].forEach(upliftContext.bind(null, rootCtx));
};
