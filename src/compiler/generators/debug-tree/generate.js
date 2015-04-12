module.exports = function(env) {
    return env.included.map(function(i) {
        return i.scope.toString();
    }).join('\n');
};
