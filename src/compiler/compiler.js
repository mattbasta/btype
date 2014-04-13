var environment = require('./environment');


module.exports = function(filename, tree) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    console.log(env.make('js'));
};
