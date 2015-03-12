var environment = require('./environment');


function buildEnv(filename, tree) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    if (!Object.keys(ctx.exports).length) {
        console.error('Nothing exported from ' + filename);
        return '';
    }

    return env;
}

module.exports = function compiler(filename, tree, format) {
    var env = buildEnv(filename, tree);

    var output = env.make(format || 'asmjs');
    return output;
};

module.exports.buildEnv = buildEnv;
