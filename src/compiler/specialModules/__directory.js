var fs = require('fs');
var path = require('path');


function getPath(name) {
    return path.resolve(__dirname, name + '.js');
}

export function isSpecialModule(name) {
    if (!/^\w+$/.exec(name)) return false; // Filter special names
    return fs.existsSync(getPath(name));
};

export function getConstructor(name, env) {
    if (!isSpecialModule(name)) return;

    return require(getPath(name));
};
