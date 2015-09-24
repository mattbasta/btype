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
        var hlirNode = astNode[symbols.FCONSTRUCT](this, attributes);

        var type = hlirNode.resolveType(this);

        // Record a copy of the constructed declaration
        this.constructedPrototypes.set(serName, hlirNode);
        // Record the incomplete type, which will get fully populated below.
        this.constructedPrototypeTypes.set(serName, type);

        // Mark each methods as having come from the cloned prototype.
        // This is used for visibility testing.
        if (hlirNode.objConstructor) {
            hlirNode.objConstructor.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        }
        hlirNode.methods.forEach(m => {
            m.base[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        });

        // Finally, get the type of the newly constructed declaration and
        // register it for use.
        type[symbols.ASSIGNED_NAME] = hlirNode[symbols.ASSIGNED_NAME];
        this.env.registerType(type[symbols.ASSIGNED_NAME], type, this);
        this.scope.body.push(hlirNode);

        astNode.bindContents(hlirNode);

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
