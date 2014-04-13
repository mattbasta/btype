var fs = require('fs');

var esprima = require('esprima');
var escodegen = require('escodegen');

var jsTranslate = require('./translate');


function compileIncludes(env, ENV_VARS) {
    return env.includes.map(function(module) {
        return fs.readFileSync(path.resolve(__dirname, '..', '..', 'static', 'asm.js', module + '.js')).toString().replace(/\$([A-Z_]+)\$/g, function(v) {
            return ENV_VARS[v.substr(1, v.length - 2)];
        });
    }).join('\n')
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
        '    "use asm";',
        '    var imul = stdlib.Math.imul;',
        body,
        '})'
    ].join('\n');
}

module.exports = function generate(env, ENV_VARS) {

    var body = env.included.map(jsTranslate).join('\n\n');

    // Compile exports for the code.
    body += '    return {\n' + Object.keys(env.requested.exports).map(function(e) {
        return '        ' + e + ': ' + env.requested.exports[e];
    }).join(';\n    ') + '\n    };';

    // TODO: Write a sorting function to convert the generated JS into properly
    // ordered asm.js using esprima and escodegen

    return makeModule(env, ENV_VARS, body);
};
