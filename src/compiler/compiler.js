var fs = require('fs');
var path = require('path');
var util = require('util');

var transformer = require('./transformer');
var environment = require('./environment');
var context = require('./context');


function processProjectFile(env, filename, tree) {
    // TODO: Make this something less dumb.
    var safe_filename = filename.replace(/_/g, '__').replace(/\./g, '_d').replace(/\-/g, '_D');

    // Generate a context for the file.
    var ctx = context(env, tree);
    console.log(util.inspect(ctx, false, null));
    // Perform simple inline type checking.
    tree.validateTypes(ctx);
    env.addContext(ctx);

    return ctx;
}


module.exports = function(filename, tree) {
    var env = new environment.Environment();
    var origContext = processProjectFile(env, filename, tree);
    env.markRequested(origContext);
    console.log(env.make('asm.js'));
};
