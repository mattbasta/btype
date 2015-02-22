
exports.error = function() {
    // return 'function() {throw new Error("Error!")}';
};

exports.Datenowunix = function() {
    return [
        'declare i64 @time(i64*)',
        'define i32 @foreign_Datenowunix() {',
        '    %out = call i64 @time(i64* null)',
        '    %conv = trunc i64 %out to i32',
        '    ret i32 %conv',
        '}',
    ].join('\n');
};

exports.Datenowfloat = function() {
    return 'function() {return (new Date()).getTime() / 1000;}';
};

exports.Performancenow = function() {
    // TODO: Support this better.
    return 'define double @foreign_Performancenow() {\n    ret double 0\n}';
};

exports.Consolelog = function() {
    // TODO: Support this better.
    return '';
};
