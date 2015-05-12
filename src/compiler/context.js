var nodes = require('./nodes');
var traverser = require('./traverser');
var types = require('./types');


/**
 * @constructor
 * @param {Environment} env
 * @param {*} scope
 * @param {Context|null} parent
 * @param {boolean} [privileged]
 */
function Context(env, scope, parent, privileged) {
    // Null by default, since most contexts don't represent a file.
    this.filename = null;

    // Notes whether the context has access to private types
    this.privileged = privileged || false;

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

    // A mapping of user-provided names to object declaration prototypes
    this.prototypes = {};
    // A mapping of serialized prototype names of constructed prototypes to the cloned object declaration
    this.constructedPrototypes = {};
    // A mapping of serialized prototype names of constructed prototypes to their respective types
    this.constructedPrototypeTypes = {};

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
    // A mapping of user provided names of exported types to their prototypes.
    this.exportPrototypes = {};
    // `null` or a reference to a Function node that is necessary to be run on
    // initialization.
    this.initializer = null;
}

/**
 * Adds a variable to the context
 * @param {string} varName
 * @param {*} type
 * @param {string} [assignedName]
 * @return {string} The assigned name of the var
 */
Context.prototype.addVar = function addVar(varName, type, assignedName) {
    if (varName in this.nameMap) {
        throw new Error('Cannot redeclare symbol in context: ' + varName);
    }

    assignedName = this.nameMap[varName] = assignedName || this.env.namer();
    this.typeMap[assignedName] = type;
    return assignedName;
};

/**
 * Retrieves the name of the variable with the given name varName
 * @param  {string} varName
 * @return {string} The assigned name of the variable
 */
Context.prototype.lookupVar = function lookupVar(varName) {
    if (varName in this.nameMap) {
        return this;
    } else if (this.parent) {
        return this.parent.lookupVar(varName);
    } else {
        throw new ReferenceError('Reference to undefined variable "' + varName + '"');
    }
};

/**
 * Looks up the function declaration node with the assigned name assignedName
 * @param  {string} assignedName
 * @return {*|null}
 */
Context.prototype.lookupFunctionByName = function lookupFunctionByName(assignedName) {
    if (assignedName in this.functionDeclarations) {
        return this.functionDeclarations[assignedName];
    } else if (this.parent) {
        return this.parent.lookupFunctionByName(assignedName);
    }
    return null;
};

/**
 * Registers an object declaration as a prototye
 * @param  {string} givenTypeName
 * @param  {*} type
 * @return {void}
 */
Context.prototype.registerPrototype = function registerPrototype(givenTypeName, type) {
    if (this.prototypes.hasOwnProperty(givenTypeName)) {
        throw new TypeError('Cannot declare object more than once: ' + givenTypeName);
    }
    this.prototypes[givenTypeName] = type;
};

Context.prototype.registerType = function registerType(givenTypeName, type, assignedName) {
    assignedName = assignedName || this.env.namer();
    type.__assignedName = assignedName;
    this.typeNameMap[givenTypeName] = assignedName;
    this.env.registerType(assignedName, type, this);
};

Context.prototype.serializePrototypeName = function serializePrototypeName(name, attributes) {
    return name + '<' + attributes.map(function(a) {
        // We don't need to recursively use serializePrototypeName because at
        // this point, the constructor would have already been built if the
        // type needs to go through the construction process.
        return a.flatTypeName();
    }).join(',') + '>';
};

Context.prototype.resolveType = function resolveType(typeName, attributes) {

    if (this.prototypes.hasOwnProperty(typeName)) {
        var resolved = this.resolvePrototype(typeName, attributes);
        return resolved;
    }

    if (typeName in this.typeNameMap) {
        return this.env.typeMap[this.typeNameMap[typeName]];
    }

    if (this.parent) {
        return this.parent.resolveType(typeName, attributes);
    }

    // There are no primitives that use attributes.
    return types.resolve(typeName, this.privileged);
};

Context.prototype.resolvePrototype = function resolvePrototype(typeName, attributes) {
    var serName = this.serializePrototypeName(typeName, attributes);
    // If we've already seen the constructed version of this prototype,
    // return it directly.
    if (serName in this.constructedPrototypes) {
        return this.constructedPrototypeTypes[serName];
    }

    // Create a new instance of the object declaration
    var clonedProto = this.prototypes[typeName].clone();
    clonedProto.__assignedName = this.env.namer();
    // Rewrite the declaration to use the provided attributes
    clonedProto.rewriteAttributes(attributes);
    // Record a copy of the constructed declaration
    this.constructedPrototypes[serName] = clonedProto;
    // Record the incomplete type, which will get fully populated below.
    this.constructedPrototypeTypes[serName] = clonedProto.getIncompleteType(this);

    clonedProto.__isConstructed = true;

    // Generate contexts for the declaration
    var fakeRoot = new nodes.Root({body: [clonedProto]});
    generateContext(this.env, fakeRoot, null, this, false);

    // Mark each methods as having come from the cloned prototype.
    // This is used for visibility testing.
    if (clonedProto.objConstructor) {
        clonedProto.objConstructor.base.__context.__basePrototype = clonedProto;
    }
    clonedProto.methods.forEach(function(mem) {
        mem.base.__context.__basePrototype = clonedProto;
    });

    // Finally, get the type of the newly constructed declaration and
    // register it for use.
    var typeToRegister = clonedProto.getType(this);
    typeToRegister.__assignedName = clonedProto.__assignedName;
    this.env.registerType(typeToRegister.__assignedName, typeToRegister, this);
    this.scope.body.push(clonedProto);

    return typeToRegister;
};

