import Func from './types/Func';
import * as hlirNodes from '../hlirNodes';
import * as symbols from '../symbols';


const TRANSFORM_ENCOUNTERED_CTXS = Symbol();
const TRANSFORMED = Symbol();
const MAPPING = Symbol();
const CTX_TYPEMAPPING = Symbol();
const ORIG_TYPE = Symbol();

/*
See the following URL for details on the implementation of this file:
https://github.com/mattbasta/btype/wiki/Transformation

Some notes about transformation:
- Context.functionDeclarations is not updated. This is intentional to prevent
  issues with name collisions.
*/

export function markFirstClassFunctions(context) {
    var stack = [];
    context.scope.iterate(
        (node, marker) => {
            if (!(node instanceof hlirNodes.SymbolHLIR)) {

                if (node instanceof hlirNodes.FunctionHLIR) {
                    context.functionDeclarations.set(node[symbols.ASSIGNED_NAME], node);

                    if (marker === 'body') return;
                    if (marker === 'consequent') return;
                    if (marker === 'alternate') return;

                    // From object declarations
                    if (marker === 'objConstructor') return;
                    if (marker === 'methods') return;
                    if (marker === 'operators') return;

                    node[symbols.IS_FIRSTCLASS] = true;
                }

                stack.unshift(node);
                return;
            }

            // Ignore symbols that don't point to functions.
            if (!(node[symbols.REFTYPE] instanceof Func)) return false;

            // Ignore symbols that are the callees of Call nodes. Calling a
            // declared function doesn't make the function first-class.
            if (stack[0] instanceof hlirNodes.CallHLIR && marker === 'callee') return false;

            // Ignore symbols that are the base of Export nodes.
            if (stack[0] instanceof hlirNodes.ExportHLIR) return false;

            // If it's falsey, it means that it's a variable declaration of
            // type `func`, not a function declaration.
            if (!node[symbols.REFCONTEXT].isFuncSet.has(node[symbols.REFNAME])) return false;

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
        if (node instanceof hlirNodes.SymbolHLIR &&
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
    for (var e of ctx.functions.entries()) {
        if (e.accessesLexicalScope) {
            return true;
        }
    }
    return false;
}

function getFunctionContext(ctx, name) {
    var mapping = new Map();
    // Find the lexical lookups in each descendant context and put them into a mapping
    ctx.scope.iterate(node => {
        if (!(node instanceof hlirNodes.FunctionHLIR)) return;
        if (node.sideEffectFree) return false;

        for (var lookup of node[symbols.CONTEXT].lexicalLookups.keys()) {
            if (mapping.has(lookup)) continue;
            if (node[symbols.CONTEXT].lexicalLookups.get(lookup) === ctx) {
                mapping.set(lookup, ctx.typeMap.get(lookup));
            }
        }
    });

    var wrappedType = hlirNodes.TypeHLIR.from(
        ctx.scope.resolveType(),
        ctx.scope.start,
        ctx.scope.end
    );

    var reference = new hlirNodes.SymbolHLIR(ctx.scope.name, 0, 0);
    reference[symbols.REFCONTEXT] = ctx.parent;
    reference[symbols.REFTYPE] = ctx.scope.resolveType();
    reference[symbols.REFNAME] = ctx.scope[symbols.ASSIGNED_NAME];

    var funcctx = new hlirNodes.DeclarationHLIR(
        wrappedType,
        name,
        hlirNodes.NewHLIR.asFuncRef(
            wrappedType,
            [reference, new hlirNodes.LiteralHLIR('null', null, 0, 0)],
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
        if (!(node instanceof hlirNodes.FunctionHLIR)) {
            stack.unshift(node);
            return;
        }

        // Ignore non-expression functions
        if (member === 'body' || node[symbols.IS_METHOD]) {
            return false;
        }

        funcsToAppend.push(node);

        var funcType = node.resolveType(rootContext);
        var frefType = new hlirNodes.TypeHLIR('func', [], node.start, node.end);
        frefType.forceType(funcType);

        var refSym = new hlirNodes.SymbolHLIR(node.name || node[symbols.ASSIGNED_NAME], node.start, node.end);
        refSym[symbols.REFCONTEXT] = rootContext;
        refSym[symbols.REFTYPE] = funcType;
        refSym[symbols.REFNAME] = node[symbols.ASSIGNED_NAME];
        refSym[symbols.REFIDX] = node[symbols.FUNCLIST_IDX];

        stack[0][member] = new hlirNodes.NewHLIR(
            frefType,
            [refSym],
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
            return new hlirNodes.LiteralHLIR('null', null, 0, 0);
        }

        var out = new hlirNodes.SymbolHLIR(ctxName, 0, 0);
        out[symbols.REFCONTEXT] = context;
        out[symbols.REFTYPE] = ctxType;
        out[symbols.REFNAME] = ctxName;
        out[symbols.IS_FUNC] = false;
        return out;

    }

    if (willFunctionNeedContext(context)) {
        ctxName = context.env.namer();
        funcctx = getFunctionContext(context, ctxName);

        ctxMapping = funcctx[MAPPING];
        node.body.unshift(funcctx);

        ctxType = funcctx.declType.resolveType(context);
        context.addVar(ctxName, ctxType, ctxName);

        function getReference(name) {
            var base = new hlirNodes.SymbolHLIR(ctxName, 0, 0);
            base[symbols.REFCONTEXT] = context;
            base[symbols.REFTYPE] = ctxType;
            base[symbols.REFNAME] = ctxName;
            return new hlirNodes.MemberHLIR(base, name, 0, 0);
        }

        // Replace symbols referencing declarations that are now inside the
        // funcctx with member expressions
        node.findAndReplace(node => {
            if (node instanceof hlirNodes.SymbolHLIR &&
                node[symbols.REFCONTEXT] === context &&
                ctxMapping.has(node[symbols.REFNAME])) {

                return node => getReference(node[symbols.REFNAME]);
            }

            if (node instanceof hlirNodes.DeclarationHLIR &&
                ctxMapping.has(node[symbols.ASSIGNED_NAME])) {

                // Delete the node
                return node => new hlirNodes.AssignmentHLIR(
                    getReference(node[symbols.ASSIGNED_NAME]),
                    node.value,
                    node.start,
                    node.end
                );
            }
        });

        // Put initial parameter values into the context
        context.scope.params.forEach(param => {
            var assignedName = context.nameMap.get(param.name);
            if (!ctxMapping.has(assignedName)) return;

            var sym = new hlirNodes.SymbolHLIR(param.name, 0, 0);
            sym[symbols.REFCONTEXT] = context;
            sym[symbols.REFTYPE] = param.resolveType(context);
            sym[symbols.REFNAME] = assignedName;
            var assign = new hlirNodes.AssignmentHLIR(
                getReference(assignedName),
                sym,
                0,
                0
            );
            node.body.splice(1, 0, assign);
        });

        // Remove lexical lookups from the context objects and add the parameter
        node.iterate(node => {
            if (!(node instanceof hlirNodes.FunctionHLIR)) return;

            if (!node[ORIG_TYPE]) {
                node[ORIG_TYPE] = node.resolveType(node[symbols.CONTEXT]);
            }

            var ctx = node[symbols.CONTEXT];
            for (var mem of ctxMapping.keys()) {
                if (!ctx.lexicalLookups.has(mem)) return; // Ignore lexical lookups not in this scope
                if (ctx.lexicalLookups.get(mem) !== context) return; // Ignore lexical lookups from other scopes

                ctx.lexicalLookups.delete(mem);
            }

            var type = new hlirNodes.TypeHLIR(funcctx[CTX_TYPEMAPPING].typeName, [], 0, 0);
            type.forceType(funcctx[CTX_TYPEMAPPING]);

            var ident = new hlirNodes.TypedIdentifierHLIR(ctxName, type, 0, 0);
            ident[symbols.ASSIGNED_NAME] = ctxName;
            ident[symbols.CONTEXT] = ctx;
            ident[symbols.REFCONTEXT] = context;
            node.params.unshift(ident);

            ctx.addVar(ctxName, ctxType, ctxName);
        });

        // Remove all of the converted variables from the `typeMap` and
        // `nameMap` fields.
        for (var name of ctxMapping.keys()) {
            context.nameMap.delete(name);
            context.typeMap.delete(name);
        }

        // Finally, find all of the calls to the functions and add the appropriate
        // new parameter.
        node.iterate(node => {
            if (!(node instanceof hlirNodes.CallHLIR)) return;
            // Ignore calls to non-symbols
            if (!(node.callee instanceof hlirNodes.SymbolHLIR)) return;
            // Ignore calls to non-functions
            if (!node.callee[symbols.IS_FUNC]) return;

            node.params.unshift(getContextReference());
        });

    }

    // Replace first class function delcarations with variable declarations
    node.iterateBodies(body => {
        for (var i = 0; i < body.length; i++) {
            let iterNode = body[i];

            if (!(iterNode instanceof hlirNodes.FunctionHLIR)) return;
            if (!iterNode[symbols.IS_FIRSTCLASS]) return;

            let type = iterNode.resolveType(context);
            context.env.registerFunc(iterNode);

            let typeIR = new hlirNodes.TypeHLIR(type.typeName || type._type, [], 0, 0);
            typeIR.forceType(type);

            let ref = new hlirNodes.SymbolHLIR(iterNode.name, 0, 0);
            ref[symbols.REFCONTEXT] = iterNode[symbols.CONTEXT];
            ref[symbols.REFTYPE] = iterNode.resolveType(iterNode[symbols.CONTEXT]);
            ref[symbols.REFNAME] = iterNode[symbols.ASSIGNED_NAME];

            let decl = new hlirNodes.DeclarationHLIR(
                type,
                iterNode.name,
                hlirNodes.NewHLIR.asFuncRef(
                    hlirNodes.TypeHLIR.from(type),
                    [ref, getContextReference()],
                    0,
                    0
                ),
                0,
                0
            );
            decl[symbols.ASSIGNED_NAME] = iterNode[symbols.ASSIGNED_NAME];
            body.splice(i, 1, decl);
        }
    });

    var stack = [];
    node.iterate(node => {

        if (!stack[0] ||
            !(node instanceof hlirNodes.FunctionHLIR) ||
            !node[symbols.IS_FIRSTCLASS] ||
            stack[0][symbols.IS_FUNCREF]) {
            stack.unshift(node);
            return;
        }

        stack[0].substitute(x => {
            if (x !== node) return x;
            context.env.registerFunc(node);
            var funcType = node.resolveType();
            var ref = new hlirNodes.SymbolHLIR(node.name, 0, 0);
            ref[symbols.REFCONTEXT] = node[symbols.CONTEXT];
            ref[symbols.REFTYPE] = funcType;
            ref[symbols.REFNAME] = node[symbols.ASSIGNED_NAME] + '$$origFunc$';
            return hlirNodes.NewHLIR.asFuncRef(
                hlirNodes.TypeHLIR.from(funcType),
                [ref, getContextReference()]
            );
        });
    }, () => stack.shift());

}

function processCallNodes(node, context) {
    // Replace calls to function declarations with CallDecl nodes and calls to
    // references with CallRef.
    node.findAndReplace(node => {
        if (!(node instanceof hlirNodes.CallHLIR)) return;

        var isDeclaration = context.isFuncSet.has(node.callee[symbols.REFNAME]);
        if (!isDeclaration && node.callee instanceof hlirNodes.MemberHLIR) {
            var baseType = node.callee.base.resolveType(context);
            if (baseType._type === 'module' || baseType.flatTypeName() === 'foreign') {
                isDeclaration = true;
            }
        } else if (!isDeclaration && node.callee instanceof hlirNodes.SymbolHLIR) {
            isDeclaration = node.callee[symbols.REFCONTEXT].isFuncSet.has(node.callee[symbols.REFNAME]);
        }

        return node => new hlirNodes.CallHLIR(node.callee, node.params, node.start, node.end);

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
            let newSymbol = stack[0][marker] = new hlirNodes.SymbolHLIR(
                node.name,
                node.start,
                node.end
            );
            newSymbol[symbols.REFCONTEXT] = rootContext;
            newSymbol[symbols.REFTYPE] = node.resolveType(ctxparent);
            newSymbol[symbols.REFNAME] = node[symbols.ASSIGNED_NAME] + '$$origFunc$';
            newSymbol[symbols.REFIDX] = node[FUNCLIST_IDX];
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
        if (!(x instanceof hlirNodes.SymbolHLIR)) return;
        if (x[symbols.REFNAME] !== oldName) return;
        x[symbols.REFNAME] = newName;
    });

    // Replace the old function name in the old parent context.
    var stack = [];
    ctxparent.scope.iterate(
        x => {
            if (!(x instanceof hlirNodes.SymbolHLIR)) {
                stack.unshift(x);
                return;
            }
            if (!stack[0]) return;
            if (!(stack[0] instanceof hlirNodes.CallHLIR)) return;
            if (x[symbols.REFNAME] !== oldName) return;
            x[symbols.REFNAME] = newName;
            x[symbols.REFCONTEXT] = rootContext;
        },
        () => stack.shift()
    );

    // If the function is in a function table, update it there as well.
    if (node[symbols.FUNCLIST]) {
        let funcList = rootContext.env.funcList.get(node[symbols.FUNCLIST]);
        funcList[node[symbols.FUNCLIST_IDX]] = newName;
    }

    var temp = ctx;
    while (temp) {
        if (temp.functionDeclarations.has(oldName)) {
            temp.functionDeclarations.set(
                newName,
                temp.functionDeclarations.get(oldName)
            );
            temp.functionDeclarations.delete(oldName);
        }
        temp = temp.parent;
    }

}

export default function transform(rootCtx) {
    // First mark all first class functions as such.
    markFirstClassFunctions(rootCtx);

    // Traverse down into the context tree and process each context in turn.
    // This uses depth-first search.
    processContext(rootCtx, rootCtx);
    processRoot(rootCtx);

    // Perform all uplifting at the end.
    rootCtx[TRANSFORM_ENCOUNTERED_CTXS].forEach(ctx => upliftContext(rootCtx, ctx));
};
