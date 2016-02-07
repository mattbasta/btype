var fs = require('fs');
var path = require('path');

if (fs.existsSync(path.resolve(__dirname, 'build', 'btype.js'))) {
    module.exports = require('./build/btype');

} else {
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

}
