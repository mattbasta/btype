var nodes = require('./nodes');
var traverser = require('./traverser');
var types = require('./types');

import * as symbols from '../symbols';


class BaseContext {
    /**
     * @param {Environment} env
     * @param {*} scope
     * @param {boolean} [privileged]
     */
    constructor(env, scope, privileged) {
        // Create a reference from the corresponding node back to this context.
        scope[symbols.CONTEXT] = this;

        // A reference to the containing environment.
        this.env = env;
        // a reference to an AST node that this context corresponds to.
        this.scope = scope;
        // Notes whether the context has access to private types
        this.privileged = privileged || false;

        // A collection of functions directly within this context.
        this.functions = new Set();
        // A mapping of assigned names to function nodes.
        this.functionDeclarations = new Map();

        // A mapping of user-provided names to assigned names.
        this.nameMap = new Map();
        // A mapping of assigned names to types.
        this.typeMap = new Map();
        // A mapping of assigned names to booleans indicating whether the name is a function.
        this.isFuncMap = new Map();

    }

    /**
     * Adds a variable to the context
     * @param {string} varName
     * @param {*} type
     * @param {string} [assignedName]
     * @return {string} The assigned name of the var
     */
    addVar(varName, type, assignedName) {
        if (this.nameMap.has(varName)) {
            throw new Error('Cannot redeclare symbol in context: ' + varName);
        }

        assignedName = assignedName || this.env.namer();
        this.nameMap.set(varName, assignedName);
        this.typeMap.set(assignedName, type);
        return assignedName;
    }

    serializePrototypeName(name, attributes) {
        // We don't need to recursively use serializePrototypeName because at
        // this point, the constructor would have already been built if the
        // type needs to go through the construction process.
        return name + '<' + attributes.map(a => a.flatTypeName()).join(',') + '>';
    }

}

export class RootContext extends BaseContext {

    constructor(env, scope, privileged) {
        super(env, scope, privileged);

        // Null by default, since most contexts don't represent a file.
        this.filename = null;

        // A mapping of user-provided names to object declaration prototypes
        this.prototypes = new Map();
        // A mapping of serialized prototype names of constructed prototypes to the cloned object declaration
        this.constructedPrototypes = new Map();
        // A mapping of serialized prototype names of constructed prototypes to their respective types
        this.constructedPrototypeTypes = new Map();

        // A mapping of given names for types in this context to assigned names
        this.typeNameMap = new Map();  // Actual types are stored in the environment

        // A mapping of user provided names of exported members to their assigned names.
        this.exports = new Map();
        // A mapping of user provided names of exported types to their prototypes.
        this.exportPrototypes = new Map();

        // `null` or a reference to a Function node that is necessary to be run on
        // initialization.
        this.initializer = null;
    }

    /**
     * Retrieves the name of the variable with the given name varName
     * @param  {string} varName
     * @return {string} The assigned name of the variable
     */
    lookupVar(varName) {
        if (this.nameMap.has(varName)) {
            return this;
        } else {
            throw new ReferenceError('Reference to undefined variable "' + varName + '"');
        }
    }

    /**
     * Looks up the function declaration node with the assigned name assignedName
     * @param  {string} assignedName
     * @return {*|null}
     */
    lookupFunctionByName(assignedName) {
        if (this.functionDeclarations.has(assignedName)) {
            return this.functionDeclarations.get(assignedName);
        } else {
            return null;
        }
    }

    /**
     * Registers an object declaration as a prototye
     * @param  {string} givenTypeName
     * @param  {*} type
     * @return {void}
     */
    registerPrototype(givenTypeName, type) {
        if (this.prototypes.has(givenTypeName)) {
            throw new TypeError('Cannot declare object more than once: ' + givenTypeName);
        }
        this.prototypes.set(givenTypeName, type);
    }

    registerType(givenTypeName, type, assignedName) {
        assignedName = assignedName || this.env.namer();
        type[symbols.ASSIGNED_NAME] = assignedName;
        this.typeNameMap.set(givenTypeName, assignedName);
        this.env.registerType(assignedName, type, this);
    }

