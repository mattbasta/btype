var fs = require('fs');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2));

var constantFold = require('./optimizer/constantFold');
var context = require('./context');
var flattener = require('./flattener');
var globalInit = require('./globalInit');
var nodes = require('./nodes');
var specialModules = require('./specialModules/__directory');
var transformer = require('./transformer');
var types = require('./types');


const LOWEST_ORDER = argv.minblocksize || 16;
const HEAP_SIZE = argv.heapsize || 64 * 1024 * 1024;

// Declare a set of project environment variables.
var ENV_VARS = {
    HEAP_SIZE: HEAP_SIZE,
    BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
    LOWEST_ORDER: LOWEST_ORDER,
};

function Environment(name) {
    this.name = name ? name.trim() : '';
    this.namer = require('./namer')();
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

Environment.prototype.loadFile = function(filename, tree, privileged) {
    if (filename in this.moduleCache) return this.moduleCache[filename];

    if (!tree) {
        var lexer = require('../lexer');
        var parser = require('../parser');
        tree = parser(lexer(fs.readFileSync(filename).toString()));
    }

    var ctx = context(this, tree, filename, null, privileged);

    // Perform simple inline type checking.
    tree.validateTypes(ctx);

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
};

Environment.prototype.import = function(importNode, requestingContext) {

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
};

Environment.prototype.addModule = function(module, context) {
    this.modules[module] = context;
};

Environment.prototype.addContext = function(context) {
    this.included.push(context);
};

Environment.prototype.registerType = function(assignedName, type, context) {
    type.__assignedName = assignedName || this.namer();
    this.typeMap[assignedName] = type;
    this.typeContextMap[assignedName] = context;
    this.types.push(type);
};

Environment.prototype.markRequested = function(context) {
    this.requested = context;
};

Environment.prototype.getFuncListName = function(funcType, noAdd) {
    var fts = funcType.toString();
    if (!(fts in this.funcListTypeMap) && !noAdd) {
        var name = this.funcListTypeMap[fts] = this.namer();
        this.funcListReverseTypeMap[name] = funcType;
        this.funcList[name] = [];
    }
    return this.funcListTypeMap[fts];
};

Environment.prototype.registerFunc = function(funcNode) {
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
};

Environment.prototype.addInit = function(stmt) {
    this.inits.push(stmt);
};

Environment.prototype.make = function(outputLanguage) {
    if (!this.requested) {
        throw new Error('No context was requested for export.');
    }

    if (outputLanguage === 'debug-tree') {
        return this.included.map(function(i) {
            return i.scope.toString();
        }).join('\n');
    }

    var generator = require('./generators/' + outputLanguage + '/generate');
    return generator(this, ENV_VARS);
};

Environment.prototype.findFunctionByAssignedName = function(assignedName) {
    var temp;
    for (var i = 0; i < this.included.length; i++) {
        if (temp = this.included[i].lookupFunctionByName(assignedName)) {
            return temp;
        }
    }
    return null;
};

Environment.prototype.getStrLiteralIdentifier = function(text) {
    if (text in this.registeredStringLiterals) {
        return this.registeredStringLiterals[text];
    }
    return this.registeredStringLiterals[text] = this.namer();
};

module.exports.Environment = Environment;
