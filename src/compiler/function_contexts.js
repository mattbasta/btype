var types = require('./types');


exports.newFuncCtx = function(name, contents, context) {
    var resolvedContents = [];
    for (var varname in contents) {
        resolvedContents.push(context.resolveType(varname));
    }

    var funcctxType = new types.Struct(name, contents);
    context.registerType(name, funcctxType);

    return funcctxType;
};
