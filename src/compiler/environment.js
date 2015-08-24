var fs = require('fs');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2));

var constantFold = require('./optimizer/constantFold');
import RootContext from './context';
var flattener = require('./flattener');
var globalInit = require('./globalInit');
import lexer from '../lexer';
import NamerFactory from './namer';
var specialModules = require('./specialModules/__directory');
import * as symbols from '../symbols';
var transformer = require('./transformer');
import Module from './types/Module';


const LOWEST_ORDER = argv.minblocksize || 16;
const HEAP_SIZE = argv.heapsize || 64 * 1024 * 1024;

// Declare a set of project environment variables.
const ENV_VARS = {
    HEAP_SIZE: HEAP_SIZE,
    BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
    LOWEST_ORDER: LOWEST_ORDER,
};


export default class Environment {
    constructor(name, config) {
        this.name = name ? name.trim() : '';
        this.config = new Map(config);

        this.namer = NamerFactory();
        this.foreigns = [];
        this.included = [];
        this.requested = null;
        this.modules = new Map();
        this.inits = []; // Ordered list of things to initialize

        // Mapping of assigned type names to types
        this.typeMap = new Map();
        // Mapping of assigned type names to host contexts
        this.typeContextMap = new Map();
        // Set of types
        this.types = new Set();
        // Mapping of stringified constructed types to constructed types
        this.constructedTypeMap = new Map();

        // Mapping of module identifiers to the associated module types.
        this.moduleTypeMap = new Map();

        this.moduleCache = new Map();

        this.funcList = new Map();  // Mapping of func list assigned names to arrays of func assigned names
        this.funcListTypeMap = new Map();  // Mapping of serialized func types to names of func lists
        this.funcListReverseTypeMap = new Map();  // Mapping of func list assigned names to func types

        // Map of left type names to map of right type names to map of operators to
        // operator statement assigned names
        this.registeredOperators = new Map();
        // Map of operator statement assigned names to their return types
        this.registeredOperatorReturns = new Map();

        // Mapping of string literal text to a global name for the string
        this.registeredStringLiterals = new Map();
    }

    setConfig(name, value) {
        this.config.set(name, value);
    }

    getConfig(name) {
        this.config.get(name);
    }


    loadFile(filename, tree, privileged) {
        if (this.moduleCache.has(filename)) {
            return this.moduleCache.get(filename);
        }

        if (!tree) {
            var parser = require('../parser');
            tree = parser(lexer(fs.readFileSync(filename).toString()));
        }

        var ctx = tree[symbols.FMAKEHLIR](this, privileged);

        // Perform inline type checking.
        tree.validateTypes(ctx);

        // Convert the tree into its functional form
        tree = tree.translate(ctx);

        // Flatten lexical scope
        transformer(ctx);
        // Flatten complex expressions
        flattener(ctx);

        // Move global statements to init functions.
        globalInit(ctx, this);

        // Perform constant folding.
        constantFold(ctx);

        this.addContext(ctx);
        this.moduleCache.set(filename, ctx);
        return ctx;
    }

    doImport(importNode, requestingContext) {
        var target;

        // TODO: Make this handle multiple levels of nesting.
        var baseDir = path.dirname(requestingContext.filename);
        target = path.resolve(baseDir, importNode.base);
        if (importNode.member) {
            target = path.resolve(target, importNode.member);
        }
        target += '.bt';

        var isStdlib = false;

        // Test to see whether the file exists in the project
        if (!fs.existsSync(target)) {
            // If not, try for the stdlib.
            target = path.resolve(__dirname, 'static', 'stdlib', importNode.base);
            if (importNode.member) {
                target = path.resolve(target, importNode.member);
            }
            target += '.bt';

            isStdlib = true;
        }

        // Test to see whether the file exists in the stdlib
        if (!fs.existsSync(target)) {
            // Handle the case of special modules
            if (!importNode.member && specialModules.isSpecialModule(importNode.base)) {
                var mod = specialModules.getConstructor(importNode.base).get(this);
                return this.moduleTypeMap.set(target, new Module(mod));
            }
            throw new Error('Could not find imported module: ' + target);
        }

        if (this.moduleTypeMap.has(target)) {
            return this.moduleTypeMap.get(target);
        }

        var importedContext = this.loadFile(target, null, isStdlib);
        var mod = new Module(importedContext);
        this.moduleTypeMap.set(target, mod);
        return mod;
    }

    addModule(module, context) {
        this.modules.set(module, context);
    }

    addContext(context) {
        this.included.add(context);
    }

    registerType(assignedName, type, context) {
        type[symbols.ASSIGNED_NAME] = assignedName || this.namer();
        this.typeMap.set(assignedName, type);
        this.typeContextMap.set(assignedName, context);
        this.types.add(type);
    }

    markRequested(context) {
        this.requested = context;
    }

    getFuncListName(funcType, noAdd) {
        var fts = funcType.toString();
        if (!this.funcListTypeMap.has(fts) && !noAdd) {
            var name = this.namer();
            this.funcListTypeMap.set(fts, name);
            this.funcListReverseTypeMap.set(name, funcType);
            this.funcList.set(name, []);
        }
        return this.funcListTypeMap.get(fts);
    }

    registerFunc(funcNode) {
        // If the function was already registered, return the cached index.
        if (symbols.FUNCLIST_IDX in funcNode) return funcNode[symbols.FUNCLIST_IDX];

        // Get the function's type and use that to determine the table.
        var ft = funcNode.getType(funcNode[symbols.CONTEXT]);
        var funcList = this.getFuncListName(ft);
        // If the table doesn't exist yet, create it.
        if (!this.funcList.has(funcList)) this.funcList.set(funcList, []);
        // Add the function's assigned name to the table.
        this.funcList.get(funcList).push(funcNode[symbols.ASSIGNED_NAME]);

        // Cache and return the function's index in the table.
        funcNode[symbols.FUNCLIST] = funcList;
        return funcNode[symbols.FUNCLIST_IDX] = this.funcList.get(funcList).length - 1;
    }

    addInit(stmt) {
        this.inits.push(stmt);
    }

    make(outputLanguage) {
        if (!this.requested) {
            throw new Error('No context was requested for export.');
        }

        return require('./generators/' + outputLanguage + '/generate')(this, ENV_VARS);
    }

    findFunctionByAssignedName(assignedName) {
        var temp;
        for (var i of this.included) {
            if (temp = i.lookupFunctionByName(assignedName)) {
                return temp;
            }
        }
        return null;
    }

    getStrLiteralIdentifier(text) {
        if (this.registeredStringLiterals.has(text)) {
            return this.registeredStringLiterals.get(text);
        }
        var name = this.namer();
        this.registeredStringLiterals.set(text, name);
        return name;
    }
}
