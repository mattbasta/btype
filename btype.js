require('babel-register');

var compiler = require('./src/compiler/compiler');


module.exports = function(source, filename, target) {
    target = target || 'js';
    return compiler({
        filename: filename,
        format: target,
        sourceCode: source,
    });
};
