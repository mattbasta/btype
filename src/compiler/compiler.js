var environment = require('./environment');


function buildEnv(options) {
    var env = new environment.Environment(options.filename, options.config);
    var ctx = env.loadFile(options.filename, options.tree);
    env.markRequested(ctx);

    if (!options.config.runtime && !Object.keys(ctx.exports).length) {
        throw new TypeError('Nothing exported from ' + options.filename);
    }

    return env;
}

module.exports = function compiler(options) {
    var env = buildEnv(options);
    return env.make(options.format || 'asmjs');
};

module.exports.buildEnv = buildEnv;
