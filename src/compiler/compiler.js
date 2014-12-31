var environment = require('./environment');


module.exports = function(filename, tree, format) {
    var env = new environment.Environment();
    var ctx = env.loadFile(filename, tree);
    env.markRequested(ctx);

    if (!Object.keys(ctx.exports).length) {
        console.error('Nothing exported from ' + filename);
        return '';
    }

    var output = env.make(format || 'asmjs');
    return output;
};
