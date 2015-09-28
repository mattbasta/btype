import Environment from './environment';


export function buildEnv(options) {
    var env = new Environment(options.filename, options.config);
    var ctx = env.loadFile(options.filename, options.tree);
    env.markRequested(ctx);

    if (!(options.config && options.config.runtime) && !ctx.exports.size) {
        throw new TypeError('Nothing exported from ' + options.filename);
    }

    return env;
}

export default function compiler(options) {
    var env = buildEnv(options);
    return env.make(options.format || 'asmjs');
};
