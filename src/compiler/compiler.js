var fs = require('fs');
var util = require('util');

var transformer = require('./transformer');
var context = require('./context');



function makeModule(moduleName, body, includes, exports) {
    return [
        'function ' + moduleName + '(__stdlib, __foreign, __heap) {',
        body,
        '    return {',
        exports.map(function(exp) {
            return '        ' + exp + ': ' + exp + ',';
        }).join('\n'),
        '    };',
        '}'
    ].concat(includes.map(function(module) {
        return fs.readSync('./static/' + module + '.js').toString();
    })).join('\n');
}

module.exports = function(filename, tree) {
    // TODO: Make this something less dumb.
    var safe_filename = filename.replace(/_/g, '__').replace(/./g, '_d').replace(/\-/g, '_D');
    var origContext = context(tree);
    console.log(util.inspect(origContext, false, null));
    tree.validateTypes(origContext);
};
