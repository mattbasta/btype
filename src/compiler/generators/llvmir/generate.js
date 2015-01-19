var fs = require('fs');
var path = require('path');

// var externalFuncs = require('../js/externalFuncs');
var llvmTranslate = require('./translate');
var postOptimizer = require('./postOptimizer');
var traverser = require('../../traverser');

var getLLVMType = require('./util').getLLVMType;
var makeName = require('./util').makeName;


function makeModule(env, ENV_VARS, body) {

    return [
        'declare i8* @malloc(i32)',
        'declare void @free(i8*)',

        body,
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
            if (node.type !== 'Member') return;

            var baseType = node.base.getType(ctx);
            if (!baseType.hasMethod(node.child)) return;

            var funcNode = env.findFunctionByAssignedName(baseType.getMethod(node.child));

            if (!(funcNode.__assignedName in knownMethods)) return;

            env.registerFunc(funcNode);
        });
    });

}

function typeTranslate(type) {
    var output = '';
    switch (type._type) {
        case 'struct':
            output = '%' + makeName(type.flatTypeName()) + ' = type {\n    ';

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

            output += '\n}';
            return output;

        case 'tuple':
            output = '%' + makeName(type.flatTypeName()) + ' = type {\n    ';

            // Add all of the zeroed members
            output += type.contentsTypeArr.map(getLLVMType).join(',\n    ');

            output += '\n}';
            return output;
    }
}


module.exports = function generate(env, ENV_VARS) {

    registerAllUsedMethods(env);

    var body = '';

    // Include static files
    body += fs.readFileSync(path.resolve(__dirname, '../../static/llvmir/funcref.ll')).toString();

    // Declare all of the types
    body += env.types.map(typeTranslate, env).join('\n\n') + '\n';

    // Translate and output each included context
    body += env.included.map(llvmTranslate).join('\n\n');

    if (env.inits.length) {
        body += '\ndefine void @modInit() nounwind {\n' +
            '    ' + env.inits.map(function(init) {
                return 'call void ' + init.__assignedName + '()';
            }).join('\n    ') + '\n' +
            '}\n';
    }

    // Compile function reference types
    body += '\n' + Object.keys(env.funcList).map(function(flist) {
        if (env.funcList[flist].length === 1) return '';

        var funcType = env.funcListReverseTypeMap[flist];

        var madeName = makeName(flist);

        var funcSignature = getLLVMType(funcType.getReturnType()) + ' (' +
            funcType.args.map(getLLVMType).join(', ') +
            ')*';

        var out = '%funcRef' + madeName + ' = type {' + funcSignature + ', i8*}\n';

        out += 'define @funcRef' + madeName + 'Inst %' + madeName + '* (' +
            funcSignature + ', i8*) nounwind alwaysinline {\n' +
            // TODO: Make 64-bit configurable?
            '    %allocatedSpace = call i8* @malloc(i64 16)\n' + // 16 = sizeof(function*) + sizeof(funcctx*)
            '    %allocatedSpaceAsFR = bitcast i8* %allocatedSpace to %' + madeName + '*\n' +
            '    %refInst = alloca %' + madeName + '*, align 8\n' +
            '    store %' + madeName + '* %allocatedSpaceAsFR, %' + madeName + '** %refInst, align 8\n' +
            // TODO: Finish this?
            '    \n' +
            '}';

        return out;

    }).filter(function(x) {return !!x;}).join('\n');


    // Replace environment variables
    Object.keys(ENV_VARS).forEach(function(var_) {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
