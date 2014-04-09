var traverser = require('./traverser');


function Context(env, scope, parent) {
    // Null by default, since most contexts don't represent a file.
    this.filename = null;

    // A reference to the containing environment.
    this.env = env;
    // a reference to an AST node that this context corresponds to.
    this.scope = scope;
    // Create a reference from the corresponding node back to this context.
    scope.__context = this;
    // `null` or a reference to the parent context of this context.
    this.parent = parent || null;
    // A collection of functions directly within this context.
    this.functions = [];
    this.functionDeclarations = {};
    // A mapping of assigned names to types.
    this.vars = {};
    // A mapping of assigned names to generated names.
    this.nameMap = {};
    // Boolean representing whether the context accesses the global scope.
    this.accessesGlobalScope = false;
    // Boolean representing whether the context access its lexical scope.
    this.accessesLexicalScope = false;

    /*
    Side effect-free
        The function has no side effects at all.
    Lexical side effect-free
        The function does not modify the values of any variables in the lexical
        scope. It may modify members of objects referenced by pointers in the
        lexical scope or variables in the global scope.
    */

    // Boolean representing whether the context is side effect-free.
    this.sideEffectFree = true;
    // Boolean representing whether the context is lexically side effect-free.
    this.lexicalSideEffectFree = true;

    // A mapping of names of referenced variables to the contexts that contain
    // the definition of those variables.
    this.lexicalLookups = {};
    // A mapping of exported names to their types.
    this.exports = {};
    // A mapping of exported names to their generated namees.
    this.exportMap = {};
    // `null` or a reference to a Function node that is necessary to be run on
    // initialization.
    this.initializer = null;
}

Context.prototype.addVar = function(varName, type) {
    if (varName in this.vars) {
        throw new Error('Cannot redeclare symbol in context: ' + varName);
    }
    this.vars[varName] = type;
};

Context.prototype.hasVar = function(varName) {
    return this.vars[varName];
};

Context.prototype.lookupVar = function(varName) {
    if (varName in this.vars) {
        // console.log('Found ' + varName + ' in this scope');
        return this;
    } else if (this.parent) {
        // console.log('Looking for ' + varName + ' in parent scope');
        return this.parent.lookupVar(varName);
    } else {
        throw new ReferenceError('Reference to undefined variable "' + varName + '"');
    }
};

module.exports = function generateContext(env, tree, filename) {
    var rootContext = new Context(env, tree);
    var contexts = [rootContext];

    // This is used to keep track of nested functions so that they can be
    // processed after each context has been completely defined. This allows
    // nested functions to access variables and functions declared lexically
    // after themselves in the current scope.
    var innerFunctions = [];

    function before(node) {
        if (!node) return false;

        node.__context = contexts[0];
        switch (node.type) {
            case 'Import':
                var imp = env.import(node, rootContext);
                contexts[0].addVar(node.alias ? node.alias.name : node.base, imp.getType(contexts[0]));
                return;
            case 'Function':
                // Remember the function in the function hierarchy.
                contexts[0].functions.push(node);
                contexts[0].functionDeclarations[node.name] = node;
                // Mark the function as a variable containing a function type.
                contexts[0].addVar(node.name, node.getType(contexts[0]));
                // Mark the generated name for the function.
                contexts[0].nameMap[node.name] = node.__assignedName = env.namer();

                if (!('__firstClass' in node)) {
                    node.__firstClass = false;
                }

                var newContext = new Context(env, node, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.params.forEach(function(param) {
                    newContext.addVar(param.name, param.getType(newContext));
                    newContext.nameMap[param.name] = env.namer();
                });

                innerFunctions[0].push(node);

                return false;
            case 'Declaration':
                contexts[0].addVar(node.identifier, node.declType || node.value.getType(contexts[0]));
                contexts[0].nameMap[node.identifier] = env.namer();
                return;
            case 'Symbol':
                node.__refContext = contexts[0].lookupVar(node.name);
                node.__refName = node.__refContext.nameMap[node.name];
                node.__refType = node.__refContext.vars[node.name];
                if (node.__refContext === rootContext && contexts.length > 1) {
                    contexts[0].accessesGlobalScope = true;
                } else if (node.__refContext !== contexts[0] && node.__refContext !== rootContext) {
                    for (var i = 0; i < contexts.length && contexts[i] !== node.__refContext; i++) {
                        contexts[i].accessesLexicalScope = true;
                        contexts[i].lexicalLookups[node.name] = node.__refContext;
                    }
                }
                return;
            case 'Export':
                if (contexts.length > 1) {
                    throw new Error('Unexpected export: all exports must be in the global scope');
                }
                rootContext.exports[node.value.name] = node.value.getType(rootContext);
                node.__assignedName = rootContext.exportMap[node.value.name] = rootContext.nameMap[node.value.name];
                return;
        }
    }

    function after(node) {
        switch (node.type) {
            case 'Assignment':
                // TODO: Check that function declarations are not overwritten.
                function follow(node, called) {
                    switch (node.type) {
                        // x = foo;
                        case 'Symbol':
                            // Assignments to symbols outside the current scope
                            // makes the function NOT side effect-free.
                            if (!called &&
                                node.__refContext !== rootContext &&
                                node.__refContext !== contexts[0]) {

                                var i = 0;
                                while (contexts[i] && contexts[i] !== node.__refContext) {
                                    contexts[i].lexicalSideEffectFree = false;
                                    contexts[i].sideEffectFree = false;
                                    i++;
                                }
                            }
                            return true;
                        // x.y = foo;
                        case 'Member':
                            return follow(node.base, called);
                        // x().y = foo;
                        case 'Call':
                            return follow(node.callee, true);
                    }
                    return false;
                }

                // Determine whether the current context is side effect-free.
                var hasSideEffects = follow(node.base);

                if (hasSideEffects) {
                    contexts[0].sideEffectFree = false;
                }
                break;
        }
    }

    function doTraverse(tree) {
        innerFunctions.unshift([]);
        traverser.traverse(tree, before, after);
        innerFunctions.shift().forEach(function(node) {
            contexts.unshift(node.__context);
            doTraverse(node);
            contexts.shift();
        });
    }
    doTraverse(tree);

    return rootContext;
};
