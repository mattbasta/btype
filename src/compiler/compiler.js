var environment = require('./environment');


module.exports = function(filename, tree, format) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    var output = env.make(format || 'js');
    return output;
};
