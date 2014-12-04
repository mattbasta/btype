var fs = require('fs');

var esprima = require('esprima');
var escodegen = require('escodegen');

var jsTranslate = require('./translate');


function compileIncludes(env, ENV_VARS) {
    return env.includes.map(function(module) {
        return fs.readFileSync(path.resolve(__dirname, '..', '..', 'static', 'asm.js', module + '.js')).toString().replace(/\$([A-Z_]+)\$/g, function(v) {
            return ENV_VARS[v.substr(1, v.length - 2)];
        });
    }).join('\n');
}

function orderCode(body) {
    var parsed = esprima.parse(body);

    console.log(Object.keys(parsed));

    return escodegen.generate(parsed);
}

function makeModule(env, ENV_VARS, body) {
    return [
        '(function(module) {',
        // TODO: Make errors better.
        'var error = function() {throw new Error("Error!")};',
        'var heap = new ArrayBuffer(' + (ENV_VARS.HEAP_SIZE + ENV_VARS.BUDDY_SPACE) + ');',
        'var ret = module(window, {error: error}, heap);',
        'if (ret.__init) ret.__init();',
        'return ret;',
        '})(function' + (env.name ? ' ' + env.name : '') + '(stdlib, foreign, heap) {',
        // '    "use asm";',
        '    var imul = stdlib.Math.imul;',
        body,
        '})'
    ].join('\n');
}

function typeTranslate(type) {
    console.log(type);
    switch (type._type) {
        case 'primitive':
            return '/* primitive: ' + type.toString() + ' */';
        case 'array':
            return '/* array type: ' + type.toString() + ' */';
        case 'slice':
            return '/* slice type: ' + type.toString() + ' */';
        case 'struct':
            return [
                'function ' + type.flatTypeName() + '() {',
                Object.keys(type.contentsTypeMap).map(function(contentsTypeName) {
                    return 'this.' + contentsTypeName + ' = 0';
                }).join('\n'),
                '}',
            ].join('\n');
        case 'tuple':
            return [
                'function ' + type.flatTypeName() + '() {',
                '    this.data = [',
                '    ' + type.contentsTypeArr.map(function(type) {
                    return '0';
                }).join('\n    '),
                '    ];',
                '}',
            ].join('\n');
        default:
            return '/* unknown type translation for ' + type.toString() + ' */';
    }
}

module.exports = function generate(env, ENV_VARS) {

    var body = env.types.map(typeTranslate).join('\n\n') + '\n';
    // body += env.included.map(jsTranslate).join('\n\n');
    body += env.included.map(jsTranslate).join('\n\n');

    // Compile function lists
    body += '\n' + Object.keys(env.funcList).map(function(flist) {
        return '    var ' + flist + ' = [' + env.funcList[flist].join(',') + '];';
    }).join('\n');

    // Compile exports for the code.
    body += '\n    return {\n' + Object.keys(env.requested.exports).map(function(e) {
        return '        ' + e + ': ' + env.requested.exports[e];
    }).join(';\n    ') + '\n    };';

    // TODO: Write a sorting function to convert the generated JS into properly
    // ordered asm.js using esprima and escodegen

    return makeModule(env, ENV_VARS, body);
};
