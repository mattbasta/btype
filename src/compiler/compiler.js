import Environment from './environment';


function buildEnv(options) {
    var env = new Environment(options.filename, options.config);
    var ctx = env.loadFile(options.filename, options.tree);
    env.markRequested(ctx);

    if (!(options.config && options.config.runtime) && !ctx.exports.size) {
        throw new TypeError('Nothing exported from ' + options.filename);
    }

    return env;
}

module.exports = function compiler(options) {
    var env = buildEnv(options);
    return env.make(options.format || 'asmjs');
};

module.exports.buildEnv = buildEnv;
