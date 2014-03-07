var fs = require('fs');
var path = require('path');
var util = require('util');

var transformer = require('./transformer');
var context = require('./context');


// TODO: Make these customizable.
const LOWEST_ORDER = 128;
const HEAP_SIZE = 128 * 1024 * 1024;


function makeModule(moduleName, body, includes, exports) {
    var ENV_VARS = {
        HEAP_SIZE: HEAP_SIZE,
        BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
        LOWEST_ORDER: LOWEST_ORDER
    };
    return [
        '(function(module) {',
        // TODO: Make errors better.
        'var error = function() {throw new Error("Error!")};',
        'var heap = new ArrayBuffer(' + (HEAP_SIZE + BUDDY_SPACE) + ');',
        'var ret = module(window, {error: error}, heap);',
        'if (ret.__init) ret.__init();',
        'return ret;',
        '})(function' + (moduleName ? ' ' + moduleName.trim() : '') + '(stdlib, foreign, heap) {',
        '    "use asm";',
        '    var imul = stdlib.Math.imul;',
        body,
        includes.map(function(module) {
            return fs.readFileSync(path.resolve(__dirname, 'static', module + '.js')).toString().replace(/\$([A-Z_]+)\$/g, function(v) {
                return ENV_VARS[v.substr(1, v.length - 2)];
            });
        }).join('\n'),
        '    return {',
        Object.keys(exports).map(function(e) {
            return '        ' + e + ': ' + exports[e];
        }).join(';\n    '),
        '    };',
        '})'
    ].join('\n');
}


module.exports = function(filename, tree) {
    // TODO: Make this something less dumb.
    var safe_filename = filename.replace(/_/g, '__').replace(/\./g, '_d').replace(/\-/g, '_D');
    var origContext = context(tree);
    console.log(util.inspect(origContext, false, null));
    tree.validateTypes(origContext);
    console.log(makeModule(
        'test',
        '',  // TODO: Put generated code here.
        ['memory'],
        origContext.exports
    ));
};
