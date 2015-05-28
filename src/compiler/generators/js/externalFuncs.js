
exports.error = function() {
    return 'function() {throw new Error("Error!")}';
};

exports.Datenowunix = function() {
    return 'function() {return (new Date()).getTime() / 1000 | 0;}';
};

exports.Datenowfloat = function() {
    return 'function() {return (new Date()).getTime() / 1000;}';
};

exports.Performancenow = function() {
    return '(function() {return performance.now.bind(performance) || function() {return (new Date()).getTime();};}())'
};

exports.Consolelogint = exports.Consolelogfloat = exports.Consolelogstr = function() {
    return 'console.log.bind(console)'
};

exports.Consolelogbool = function() {
    return 'function(x) {console.log(x ? \'true\' : \'false\')}'
};

exports.getNaN = function() {
    return 'function() {return NaN;}'
};
exports.getNegZero = function() {
    return 'function() {return -0.0;}'
};
exports.getInfinity = function() {
    return 'function() {return Infinity;}'
};
exports.getNegInfinity = function() {
    return 'function() {return -Infinity;}'
};

exports.featureArcTrig = function() {
    return 'function() {return true;}'
};