    resolveType(typeName, attributes) {
        if (this.prototypes.has(typeName)) {
            return this.resolvePrototype(typeName, attributes);
        }

        if (this.typeNameMap.has(typeName)) {
            return this.env.typeMap[this.typeNameMap[typeName]];
        }

        // There are no primitives that use attributes.
        return types.resolve(typeName, this.privileged);
    }

    resolvePrototype(typeName, attributes) {
        var serName = this.serializePrototypeName(typeName, attributes);
        // If we've already seen the constructed version of this prototype,
        // return it directly.
        if (this.constructedPrototypes.has(serName)) {
            return this.constructedPrototypeTypes.get(serName);
        }

        // Create a new instance of the object declaration
        var clonedProto = this.prototypes.get(typeName).clone();
        clonedProto[symbols.ASSIGNED_NAME] = this.env.namer();
        // Rewrite the declaration to use the provided attributes
        clonedProto.rewriteAttributes(attributes);
        // Record a copy of the constructed declaration
        this.constructedPrototypes.set(serName, clonedProto);
        // Record the incomplete type, which will get fully populated below.
        this.constructedPrototypeTypes.set(serName, clonedProto.getIncompleteType(this));

        clonedProto[symbols.IS_CONSTRUCTED] = true;

        // Generate contexts for the declaration
        var fakeRoot = new nodes.Root({body: [clonedProto]});
        generateContext(this.env, fakeRoot, null, this, false);

        // Mark each methods as having come from the cloned prototype.
        // This is used for visibility testing.
        if (clonedProto.objConstructor) {
            clonedProto.objConstructor.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = clonedProto;
        }
        clonedProto.methods.forEach(m => {
            m.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = clonedProto;
        });

        // Finally, get the type of the newly constructed declaration and
        // register it for use.
        var typeToRegister = clonedProto.getType(this);
        typeToRegister[symbols.ASSIGNED_NAME] = clonedProto[symbols.ASSIGNED_NAME];
        this.env.registerType(typeToRegister[symbols.ASSIGNED_NAME], typeToRegister, this);
        this.scope.body.push(clonedProto.translate(this, true));

        return typeToRegister;
    }
};

export class Context extends BaseContext {

    constructor(env, scope, parent, privileged) {
        super(env, scope, privileged);

        // A reference to the parent context of this context.
        this.parent = parent;

        // A mapping of assigned names of referenced variables to the contexts
        // that contain the definition of those variables.
        this.lexicalLookups = {};
        // A set of assigned names that the context modifies in the lexical scope.
        this.lexicalModifications = {};

        // Boolean representing whether the context accesses the global scope.
        this.accessesGlobalScope = false;
        // Boolean representing whether the context access its lexical scope.
        this.accessesLexicalScope = false;

        // Boolean representing whether the context is side effect-free.
        this.sideEffectFree = true;

        this.typeNameMap = parent.typeNameMap;
    }

    /**
     * Retrieves the name of the variable with the given name varName
     * @param  {string} varName
     * @return {string} The assigned name of the variable
     */
    lookupVar(varName) {
        if (this.nameMap.has(varName)) {
            return this;
        } else {
            return this.parent.lookupVar(varName);
        }
    }

    /**
     * Looks up the function declaration node with the assigned name assignedName
     * @param  {string} assignedName
     * @return {*|null}
     */
    lookupFunctionByName(assignedName) {
        if (this.functionDeclarations.has(assignedName)) {
            return this.functionDeclarations.get(assignedName);
        } else {
            return this.parent.lookupFunctionByName(assignedName);
        }
    }

    registerPrototype(...args) {
        this.parent.registerPrototype(...args);
    }

    registerType(...args) {
        this.parent.registerType(...args);
    }

    resolveType(...args) {
        this.parent.resolveType(...args);
    }

    resolvePrototype(...args) {
        this.parent.resolvePrototype(...args);
    }

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

