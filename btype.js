var fs = require('fs');
var path = require('path');

var compiler;
if (fs.existsSync(path.resolve(__dirname, 'build', 'compiler', 'compiler.js'))) {
    compiler = require('./build/compiler/compiler').default;

} else {
    require('babel-register');
    compiler = require('./src/compiler/compiler');
}

module.exports = function(source, filename, target) {
    target = target || 'js';
    return compiler({
        filename: filename,
        format: target,
        sourceCode: source,
    });
};
