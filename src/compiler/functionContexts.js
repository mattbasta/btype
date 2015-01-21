var types = require('./types');


exports.newFuncCtx = function(name, contents, context) {
    var funcctxType = new types.Struct(name, contents);
    context.registerType(name, funcctxType, context);

    return funcctxType;
};
