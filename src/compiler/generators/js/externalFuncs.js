
exports.error = function() {
    return 'function() {throw new Error("Error!")}';
};

exports.Datenowunix = function() {
    return 'function() {return (new Date()).getTime() / 1000 | 0;}';
};

exports.Datenowfloat = function() {
    return 'function() {return (new Date()).getTime() / 1000;}';
};
