var fs = require('fs');
var path = require('path');

var externalFuncs = require('../js/externalFuncs');
var jsTranslate = require('./translate');
var postOptimizer = require('../js/postOptimizer');


function getHeapSize(n) {
    // This calculates the next power of two
    var x = Math.log(n) / Math.LN2;
    x = Math.floor(x);
    x += 1;
    x = Math.pow(2, x);
    return x;
}

function makeModule(env, ENV_VARS, body) {
    return [
        '(function(module) {',
        // Create the heap
        'var heap = new ArrayBuffer(' + getHeapSize(ENV_VARS.HEAP_SIZE + ENV_VARS.BUDDY_SPACE) + ');',
        // Shim imul if it doesn't exist (*COUGH* NODE *COUGH*)
        'this.Math.imul = this.Math.imul || function(a, b) {return (a | 0) * (b | 0) | 0;};',
        // Get an instance of the asm module, passing in all of the externally requested items
        'var ret = module(this, {' + env.foreigns.map(function(foreign) {
            var base = JSON.stringify(foreign) + ':';
            if (foreign in externalFuncs) {
                base += externalFuncs[foreign]();
            } else {
                base += 'function() {}';
            }
            return base;
        }).join(',') + '}, heap);',
        // If there's an init method, call it and remove it.
        'if (ret.__init) {ret.$init(); delete ret.$init;}',
        // Return the processed asm module
        'return ret;',
        // Declare the asm module
        '})(function' + (env.name ? ' ' + env.name : ' module') + '(stdlib, foreign, heap) {',
        // asm.js pragma
        '    "use asm";',
        // Always add imul since it's used for integer multiplication
        '    var imul = stdlib.Math.imul;',
        body,
        '})'
    ].join('\n');
}


module.exports = function generate(env, ENV_VARS) {

    var body = '';

    // Include static modules
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/funcref.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/gc.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/memory.js')).toString();

    // Translate and output each included context
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
                return '    ' + base + ' = ' + jsTranslate.typeAnnotation(base, arg) + ';';
            }).join('\n') + '\n' +
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
    body += '\n    return {\n' +
        'malloc: malloc,\nfree: free,\n' +
        Object.keys(env.requested.exports).map(function(e) {
        return '        ' + e + ': ' + env.requested.exports[e];
    }).join(',\n    ') + '\n    };';

    body = postOptimizer.optimize(body);

    Object.keys(ENV_VARS).forEach(function(var_) {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
