var fs = require('fs');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2));

var constantFold = require('./optimizer/constantFold');
import RootContext from './context';
var flattener = require('./flattener');
var globalInit = require('./globalInit');
import lexer from '../lexer';
var namer = require('./namer');
var specialModules = require('./specialModules/__directory');
var transformer = require('./transformer');
var types = require('./types');


const LOWEST_ORDER = argv.minblocksize || 16;
const HEAP_SIZE = argv.heapsize || 64 * 1024 * 1024;

// Declare a set of project environment variables.
const ENV_VARS = {
    HEAP_SIZE: HEAP_SIZE,
    BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
    LOWEST_ORDER: LOWEST_ORDER,
};


export default class Environment {
    construct(name, config) {
        this.name = name ? name.trim() : '';
        this.config = new Map(config);

        this.namer = namer();
        this.foreigns = [];
        this.included = [];
        this.requested = null;
        this.modules = {};
        this.inits = [];

        // Mapping of assigned type names to types
        this.typeMap = {};
        // Mapping of assigned type names to host contexts
        this.typeContextMap = {};
        // Set of types
        this.types = [];
        // Mapping of stringified constructed types to constructed types
        this.constructedTypeMap = {};

        // Mapping of module identifiers to the associated module types.
        this.moduleTypeMap = {};

        this.moduleCache = {};

        this.funcList = {};  // Mapping of func list assigned names to arrays of func assigned names
        this.funcListTypeMap = {};  // Mapping of serialized func types to names of func lists
        this.funcListReverseTypeMap = {};  // Mapping of func list assigned names to func types

        // Map of left type names to map of right type names to map of operators to
        // operator statement assigned names
        this.registeredOperators = {}
        // Map of operator statement assigned names to their return types
        this.registeredOperatorReturns = {}

        // Mapping of string literal text to a global name for the string
        this.registeredStringLiterals = {};
    }

    setConfig(name, value) {
        this.config.set(name, value);
    }

    getConfig(name) {
        this.config.get(name);
    }


    loadFile(filename, tree, privileged) {
        if (filename in this.moduleCache) return this.moduleCache[filename];

        if (!tree) {
            var parser = require('../parser');
            tree = parser(lexer(fs.readFileSync(filename).toString()));
        }

        var ctx = new RootContext(this, tree, privileged);

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
        this.moduleCache[filename] = ctx;
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
                return this.moduleTypeMap[target] = new types.Module(mod);
            }
            throw new Error('Could not find imported module: ' + target);
        }

        if (target in this.moduleTypeMap) {
            return this.moduleTypeMap[target];
        }

        var importedContext = this.loadFile(target, null, isStdlib);
        return this.moduleTypeMap[target] = new types.Module(importedContext);
    }

    addModule(module, context) {
        this.modules[module] = context;
    }

    addContext(context) {
        this.included.push(context);
    }

    registerType(assignedName, type, context) {
        type.__assignedName = assignedName || this.namer();
        this.typeMap[assignedName] = type;
        this.typeContextMap[assignedName] = context;
        this.types.push(type);
    }

    markRequested(context) {
        this.requested = context;
    }

    getFuncListName(funcType, noAdd) {
        var fts = funcType.toString();
        if (!(fts in this.funcListTypeMap) && !noAdd) {
            var name = this.funcListTypeMap[fts] = this.namer();
            this.funcListReverseTypeMap[name] = funcType;
            this.funcList[name] = [];
        }
        return this.funcListTypeMap[fts];
    }

    registerFunc(funcNode) {
        // If the function was already registered, return the cached index.
        if ('__funclistIndex' in funcNode) return funcNode.__funclistIndex;

        // Get the function's type and use that to determine the table.
        var ft = funcNode.getType(funcNode.__context);
        var funcList = this.getFuncListName(ft);
        // If the table doesn't exist yet, create it.
        if (!(funcList in this.funcList)) this.funcList[funcList] = [];
        // Add the function's assigned name to the table.
        this.funcList[funcList].push(funcNode.__assignedName);

        // Cache and return the function's index in the table.
        funcNode.__funcList = funcList;
        return funcNode.__funclistIndex = this.funcList[funcList].length - 1;
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
        for (var i = 0; i < this.included.length; i++) {
            if (temp = this.included[i].lookupFunctionByName(assignedName)) {
                return temp;
            }
        }
        return null;
    }

    getStrLiteralIdentifier(text) {
        if (text in this.registeredStringLiterals) {
            return this.registeredStringLiterals[text];
        }
        return this.registeredStringLiterals[text] = this.namer();
    }
}