        node[symbols.CONTEXT] = contexts[0];
        switch (node.type) {
            case 'Import':
                var imp = env.doImport(node, rootContext);
                var impName = node.base;
                if (node.member) {
                    impName = node.member;
                }
                if (node.alias) {
                    impName = node.alias.name;
                }
                contexts[0].addVar(impName, imp);
                return;

            case 'Function':
                // Remember the function in the function hierarchy.
                contexts[0].functions.push(node);

                if (!node.name) {
                    node.name = env.namer();
                }

                // Mark the function as a variable containing a function type.
                assignedName = contexts[0].addVar(node.name, node.getType(contexts[0]), node[symbols.ASSIGNED_NAME]);
                contexts[0].functionDeclarations[assignedName] = node;
                contexts[0].isFuncMap[assignedName] = true;
                node[symbols.ASSIGNED_NAME] = assignedName;

                node.__firstClass = false;

                newContext = new Context(env, node, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.params.forEach(function(param) {
                    param[symbols.ASSIGNED_NAME] = newContext.addVar(param.name, param.getType(newContext));
                });

                innerFunctions[0].push(node);

                return false; // `false` to block the traverser from going deeper.

            case 'ObjectConstructor':
            case 'ObjectMethod':
                contexts[0].functions.push(node.base);
                assignedName = node[symbols.ASSIGNED_NAME] || node.base[symbols.ASSIGNED_NAME] || env.namer();
                contexts[0].functionDeclarations[assignedName] = node.base;
                contexts[0].isFuncMap[assignedName] = true;
                node[symbols.ASSIGNED_NAME] = node.base[symbols.ASSIGNED_NAME] = assignedName;
                node.base.__firstClass = false;

                newContext = new Context(env, node.base, contexts[0]);
                // Add all the parameters of the nested function to the new scope.
                node.base.params.forEach(function contextPreTraverseParamIter(param) {
                    param[symbols.ASSIGNED_NAME] = newContext.addVar(param.name, param.getType(newContext));
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
                    if (node.__isFunc && node.__refName === contexts[0].scope[symbols.ASSIGNED_NAME]) return;

                    // Otherwise the lookup is lexical and needs to be marked as such.

                    for (var i = 0; i < contexts.length && contexts[i] !== node.__refContext; i++) {
                        contexts[i].accessesLexicalScope = true;
                        contexts[i].lexicalLookups[node.__refName] = node.__refContext;
                    }
                }

                return;

            case 'ObjectDeclaration':
                // Ignore nodes that have already been constructed.
                if (node[symbols.IS_CONSTRUCTED]) return;
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

            case 'ConstDeclaration':
            case 'Declaration':
                node[symbols.ASSIGNED_NAME] = contexts[0].addVar(node.identifier, (node.declType || node.value).getType(contexts[0]));
                return;

            case 'Export':
                var ctx;
                var refName;

                try {
                    ctx = contexts[0].lookupVar(node.value);
                    refName = ctx.nameMap[node.value];
                    node[symbols.ASSIGNED_NAME] = rootContext.exports[node.value] = refName;
                } catch(e) {
                    var protoObj = contexts[0].prototypes[node.value];
                    if (!protoObj) {
                        throw new ReferenceError('Undefined function or type "' + node.value + '" being exported');
                    }
                    node[symbols.ASSIGNED_NAME] = rootContext.exportPrototypes[node.value] = refName;
                }

                return;

            case 'ObjectDeclaration':
                if (!node[symbols.IS_CONSTRUCTED]) return;

                var objType = node.getType(contexts[0]);
                if (node.objConstructor) {
                    objType.objConstructor = node.objConstructor.base[symbols.ASSIGNED_NAME];
                }
                node.methods.forEach(function(method) {
                    objType.methods[method.name] = method.base[symbols.ASSIGNED_NAME];
                });
                return;
        }
    }

    function doTraverse(tree) {
        innerFunctions.unshift([]);
        traverser.traverse(tree, preTraverseContext, postTraverseContext);
        innerFunctions.shift().forEach(function contextInnerFunctionIterator(node) {
            contexts.unshift(node[symbols.CONTEXT]);
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

        node[symbols.ASSIGNED_NAME] = rootContext.env.namer();

        rootContext.env.registeredOperators[leftType][rightType][node.operator] = node[symbols.ASSIGNED_NAME];
        rootContext.env.registeredOperatorReturns[node[symbols.ASSIGNED_NAME]] = node.returnType.getType(rootContext);

        node.registerWithContext(node[symbols.CONTEXT], rootContext);

        contexts.unshift(node[symbols.CONTEXT]);
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
