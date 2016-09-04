import {GLOBAL_PREFIX} from './translate';


const HAS_FOREIGN_PRINTF = Symbol();


export function error() {
    // return 'function() {throw new Error("Error!")}';
};

export function Datenowunix() {
    return [
        'declare i64 @time(i64*)',
        'define private i32 @foreign_Datenowunix() alwaysinline {',
        '    %out = call i64 @time(i64* null)',
        '    %conv = trunc i64 %out to i32',
        '    ret i32 %conv',
        '}',
    ].join('\n');
};

export function Datenowfloat() {
    throw new Error('Not implemented');
};

export function Performancenow() {
    throw new Error('Not implemented');
};


function addPrintf(env) {
    if (env[HAS_FOREIGN_PRINTF]) {
        return;
    }

    env[GLOBAL_PREFIX] += `
@.str.percd = private unnamed_addr constant [4 x i8] c"%d\\0A\\00", align 1
@.str.percf = private unnamed_addr constant [5 x i8] c"%#g\\0A\\00", align 1
@.str.percs = private unnamed_addr constant [4 x i8] c"%s\\0A\\00", align 1
@.str.true = private unnamed_addr constant [6 x i8] c"true\\0A\\00", align 1
@.str.false = private unnamed_addr constant [7 x i8] c"false\\0A\\00", align 1
declare i32 @printf(i8* nocapture readonly, ...)
`;

    env[HAS_FOREIGN_PRINTF] = true;
}

export function Consolelogint(env) {
    addPrintf(env);
    return [
        'define private void @foreign_Consolelogint(i32 %inp) alwaysinline {',
        '    %ignore = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @.str.percd, i32 0, i32 0), i32 %inp)',
        '    ret void',
        '}',
    ].join('\n');
};

export function Consolelogfloat(env) {
    addPrintf(env);
    return [
        'define private void @foreign_Consolelogfloat(double %inp) alwaysinline {',
        '    %ignore = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([5 x i8], [5 x i8]* @.str.percf, i32 0, i32 0), double %inp)',
        '    ret void',
        '}',
    ].join('\n');
};

export function Consolelogbool(env) {
    addPrintf(env);
    return [
        'define private void @foreign_Consolelogbool(i1 %inp) alwaysinline {',
        'entry:',
        '    br i1 %inp, label %t, label %f',
        't:',
        '    %ignoret = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([6 x i8], [6 x i8]* @.str.true, i32 0, i32 0))',
        '    br label %a',
        'f:',
        '    %ignoref = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([7 x i8], [7 x i8]* @.str.false, i32 0, i32 0))',
        '    br label %a',
        'a:',
        '    ret void',
        '}',
    ].join('\n');
};

export function Consolelogstr(env) {
    addPrintf(env);
    return [
        'define private void @foreign_Consolelogstr(%string* %inp) alwaysinline {',
        '    ;%strc = getelementptr inbounds %string* %inp, i32 0, i32 2, i32 0',
        '    ;%ignore = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @.str.percs, i32 0, i32 0), i8* %strc)',
        '    ret void',
        '}',
    ].join('\n');
};

export function Consolelogsfloat(env) {
    addPrintf(env);
    return [
        'define private void @foreign_Consolelogfloat(float %inp) alwaysinline {',
        '    %ignore = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([3 x i8], [3 x i8]* @.str.percf, i32 0, i32 0), float %inp)',
        '    ret void',
        '}',
    ].join('\n');
};
export function getNaN() {
    return [
        '@NAN = private global double 0x7FF8000000000000',
        'define private double @foreign_getNaN() alwaysinline {',
        'entry:',
        '    %out = load double, double* @NAN',
        '    ret double %out',
        '}',
    ].join('\n');
};
export function getNegZero() {
    return [
        '@NEG_ZERO = private global double 0x8000000000000000',
        'define private double @foreign_getNegZero() alwaysinline {',
        'entry:',
        '    %out = load double, double* @NEG_ZERO',
        '    ret double %out',
        '}',
    ].join('\n');
};
export function getInfinity() {
    return [
        '@INF = private global double 0x7F80000000000000',
        'define private double @foreign_getInfinity() alwaysinline {',
        'entry:',
        '    %out = load double, double* @INF',
        '    ret double %out',
        '}',
    ].join('\n');
};
export function getNegInfinity() {
    return [
        '@NEG_INF = private global double 0xFF80000000000000',
        'define private double @foreign_getNegInfinity() alwaysinline {',
        'entry:',
        '    %out = load double, double* @NEG_INF',
        '    ret double %out',
        '}',
    ].join('\n');
};

export function featureArcTrig() {
    return [
        'define private i1 @foreign_featureArcTrig() alwaysinline {',
        'entry:',
        '    ret i1 false',
        '}',
    ].join('\n');
};
