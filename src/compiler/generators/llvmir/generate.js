var fs = require('fs');
var path = require('path');

// var externalFuncs = require('../js/externalFuncs');
var llvmTranslate = require('./translate');
var traverser = require('../../traverser');

var getLLVMType = require('./util').getLLVMType;
var makeName = require('./util').makeName;


function translateArrayTypes(env) {
    return Object.keys(env.__arrayTypes).map(function(arr) {
        var type = env.__arrayTypes[arr];
        var typeName = getLLVMType(type);
        typeName = typeName.substr(0, typeName.length - 1)
        var innerTypeName = getLLVMType(type.contentsType);
        var typeSize = type.contentsType.getSize() || 4

        var out = [
            typeName + ' = type { i32, ' + innerTypeName + '* }',

            'define ' + typeName + '* @btmake_' + typeName.substr(1) + '(i32 %param_length) nounwind {',
            'entry:',
            '    %bodyptr = call i8* @calloc(i32 %param_length, i32 ' + typeSize + ')',
            '    %bodyptrcast = bitcast i8* %bodyptr to ' + innerTypeName + '*',

            '    %ptr = call i8* @malloc(i32 16)',
            '    %result = bitcast i8* %ptr to ' + typeName + '*',
            '    %finalbodyptr = getelementptr ' + typeName + '* %result, i32 0, i32 1',
            '    store ' + innerTypeName + '* %bodyptrcast, ' + innerTypeName + '** %finalbodyptr',

            '    %sizePtr = getelementptr ' + typeName + '* %result, i32 0, i32 0',
            '    store i32 %param_length, i32* %sizePtr',
            '    ret ' + typeName + '* %result',
            '}',
        ];

        return out.join('\n');
    }).join('\n');
}

function translateTupleTypes(env) {
    return Object.keys(env.__tupleTypes).map(function(arr) {
        var type = env.__tupleTypes[arr];
        var typeName = getLLVMType(type);
        typeName = typeName.substr(0, typeName.length - 1)

        return typeName + ' = type { ' + type.contentsTypeArr.map(function(x) {
            return getLLVMType(x);
        }).join(', ') + ' }';
    }).join('\n');
}

function getRuntime(env) {
    if (!env.getConfig('runtime')) {
        return '';
    }

    var entry = env.getConfig('runtimeEntry');
    if (!(entry in env.requested.exports)) {
        throw new TypeError('Cannot find requested runtime entry point in exported functions: ' + entry);
    }

    var funcName = env.requested.exports[entry];
    var func = env.requested.typeMap[funcName];

    if (func.returnType || func.args.length) {
        throw new TypeError('Cannot use "' + entry + '" as entry point because it has incompatible signature: ' + func.toString());
    }

    return [
        'define i32 @main() nounwind ssp uwtable {',
        'entry:',
        (!env.inits.length ? '' : '    call void @modInit()'),
        '    call void @' + makeName(funcName) + '()',
        '    ret i32 0',
        '}',
    ].join('\n');

}


function makeModule(env, ENV_VARS, body) {

    return [
        fs.readFileSync(path.resolve(__dirname, '../../static/llvmir/memory.ll')).toString(),

        translateArrayTypes(env),
        translateTupleTypes(env),

        body,

        getRuntime(env),

        '!0 = metadata !{metadata !"BType/LLVM IR compile target (github.com/mattbasta/btype)"}',
    ].join('\n');

}

function registerAllUsedMethods(env) {

    // We need to ensure that all methods that are accessed (called, stored,
    // etc.) are registered. If not, the first method with a unique signature
    // will be optimized with the "only method in the function table"
    // optimziation, causing it to be called directly. This is invalid, though,
    // because the order in which the methods are accessed does not guarantee
    // the order in which they will be used.

    var knownMethods = {};
    env.types.forEach(function(type) {
        if (!type.methods) return;

        for (var i in type.methods) {
            knownMethods[type.methods[i]] = true;
        }
    });

    env.included.forEach(function(ctx) {
        traverser.traverse(ctx.scope, function(node) {
            if (node.type === 'ObjectDeclaration' && !node.__isConstructed) return false;

            if (node.type !== 'Member') return;

            var baseType = node.base.getType(ctx);
            if (!baseType.hasMethod || !baseType.hasMethod(node.child)) return;

            var funcNode = env.findFunctionByAssignedName(baseType.getMethod(node.child));

            if (!(funcNode.__assignedName in knownMethods)) return;

            env.registerFunc(funcNode);
        });
    });

}

function typeTranslate(type) {
    if (type._type !== 'struct') return '';

    var typeName = makeName(type.flatTypeName());
    var typeNameCat = '%' + typeName;
    var typeNamePtr = typeNameCat + '*';

    var output = typeNameCat + ' = type {\n    ';

    // Add all of the zeroed members
    var layout = type.getOrderedLayout();
    output += layout.map(function(member, i) {
        var out = getLLVMType(member);
        if (i !== layout.length - 1) {
            out += ',';
        }
        out += '  ; ' + member;
        return out;
    }).join('\n    ');

    output += '\n}\n';


    output += 'define private void @btinit_' + typeName + '(' + typeNamePtr + ' %inst) nounwind ssp uwtable {\n';
    output += 'entry:\n';

    output += layout.map(function(member, i) {
        var output = '  %ptr' + i + ' = getelementptr inbounds ' + typeNamePtr + ' %inst, i32 0, i32 ' + i + '\n';
        var memberType = getLLVMType(member);
        if (member._type === 'primitive') {
            switch (member.typeName) {
                case 'float':
                    output += '  store ' + memberType + ' 0.0, ' + memberType + '* %ptr' + i;
                    break;
                case 'int':
                case 'uint':
                    output += '  store ' + memberType + ' 0, ' + memberType + '* %ptr' + i;
                    break;
                case 'bool':
                    output += '  store ' + memberType + ' false, ' + memberType + '* %ptr' + i;
                    break;
            }
        } else {
            output += '  store ' + memberType + ' null, ' + memberType + '* %ptr' + i;
        }
        return output;
    }).filter(function(x) {return x;}).join('\n') + '\n';


    output += '  ret void\n';
    output += '}\n';

    return output;
}


module.exports = function generate(env, ENV_VARS) {

    registerAllUsedMethods(env);

    var body = '';

    // Include static files
    body += fs.readFileSync(path.resolve(__dirname, '../../static/llvmir/funcref.ll')).toString();

    // Declare all of the types
    body += '%string = type { i32, i32, i16* }\n';
    body += env.types.map(typeTranslate, env).join('\n\n') + '\n';

    var generatedContent = env.included.map(llvmTranslate).join('\n\n');

    // Pre-define any string literals
    body += Object.keys(env.registeredStringLiterals).map(function(strVal) {
        var str = env.registeredStringLiterals[strVal];
        return '@string.' + makeName(str) + ' = private unnamed_addr constant [' + (strVal.length + 1) + ' x i16] [' +
        strVal.split('').map(function(c) {
            return 'i16 ' + c.charCodeAt(0);
        }).join(', ') +
        (strVal.length ? ', ' : '') +
        'i16 0], align 2';
    }).join('\n');

    // Translate and output each included context
    body += generatedContent;


    if (env.inits.length) {
        body += '\ndefine void @modInit() nounwind {\n' +
            'entry:\n' +
            '    ' + env.inits.map(function(init) {
                return 'call void @' + makeName(init.__assignedName) + '()';
            }).join('\n    ') + '\n' +
            '    ret void\n' +
            '}\n';
    }


    // Replace environment variables
    Object.keys(ENV_VARS).forEach(function(var_) {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
