
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


function addPrintf(env) {
    if (env.__hasForeignPrintf) {
        return;
    }

    env.__globalPrefix += [
        '@.str.percd = private unnamed_addr constant [3 x i8] c"%d\\00", align 1',
        '@.str.percf = private unnamed_addr constant [3 x i8] c"%f\\00", align 1',
        'declare i32 @printf(i8*, ...)',
    ].join('\n') + '\n';

    env.__hasForeignPrintf = true;
}

exports.Consolelogint = function(env) {
    addPrintf(env);
    return [
        'define void @foreign_Consolelogint(i32 %inp) {',
        '    %ignore = call i32 (i8*, ...)* @printf(i8* getelementptr inbounds ([3 x i8]* @.str.percd, i32 0, i32 0), i32 %inp)',
        '    ret void',
        '}',
    ].join('\n');
};

exports.Consolelogfloat = function(env) {
    addPrintf(env);
    return [
        'define void @foreign_Consolelogfloat(double %inp) {',
        '    %ignore = call i32 (i8*, ...)* @printf(i8* getelementptr inbounds ([3 x i8]* @.str.percf, i32 0, i32 0), double %inp)',
        '    ret void',
        '}',
    ].join('\n');
};

exports.Consolelogsfloat = function(env) {
    addPrintf(env);
    return [
        'define void @foreign_Consolelogfloat(float %inp) {',
        '    %ignore = call i32 (i8*, ...)* @printf(i8* getelementptr inbounds ([3 x i8]* @.str.percf, i32 0, i32 0), float %inp)',
        '    ret void',
        '}',
    ].join('\n');
};
