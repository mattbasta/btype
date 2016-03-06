import {setupContext} from './universalScope';
import Struct from './types/Struct';
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

        setupContext(this);
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
            throw new Error(`Cannot redeclare symbol in context: ${varName}`);
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
        return `${name}<${attributes.map(a => a.flatTypeName()).join(',')}>`;
    }

}


export class RootContext extends BaseContext {

    constructor(env, scope, privileged = false) {
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

    getRoot() {
        return this;
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
            throw new ReferenceError(`Reference to undefined variable "${varName}"`);
        }
    }

    /**
     * Returns whether a variable with the provided name exists
     * @param  {string} varName Name of the variable
     * @return {Boolean} Whether the variable exists
     */
    hasVar(varName) {
        return this.nameMap.has(varName);
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
            throw new TypeError(`Cannot declare object more than once: ${givenTypeName}`);
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

        var typeMap = new Map();
        var type = new Struct(typeName, typeMap, attributes);

        var astNode = this.prototypes.get(typeName);
        var hlirNode = astNode[symbols.FCONSTRUCT](this, attributes);

        var assignedName = hlirNode[symbols.ASSIGNED_NAME];
        type[symbols.ASSIGNED_NAME] = assignedName;

        // Register the incomplete type immediately.
        this.env.registerType(assignedName, type, this);
        // Record a copy of the constructed declaration
        this.constructedPrototypes.set(serName, hlirNode);
        // Record the incomplete type, which will get fully populated below.
        this.constructedPrototypeTypes.set(serName, type);

        hlirNode.members.forEach(m => {
            typeMap.set(m.name, m.resolveType(hlirNode[symbols.CONTEXT]));
            if (m.isPrivate) type.privateMembers.add(m.name);
            if (m.isFinal) type.finalMembers.add(m.name);
        });

        // Settle types of any non-member properties on the objects.
        hlirNode.settleTypes(this);

        // Now we bind the methods and constructors, since we've registered
        // everything. That means we won't get into a recursive loop trying to
        // cyclically resolve references to `self`.
        const constructionTasks = astNode.bindContents(hlirNode);

        if (hlirNode.objConstructor) {
            let constructorAN = hlirNode.objConstructor[symbols.ASSIGNED_NAME];
            this.functionDeclarations.set(constructorAN, hlirNode.objConstructor);
            this.isFuncSet.add(constructorAN);

            type.objConstructor = constructorAN;

            if (hlirNode.objConstructor[symbols.IS_FINAL]) {
                type.finalMembers.add('new');
            }
            hlirNode.objConstructor[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        }

        hlirNode.methods.forEach(m => {
            var assignedName = m[symbols.ASSIGNED_NAME];
            this.functionDeclarations.set(assignedName, m);
            this.isFuncSet.add(assignedName);

            type.methods.set(m.name, assignedName);
            if (m[symbols.IS_PRIVATE]) type.privateMembers.add(m.name);
            if (m[symbols.IS_FINAL]) type.finalMembers.add(m.name);

            m[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        });

        hlirNode.operatorStatements.forEach(m => {
            var assignedName = m[symbols.ASSIGNED_NAME];
            this.functionDeclarations.set(assignedName, m);
            this.isFuncSet.add(assignedName);
            m[symbols.CONTEXT][symbols.BASE_PROTOTYPE] = hlirNode;
        });

        this.scope.body.push(hlirNode);

        constructionTasks.forEach(task => task());

        return type;
    }
};


export class Context extends BaseContext {

    constructor(env, scope, parent, privileged = false) {
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

    getRoot() {
        return this.parent.getRoot();
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
     * Returns whether a variable with the provided name exists
     * @param  {string} varName Name of the variable
     * @return {Boolean} Whether the variable exists
     */
    hasVar(varName) {
        return this.nameMap.has(varName) || this.parent.hasVar(varName);
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
        if (this.typeDefs.has(typeName)) {
            if (attributes.length) {
                var err = new TypeError('Cannot apply attributes to aliased types');
                // err[symbols.ERR_MSG] = err.message;
                throw err;
            }
            return this.typeDefs.get(typeName);
        }
        return this.parent.resolveType(typeName, attributes);
    }

    resolvePrototype(...args) {
        return this.parent.resolvePrototype(...args);
    }

};