var generateContext = module.exports = function generateContext(env, tree, filename, rootContext, privileged) {
    if (!rootContext) {
        rootContext = new Context(env, tree, null, privileged);
        if (filename) {
            rootContext.filename = filename;
        }
    }
    var contexts = [rootContext];

    // This is used to keep track of nested functions so that they can be
    // processed after each context has been completely defined. This allows
    // nested functions to access variables and functions declared lexically
    // after themselves in the current scope.
    var innerFunctions = [];

    var operatorOverloads = [];

    function preTraverseContext(node) {
        if (!node) return false;
        var assignedName;
        var newContext;

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
                assignedName = contexts[0].addVar(node.name, node.getType(contexts[0]), node.__assignedName);
                contexts[0].functionDeclarations[assignedName] = node;
                contexts[0].isFuncMap[assignedName] = true;
                node.__assignedName = assignedName;

                node.__firstClass = false;

                newContext = new Context(env, node, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.params.forEach(function(param) {
                    param.__assignedName = newContext.addVar(param.name, param.getType(newContext));
                });

                innerFunctions[0].push(node);

                return false; // `false` to block the traverser from going deeper.

            case 'ObjectConstructor':
            case 'ObjectMethod':
                contexts[0].functions.push(node.base);
                assignedName = node.__assignedName || node.base.__assignedName || env.namer();
                contexts[0].functionDeclarations[assignedName] = node.base;
                contexts[0].isFuncMap[assignedName] = true;
                node.__assignedName = node.base.__assignedName = assignedName;
                node.base.__firstClass = false;

                newContext = new Context(env, node.base, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.base.params.forEach(function contextPreTraverseParamIter(param) {
                    param.__assignedName = newContext.addVar(param.name, param.getType(newContext));
                });

                innerFunctions[0].push(node.base);

                // Mark the types as being methods
                node.getType(contexts[0]).__isObjectMethod = true;

                return false;

            case 'OperatorStatement':
                if (operatorOverloads.indexOf(node) !== -1) {
                    return false;
                }
                operatorOverloads.push(node);
                return false;

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
                    // Ignore calls from a nested function to itself (recursion)
                    if (node.__isFunc && node.__refName === contexts[0].scope.__assignedName) return;

                    // Otherwise the lookup is lexical and needs to be marked as such.

                    for (var i = 0; i < contexts.length && contexts[i] !== node.__refContext; i++) {
                        contexts[i].accessesLexicalScope = true;
                        contexts[i].lexicalLookups[node.__refName] = node.__refContext;
                    }
                }

                return;

            case 'ObjectDeclaration':
                // Ignore nodes that have already been constructed.
                if (node.__isConstructed) return;
                // Register the prototype
                contexts[0].registerPrototype(node.name, node);
                // We don't want to create contexts for the contents of an
                // un-constructed object declaration.
                return false;

        }
    }

    function postTraverseContext(node) {
        switch (node.type) {
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
                return;

            case 'Declaration':
                node.__assignedName = contexts[0].addVar(node.identifier, (node.declType || node.value).getType(contexts[0]));
                return;

            case 'Export':
                var ctx;
                var refName;

                try {
                    ctx = contexts[0].lookupVar(node.value);
                    refName = ctx.nameMap[node.value];
                    node.__assignedName = rootContext.exports[node.value] = refName;
                } catch(e) {
                    var protoObj = contexts[0].prototypes[node.value];
                    if (!protoObj) {
                        throw new ReferenceError('Undefined function or type "' + node.value + '" being exported');
                    }
                    node.__assignedName = rootContext.exportPrototypes[node.value] = refName;
                }

                return;

            case 'ObjectDeclaration':
                if (!node.__isConstructed) return;

                var objType = node.getType(contexts[0]);
                if (node.objConstructor) {
                    objType.objConstructor = node.objConstructor.base.__assignedName;
                }
                node.methods.forEach(function(method) {
                    objType.methods[method.name] = method.base.__assignedName;
                });
                return;
        }
    }

    function doTraverse(tree) {
        innerFunctions.unshift([]);
        traverser.traverse(tree, preTraverseContext, postTraverseContext);
        innerFunctions.shift().forEach(function contextInnerFunctionIterator(node) {
            contexts.unshift(node.__context);
            doTraverse(node);
            contexts.shift();
        });
    }
    doTraverse(tree);

    operatorOverloads.forEach(registerOperatorOverload);

    function registerOperatorOverload(node) {
        var leftType = node.left.getType(rootContext).flatTypeName();
        if (!(leftType in rootContext.env.registeredOperators)) {
            rootContext.env.registeredOperators[leftType] = {};
        }
        var rightType = node.right.getType(rootContext).flatTypeName();
        if (!(rightType in rootContext.env.registeredOperators[leftType])) {
            rootContext.env.registeredOperators[leftType][rightType] = {};
        }

        if (rootContext.env.registeredOperators[leftType][rightType][node.operator]) {
            throw new Error('Cannot redeclare operator overload for ' +
                '`' + leftType + ' ' + node.operator + ' ' + rightType + '`');
        }

        node.__assignedName = rootContext.env.namer();

        rootContext.env.registeredOperators[leftType][rightType][node.operator] = node.__assignedName;
        rootContext.env.registeredOperatorReturns[node.__assignedName] = node.returnType.getType(rootContext);

        node.registerWithContext(node.__context, rootContext);

        contexts.unshift(node.__context);
        doTraverse(node);
        contexts.shift();

        // TODO: Find a way to do this implicitly. It's only done because
        // sometimes the node gets output twice.
        if (rootContext.scope.body.indexOf(node) === -1) {
            rootContext.scope.body.push(node);
        }
    }

    return rootContext;
};


module.exports.Context = Context;
