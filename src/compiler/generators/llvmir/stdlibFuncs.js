function include(env, func) {
    if (!(func in exports)) {
        throw new TypeError('Invalid include: ' + func);
    }

    if (func in env.__stdlibRequested) {
        return;
    }

    env.__stdlibRequested[func] = true;
    var val = exports[func](env);
    env.__globalPrefix += val;
}

exports.registerFunc = function registerFunc(env, funcName) {
    include(env, funcName);
};


exports['stdlib.Math.abs'] = function fabs(env) {
    return [
        'define private i32 @stdlib.Math.abs(i32 %inp) alwaysinline {',
        'entry:',
        '    %0 = icmp slt i32 %inp, 0',
        '    br i1 %0, label %t, label %f',
        't:',
        '    %out = mul nsw i32 %inp, -1',
        '    ret i32 %out',
        'f:',
        '    ret i32 %inp',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.sin'] = function sin(env) {
    return [
        'declare double @llvm.sin.f64(double)',
        'define private double @stdlib.Math.sin(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.sin.f64(double %inp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.cos'] = function cos(env) {
    return [
        'declare double @llvm.cos.f64(double)',
        'define private double @stdlib.Math.cos(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.cos.f64(double %inp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.tan'] = function tan(env) {
    include(env, 'stdlib.Math.sin');
    include(env, 'stdlib.Math.cos');
    return [
        'define private double @stdlib.Math.tan(double %inp) alwaysinline {',
        'entry:',
        '    %s = call double @stdlib.Math.sin(double %inp)',
        '    %c = call double @stdlib.Math.cos(double %inp)',
        '    %ret = fdiv double %s, %c',
        '    ret double %ret',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.sqrt'] = function sqrt(env) {
    return [
        'declare double @llvm.sqrt.f64(double)',
        'define private double @stdlib.Math.sqrt(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.sqrt.f64(double %inp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.log'] = function log(env) {
    return [
        'declare double @llvm.log.f64(double)',
        'define private double @stdlib.Math.log(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.log.f64(double %inp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.pow'] = function pow(env) {
    return [
        'declare double @llvm.pow.f64(double, double)',
        'define private double @stdlib.Math.pow(double %base, double %exp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.pow.f64(double %base, double %exp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.exp'] = function exp(env) {
    return [
        'declare double @llvm.exp.f64(double)',
        'define private double @stdlib.Math.exp(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.exp.f64(double %inp)',
        '    ret double %0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.ceil'] = function ceil(env) {
    return [
        'declare double @llvm.ceil.f64(double)',
        'define private i32 @stdlib.Math.ceil(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.ceil.f64(double %inp)',
        '    %1 = fptosi double %0 to i32',
        '    ret i32 %1',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.floor'] = function floor(env) {
    return [
        'declare double @llvm.floor.f64(double)',
        'define private i32 @stdlib.Math.floor(double %inp) alwaysinline {',
        'entry:',
        '    %0 = call double @llvm.floor.f64(double %inp)',
        '    %1 = fptosi double %0 to i32',
        '    ret i32 %1',
        '}',
    ].join('\n') + '\n';
};


// TO DO:

exports['stdlib.Math.asin'] = function asin(env) {
    return [
        'define private double @stdlib.Math.asin(double %inp) alwaysinline {',
        'entry:',
        '    ret double 0.0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.acos'] = function acos(env) {
    return [
        'define private double @stdlib.Math.acos(double %inp) alwaysinline {',
        'entry:',
        '    ret double 0.0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.atan'] = function atan(env) {
    return [
        'define private double @stdlib.Math.atan(double %inp) alwaysinline {',
        'entry:',
        '    ret double 0.0',
        '}',
    ].join('\n') + '\n';
};

exports['stdlib.Math.atan2'] = function atan2(env) {
    return [
        'define private double @stdlib.Math.atan2(double %x, double %y) alwaysinline {',
        'entry:',
        '    ret double 0.0',
        '}',
    ].join('\n') + '\n';
};
