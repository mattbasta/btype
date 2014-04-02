var fs = require('fs');
var path = require('path');

var transformer = require('./transformer');
var environment = require('./environment');


module.exports = function(filename, tree) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    console.log(env.make('asm.js'));
};
