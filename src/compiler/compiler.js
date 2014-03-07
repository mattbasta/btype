var fs = require('fs');
var path = require('path');
var util = require('util');

var transformer = require('./transformer');
var context = require('./context');


const HEAP_SIZE = 128 * 1024 * 1024;  // TODO: Make this customizable.
const ENV_VARS = {
    HEAP_SIZE: HEAP_SIZE
};


function makeModule(moduleName, body, includes, exports) {
    return [
        'function' + (moduleName ? ' ' + moduleName.trim() : '') + '(__stdlib, __foreign, __heap) {',
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
        '}'
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
