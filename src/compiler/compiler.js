import Environment from './environment';


export function buildEnv(options) {
    const env = new Environment(options.filename, options.config);
    const ctx = env.loadFile(
        options.filename,
        options.tree || null,
        options.privileged || false,
        options.sourceCode || null
    );
    env.markRequested(ctx);

    if (!(options.config && options.config.runtime) && !ctx.exports.size) {
        throw new TypeError('Nothing exported from ' + options.filename);
    }

    return env;
}

export default function compiler(options) {
    const env = buildEnv(options);
    return env.make(options.format || 'asmjs');
};
