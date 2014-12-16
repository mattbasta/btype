var fs = require('fs');
var path = require('path');

var jsTranslate = require('./translate');
var postOptimizer = require('../js/postOptimizer');


function makeModule(env, ENV_VARS, body) {
    return [
        '(function(module) {',
        'var error = function() {throw new Error()};',
        'var heap = new ArrayBuffer(' + (ENV_VARS.HEAP_SIZE + ENV_VARS.BUDDY_SPACE) + ');',
        'var ret = module(this, {error: error}, heap);',
        'if (ret.__init) ret.__init();',
        'return ret;',
        '})(function' + (env.name ? ' ' + env.name : ' module') + '(stdlib, foreign, heap) {',
        '    "use asm";',
        '    var imul = stdlib.Math.imul;',
        body,
        '})'
    ].join('\n');
}


module.exports = function generate(env, ENV_VARS) {

    var body = '';
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/memory.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/funcref.js')).toString();

    // var body = env.types.map(typeTranslate).join('\n\n') + '\n';
    // body += env.included.map(jsTranslate).join('\n\n');
    body += env.included.map(jsTranslate).join('\n\n');


    // Compile function list callers
    body += '\n' + Object.keys(env.funcList).map(function(flist) {
        var funcList = env.funcList[flist];
        var funcType = env.funcListReverseTypeMap[flist];
        var paramList = funcType.args.map(function(param, i) {
            return '$param' + i;
        });
        return 'function ' + flist + '$$call($$ctx' +
            (paramList.length ? ',' : '') +
            paramList.join(',') +
            ') {\n' +
            '    $$ctx = $$ctx | 0;\n' +
            funcType.args.map(function(arg, i) {
                var base = '$param' + i;
                return '    ' + base + ' = ' + jsTranslate.typeAnnotation(base, arg);
            }).join('\n') +
            '    return ' + jsTranslate.typeAnnotation(
                    flist + '[ptrheap[$$ctx >> 2]&' + (funcList.length - 1) + '](' +
                        paramList.join(',') +
                        (paramList.length ? ',' : '') +
                        'ptrheap[$$ctx + 4 >> 2]|0)',
                    funcType.returnType
                ) +
                ';\n' +
            '}';
    }).join('\n');

    // Compile function lists
    body += '\n' + Object.keys(env.funcList).map(function(flist) {
        return '    var ' + flist + ' = [' + env.funcList[flist].join(',') + '];';
    }).join('\n');

    // Compile exports for the code.
    body += '\n    return {\n' + Object.keys(env.requested.exports).map(function(e) {
        return '        ' + e + ': ' + env.requested.exports[e];
    }).join(';\n    ') + '\n    };';

    body = postOptimizer.optimize(body);

    Object.keys(ENV_VARS).forEach(function(var_) {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
