var traverser = require('./traverser');
var types = require('./types');


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
    // A mapping of assigned names to function nodes.
    this.functionDeclarations = {};

    // A mapping of user-provided names to assigned names.
    this.nameMap = {};
    // A mapping of assigned names to types.
    this.typeMap = {};
    // A mapping of assigned names to booleans indicating whether the name is a function.
    this.isFuncMap = {};

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

    // A mapping of given names for types in this context to assigned names
    this.typeNameMap = parent ? parent.typeNameMap : {};  // Actual types are stored in the environment

    // A mapping of assigned names of referenced variables to the contexts
    // that contain the definition of those variables.
    this.lexicalLookups = {};
    // A set of assigned names that the context modifies in the lexical scope.
    this.lexicalModifications = {};
    // A mapping of user provided names of exported members to their assigned names.
    this.exports = {};
    // `null` or a reference to a Function node that is necessary to be run on
    // initialization.
    this.initializer = null;
}

Context.prototype.addVar = function(varName, type, assignedName) {
    if (varName in this.nameMap) {
        throw new Error('Cannot redeclare symbol in context: ' + varName);
    }

    var assignedName = this.nameMap[varName] = assignedName || this.env.namer();
    this.typeMap[assignedName] = type;
    return assignedName;
};

Context.prototype.lookupVar = function(varName) {
    if (varName in this.nameMap) {
        return this;
    } else if (this.parent) {
        return this.parent.lookupVar(varName);
    } else {
        throw new ReferenceError('Reference to undefined variable "' + varName + '"');
    }
};

Context.prototype.registerType = function(givenTypeName, type, assignedName) {
    assignedName = assignedName || this.env.namer();
    type.__assignedName = assignedName;
    this.typeNameMap[givenTypeName] = assignedName;
    this.typeMap[assignedName] = type;
    this.nameMap[assignedName] = givenTypeName;
    this.env.registerType(assignedName, type);
};

Context.prototype.resolveType = function(typeName) {
    if (typeName in this.typeNameMap) {
        return this.env.typeMap[this.typeNameMap[typeName]];
    }
    if (this.parent) {
        return this.parent.resolveType(typeName);
    } else {
        return types.resolve(typeName);
    }
};

module.exports = function generateContext(env, tree, filename, rootContext) {
    rootContext = rootContext || new Context(env, tree);
    if (filename) {
        rootContext.filename = filename;
    }
    var contexts = [rootContext];

    // This is used to keep track of nested functions so that they can be
    // processed after each context has been completely defined. This allows
    // nested functions to access variables and functions declared lexically
    // after themselves in the current scope.
    var innerFunctions = [];

    function before(node) {
        if (!node) return false;

        var assignedName;

        node.__context = contexts[0];
        switch (node.type) {
            case 'Import':
                var imp = env.import(node, rootContext);
                contexts[0].addVar(node.alias ? node.alias.name : node.base, imp);
                return;

            case 'Function':
                // Remember the function in the function hierarchy.
                contexts[0].functions.push(node);

                if (!node.name) {
                    node.name = env.namer();
                }

                // Mark the function as a variable containing a function type.
                assignedName = contexts[0].addVar(node.name, node.getType(contexts[0]));
                contexts[0].functionDeclarations[assignedName] = node;
                contexts[0].isFuncMap[assignedName] = true;
                node.__assignedName = assignedName;

                node.__firstClass = false;

                var newContext = new Context(env, node, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.params.forEach(function(param) {
                    param.__assignedName = newContext.addVar(param.name, param.getType(newContext));
                });

                innerFunctions[0].push(node);

                return false; // `false` to block the traverser from going deeper.

            case 'Declaration':
                node.__assignedName = contexts[0].addVar(node.identifier, (node.declType || node.value).getType(contexts[0]));
                return;

            case 'Symbol':
                node.__refContext = contexts[0].lookupVar(node.name);
                node.__refName = node.__refContext.nameMap[node.name];
                node.__refType = node.__refContext.typeMap[node.__refName];
                node.__isFunc = node.__refContext.isFuncMap[node.__refName];

                if (node.__refContext === rootContext && contexts.length > 1) {
                    // If the context referenced is the global scope, mark the
                    // context as accessing global scope.
                    contexts[0].accessesGlobalScope = true;

                } else if (node.__refContext !== contexts[0] && node.__refContext !== rootContext) {
                    // Otherwise the lookup is lexical and needs to be marked as such.

                    for (var i = 0; i < contexts.length && contexts[i] !== node.__refContext; i++) {
                        contexts[i].accessesLexicalScope = true;
                        contexts[i].lexicalLookups[node.__refName] = node.__refContext;

                    }

                }
                return;
        }
    }

    function after(node) {
        switch (node.type) {
            case 'Export':
                if (contexts.length > 1) {
                    throw new Error('Unexpected export: all exports must be in the global scope');
                }
                node.__assignedName = rootContext.exports[node.value.name] = node.value.__refName;
                return;
            case 'Assignment':
                if (node.base.type === 'Symbol' && node.base.__refContext.isFuncMap[node.base.__refName]) {
                    throw new Error('Cannot assign values to function declarations');
                }

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
                                    contexts[i].lexicalModifications[node.__refName] = true;
                                    contexts[i].sideEffectFree = false;
                                    i++;
                                }
                            }
                            return true;
                        // x.y = foo;
                        case 'Member':
                            return follow(node.base, called);
                        // x().y = foo;
                        case 'CallRaw':
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

module.exports.Context = Context;
