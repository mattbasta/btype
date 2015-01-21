var fs = require('fs');
var path = require('path');

var externalFuncs = require('./externalFuncs');
var jsTranslate = require('./translate');
var postOptimizer = require('./postOptimizer');


function compileIncludes(env, ENV_VARS) {
    return env.includes.map(function(module) {
        return fs.readFileSync(path.resolve(__dirname, '..', '..', 'static', 'asm.js', module + '.js')).toString().replace(/\$([A-Z_]+)\$/g, function(v) {
            return ENV_VARS[v.substr(1, v.length - 2)];
        });
    }).join('\n');
}


function makeModule(env, ENV_VARS, body) {
    return [
        '(function(module) {',
        'this.Math.imul = this.Math.imul || function(a, b) {return (a | 0) * (b | 0) | 0;};',
        'var ret = module(this, {' + env.foreigns.map(function(foreign) {
            var base = JSON.stringify(foreign) + ':';
            if (foreign in externalFuncs) {
                base += externalFuncs[foreign]();
            } else {
                base += 'function() {}';
            }
            return base;
        }).join(',') + '});',
        'if (ret.$init) {ret.$init();delete ret.$init;}',
        'return ret;',
        '})(function' + (env.name ? ' ' + env.name : '') + '(stdlib, foreign) {',
        body,
        '})'
    ].join('\n');
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
        case 'slice':
            return '/* slice type: ' + type.toString() + ' */';

        case 'struct':
            var constructorFunc;
            var selfName;

            // Create the constructor
            if (type.objConstructor) {
                constructorFunc = this.findFunctionByAssignedName(type.objConstructor);
                selfName = constructorFunc.params[0].__assignedName;

                output = 'function ' + type.flatTypeName() + '(' + constructorFunc.params.slice(1).map(function(param) {
                    return param.__assignedName;
                }).join(',') + ') { /* struct */';

            } else {
                output = 'function ' + type.flatTypeName() + '() { /* struct */';
            }

            // Add all of the zeroed members
            output += Object.keys(type.contentsTypeMap).map(function(contentsTypeName) {
                return 'this.' + contentsTypeName + ' = 0;';
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

module.exports = function generate(env, ENV_VARS) {

    var body = '';

    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/casting.js')).toString();

    body += env.types.map(function(type) {
        return typeTranslate.call(
            env,
            type,
            env.typeContextMap[type.__assignedName]
        );
    }, env).join('\n\n') + '\n';
    body += env.included.map(jsTranslate).join('\n\n');

    if (env.inits.length) {
        body += '\nfunction $init() {\n' +
            '    ' + env.inits.map(function(init) {
                return init.__assignedName + '();';
            }).join('\n    ') + '\n' +
            '}\n';
        env.requested.exports['$init'] = '$init';
    }

    // Compile exports for the code.
    body += '\n    return {\n    ' + Object.keys(env.requested.exports).map(function(e) {
        return '        ' + e + ': ' + env.requested.exports[e];
    }).join(',\n    ') + '\n    };';

    body = postOptimizer.optimize(body);

    return makeModule(env, ENV_VARS, body);
};
