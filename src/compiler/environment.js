var fs = require('fs');
var path = require('path');
var util = require('util');

var context = require('./context');
var types = require('./types');


// TODO: Make these customizable.
const LOWEST_ORDER = 128;
const HEAP_SIZE = 128 * 1024 * 1024;


function Environment(name) {
    this.name = name ? name.trim() : '';
    this.namer = require('./namer')();
    this.included = [];
    this.requested = null;
    this.modules = {};
    this.inits = [];

    this.moduleCache = {};
}

Environment.prototype.loadFile = function(filename, tree) {
    if (filename in this.moduleCache) return this.moduleCache[filename];

    if (!tree) {
        var lexer = require('../lexer');
        var parser = require('../parser');
        tree = parser(lexer(fs.readFileSync(filename).toString()));
    }

    var ctx = context(this, tree, filename);
    console.log(util.inspect(ctx, false, null));

    // Perform simple inline type checking.
    tree.validateTypes(ctx);

    this.addContext(ctx);
    this.moduleCache[filename] = ctx;
    return ctx;
};

Environment.prototype.import = function(importNode, requestingContext) {
    // TODO: Add some sort of system to resolve stdlib imports with the same
    // name

    var baseDir = path.dirname(requestingContext.filename);

    var target;
    // TODO: Make this handle multiple levels of nesting.
    if (importNode.member) {
        target = path.resolve(baseDir, importNode.base, importNode.member);
    } else {
        target = path.resolve(baseDir, importNode.base);
    }
    target += '.bt';

    if (!fs.existsSync(target)) {
        throw new Error('Could not find imported module: ' + target);
    }

    var importedContext = this.loadFile(target);

    var ret = new types('_module');
    ret.memberTypes = importedContext.exports;
    // TODO: fill out ret.members
};

Environment.prototype.addModule = function(module, context) {
    this.modules[module] = context;
};

Environment.prototype.addContext = function(context) {
    this.included.push(context);
};

Environment.prototype.markRequested = function(context) {
    this.requested = context;
};

Environment.prototype.addInit = function(stmt) {
    this.inits.push(stmt);
};

Environment.prototype.make = function(outputLanguage) {
    if (!this.requested) {
        throw new Error('No context was requested for export.');
    }

    // First, compile everything
    var body = '';
    var i;
    // Compile global declarations.
    for (i = 0; i < this.included.length; i++) {
        body += this.included[i].makeDeclarations(outputLanguage) + '\n';
    }

    // Compile functions.
    for (i = 0; i < this.included.length; i++) {
        body += this.included[i].makeFunctions(outputLanguage) + '\n';
    }

    // TODO: Figure this out someday.
    // // Compile function tables.
    // for (i = 0; i < this.included.length; i++) {}

    // Compile exports.
    var exports = this.requested.exports;
    body += '    return {\n' + Object.keys(exports).map(function(e) {
        return '        ' + e + ': ' + exports[e];
    }).join(';\n    ') + '\n    };';

    // Declare a set of project environment variables.
    // TODO: Make this configurable.
    var ENV_VARS = {
        HEAP_SIZE: HEAP_SIZE,
        BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
        LOWEST_ORDER: LOWEST_ORDER
    };
    return [
        '(function(module) {',
        // TODO: Make errors better.
        'var error = function() {throw new Error("Error!")};',
        'var heap = new ArrayBuffer(' + (ENV_VARS.HEAP_SIZE + ENV_VARS.BUDDY_SPACE) + ');',
        'var ret = module(window, {error: error}, heap);',
        'if (ret.__init) ret.__init();',
        'return ret;',
        '})(function' + (this.name ? ' ' + this.name : '') + '(stdlib, foreign, heap) {',
        '    "use asm";',
        '    var imul = stdlib.Math.imul;',
        includes.map(function(module) {
            return fs.readFileSync(path.resolve(__dirname, 'static', outputLanguage, module + '.js')).toString().replace(/\$([A-Z_]+)\$/g, function(v) {
                return ENV_VARS[v.substr(1, v.length - 2)];
            });
        }).join('\n'),
        body,
        '})'
    ].join('\n');
};

module.exports.Environment = Environment;
