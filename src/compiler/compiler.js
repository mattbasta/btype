var environment = require('./environment');


module.exports = function(filename, tree) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    var output = env.make('asmjs');
    console.log(output);
    return output;
};
