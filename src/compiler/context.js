import * as symbols from '../symbols';
import * as types from './types';


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
        // A set of assigned names indicating whether the name is a function.
        this.isFuncSet = new Set();

        // Map of type aliases to their types
        this.typeDefs = new Map();

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
     * Registers an object declaration as a prototype
     * @param  {string} givenTypeName
     * @param  {*} type The AST node of the object
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

        var astNode = this.prototypes.get(typeName);
        var hlirNode = astNode[symbols.FCONSTRUCT]();

        var type = hlirNode.resolveType(this);

        // Record a copy of the constructed declaration
        this.constructedPrototypes.set(serName, hlirNode);
        // Record the incomplete type, which will get fully populated below.
        this.constructedPrototypeTypes.set(serName, type);

        // Mark each methods as having come from the cloned prototype.
        // This is used for visibility testing.
        if (clonedProto.objConstructor) {
            clonedProto.objConstructor.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        }
        clonedProto.methods.forEach(m => {
            m.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        });

        // Finally, get the type of the newly constructed declaration and
        // register it for use.
        type[symbols.ASSIGNED_NAME] = hlirNode[symbols.ASSIGNED_NAME];
        this.env.registerType(type[symbols.ASSIGNED_NAME], type, this);
        this.scope.body.push(hlirNode);

        return type;
    }
};


export class Context extends BaseContext {

    constructor(env, scope, parent, privileged) {
        super(env, scope, privileged);

        // A reference to the parent context of this context.
        this.parent = parent;

        // A mapping of assigned names of referenced variables to the contexts
        // that contain the definition of those variables.
        this.lexicalLookups = new Map();
        // A set of assigned names that the context modifies in the lexical scope.
        this.lexicalModifications = new Set();

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

    resolveType(typeName, attributes) {
        if (this.typeDefs.has(typeName) && !attributes.length) {
            return this.typeDefs.get(typeName);
        }
        this.parent.resolveType(typeName, attributes);
    }

    resolvePrototype(...args) {
        this.parent.resolvePrototype(...args);
    }

};


function generateContext(env, tree, filename, rootContext, privileged) {
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
            case 'OperatorStatement':
                if (operatorOverloads.indexOf(node) !== -1) {
                    return false;
                }
                operatorOverloads.push(node);
                return false;

        }
    }

    function postTraverseContext(node) {
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
