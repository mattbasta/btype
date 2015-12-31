import fs from 'fs';
import path from 'path';

import * as externalFuncs from './externalFuncs';
import jsTranslate from './translate';
import * as postOptimizer from './postOptimizer';
import * as symbols from '../../../symbols';


function makeModule(env, ENV_VARS, body) {
    return `(function(module) {
    Math.imul = Math.imul || function imul(a, b) {
        return (a | 0) * (b | 0) | 0;
    };
    var f32 = new Float32Array(1);
    Math.fround = Math.fround || function fround(x) {
        return f32[0] = x, f32[0];
    };
    var ret = module(this, {
        ${env.foreigns.map(foreign => {
            var base = JSON.stringify(foreign) + ':';
            base += foreign in externalFuncs ? externalFuncs[foreign]() : 'function() {}';
            return base;
        }).join(',')}${env.foreigns.length ? ',' : ''}
        arr2str:typeof TextDecoder !== \'undefined\' ? function(arr) {
            return (new TextDecoder()).decode(arr);
        } : function(arr) {
            var out = "";
            for (var i = 0; i < arr.length; i++) {
                out += String.fromCharCode(arr[i]);
            }
            return out;
        }
    });
    if (ret.$init) {
        ret.$init();
    }
    return {
        $strings: {
            read: function(x) {return x;}
        },
        ${Array.from(env.requested.exports.keys())
            .filter(e => e !== '$init')
            .map(e => `${JSON.stringify(e)}: ret[${JSON.stringify(e)}]`)
            .join(',\n')}
    };
}).call(typeof global !== "undefined" ? global : this, function app(stdlib, foreign) {
    var fround = stdlib.Math.fround;
    ${body}
})`;
}

function extend(base, members) {
    var obj = {};
    for (var i in base) {
        obj[i] = base[i];
    }
    for (var i in members) {
        obj[i] = members[i];
    }
    return obj;
}

function typeTranslate(type, context) {
    var output = '';
    switch (type._type) {
        case 'primitive':
            return '/* primitive: ' + type.toString() + ' */';
        case 'array':
            return '/* array type: ' + type.toString() + ' */';

        case 'struct':
            var constructorFunc;
            var selfName;

            // Create the constructor
            if (type.objConstructor) {
                constructorFunc = this.findFunctionByAssignedName(type.objConstructor);
                selfName = constructorFunc.params[0][symbols.ASSIGNED_NAME];

                output = 'function ' + type.flatTypeName() + '(' + constructorFunc.params.slice(1).map(function(param) {
                    return param[symbols.ASSIGNED_NAME];
                }).join(',') + ') { /* struct */';

            } else {
                output = 'function ' + type.flatTypeName() + '() { /* struct */';
            }

            // Add all of the zeroed members
            output += Object.keys(type.contentsTypeMap).map(function(contentsTypeName) {
                var val = 'null';
                if (type.contentsTypeMap[contentsTypeName]._type === 'primitive') {
                    switch (type.contentsTypeMap[contentsTypeName].typeName) {
                        case 'bool':
                            val = 'false';
                            break
                        case 'float':
                        case 'sfloat':
                            val = '0.0';
                            break;
                        default:
                            val = '0';
                    }
                }
                return 'this.' + contentsTypeName + ' = ' + val + ';';
            }).join('\n');

            // Add the constructor if there is one
            if (type.objConstructor) {
                output += 'var ' + selfName + ' = this;\n';
                constructorFunc.body.forEach(function(bodyItem) {
                    output += jsTranslate(extend(context, {scope: bodyItem, env: this}));
                }, this);
            }
            output += '}';

            return output;

        case 'tuple':
            return [
                'function ' + type.flatTypeName() + '() { /* tuple */',
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

export default function generate(env, ENV_VARS) {

    var body = '';

    body += fs.readFileSync(path.resolve(__dirname, '..', '..', 'static', 'asmjs', 'casting.js')).toString();

    env.types.forEach(type => {
        body += typeTranslate.call(
            env,
            type,
            env.typeContextMap[type[symbols.ASSIGNED_NAME]]
        ) + '\n\n';
    });

    env.included.forEach(inc => {
        body += jsTranslate(inc) + '\n\n';
    })

    // Pre-define any string literals
    body += Object.keys(env.registeredStringLiterals).map(function(str) {
        return 'var ' + env.registeredStringLiterals[str] + ' = ' + JSON.stringify(str) + ';';
    }).join('\n');

    if (env.inits.length) {
        body += `
function $$init() {
    ${env.inits.map(init => init[symbols.ASSIGNED_NAME] + '();').join('\n    ')}
}
`;
        env.requested.exports.set('$$init', '$$init');
    }

    // Compile exports for the code.
    body += `
    return {
        ${Array.from(env.requested.exports.keys())
            .map(e => `${JSON.stringify(e)}: ${env.requested.exports.get(e)}`)
            .join(',\n        ')}
    };`;

    // body = postOptimizer.optimize(body);

    return makeModule(env, ENV_VARS, body);
};
