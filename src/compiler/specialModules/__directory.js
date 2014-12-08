var fs = require('fs');
var path = require('path');


function getPath(name) {
    return path.resolve(__dirname, name + '.js');
}

exports.isSpecialModule = function(name) {
    if (!/^\w+$/.exec(name)) return false; // Filter special names
    return fs.existsSync(getPath(name));
};

exports.getConstructor = function(name, env) {
    if (!exports.isSpecialModule(name)) return;

    return require(getPath(name));
};
