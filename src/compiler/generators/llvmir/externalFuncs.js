
exports.Datenowunix = function() {
    return 'function() {return (new Date()).getTime() / 1000 | 0;}';
};

exports.Datenowfloat = function() {
    return 'function() {return (new Date()).getTime() / 1000;}';
};

exports.Performancenow = function() {
    return '(function() {return performance.now.bind(performance) || function() {return (new Date()).getTime();};}())'
};

exports.Consolelog = function() {
    return 'console.log.bind(console)'
};
