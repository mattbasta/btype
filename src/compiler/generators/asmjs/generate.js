import fs from 'fs';
import path from 'path';

import * as hlirNodes from '../../../hlirNodes';
import externalFuncs from '../js/externalFuncs';
import jsTranslate from './translate';
import {HEAP_MODIFIERS, heapName, typeAnnotation} from './translate';
import {optimize as postOptimizer} from '../js/postOptimizer';
import * as symbols from '../../../symbols';

var argv = require('minimist')(process.argv.slice(2));


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
        'this.Math.imul = this.Math.imul || function imul(a, b) {return (a | 0) * (b | 0) | 0;};',
        // Shim fround in the same way
        'var f32_ = new Float32Array(1);',
        'this.Math.fround = this.Math.fround || function fround(x) {return f32[0] = x, f32[0];};',
        // String literal initialization
        'var strings = [' +
            Array.from(env.registeredStringLiterals.keys()).sort().map(s => env.registeredStringLiterals.get(s)).join(',') +
            '];',
        'var stringsPtr = 0;',
        'var u32 = new Uint32Array(heap);',
        'function initString(ptr) {',
        '    var x = strings[stringsPtr++];',
        '    u32[ptr + 8 >> 2] = x.length;',
        '    u32[ptr + 12 >> 2] = x.length;',
        '    ptr += 16;',
        '    var len = x.length;',
        '    for (var i = 0; i < len; i++) {',
        '        u32[(ptr >> 2) + i] = x.charCodeAt(i);',
        '    }',
        '}',
        'function readString(ptr) {',
        '    var len = u32[ptr + 8 >> 2];',
        '    var start = ptr + 16 >> 2;',
        '    if (this.TextDecoder) return (new TextDecoder()).decode(u32.subarray(start, start + len));', // faster cheaty way
        '    var out = "";', // slower less cheaty way
        '    for (var i = 0; i < len; i++) {',
        '        out += String.fromCharCode(u32[start + i]);',
        '    }',
        '    return out;',
        '}',
        // Get an instance of the asm module, passing in all of the externally requested items
        'var ret = module(this, {__initString: initString,' +
            env.foreigns.map(foreign => {
                var base = JSON.stringify(foreign) + ':';
                if (foreign in externalFuncs) {
                    base += externalFuncs[foreign]();
                } else {
                    base += 'function() {}';
                }
                return base;
            }).join(',') + '}, heap);',
        // If there's an init method, call it and remove it.
        'if (ret.$$init) {ret.$$init();}',
        // Return the processed asm module
        'return {',
        '$internal:{heap:heap, malloc: ret.malloc, free: ret.free, calloc: ret.calloc},',
        '$strings:{read: readString},',
        Array.from(env.requested.exports.keys())
            .filter(e => e !== '$$init')
            .map(e => `${e}: ret.${e}`)
            .join(',\n'),
        '};',
        // Declare the asm module
        '})(function module_(stdlib, foreign, heap) {',
        // asm.js pragma
        '    "use asm";',
        // Always add imul since it's used for integer multiplication
        '    var imul = stdlib.Math.imul;',
        // Same for fround to support sfloat
        '    var fround = stdlib.Math.fround;',
        body,
        '})'
    ].join('\n');
}

function registerAllUsedMethods(env) {

    // We need to ensure that all methods that are accessed (called, stored,
    // etc.) are registered. If not, the first method with a unique signature
    // will be optimized with the "only method in the function table"
    // optimziation, causing it to be called directly. This is invalid, though,
    // because the order in which the methods are accessed does not guarantee
    // the order in which they will be used.

    var knownMethods = new Set();
    env.types.forEach(type => {
        if (!type.methods) return;

        for (var i of type.methods.values()) {
            knownMethods.add(i);
        }
    });

    env.included.forEach(ctx => {
        ctx.scope.iterate(node => {
            if (node instanceof hlirNodes.ObjectDeclarationHLIR && !node[symbols.IS_CONSTRUCTED]) return false;

            if (!(node instanceof hlirNodes.MemberHLIR)) return;

            var baseType = node.base.resolveType(ctx);
            if (!baseType.hasMethod || !baseType.hasMethod(node.child)) return;

            var funcNode = env.findFunctionByAssignedName(baseType.getMethod(node.child));

            if (!knownMethods.has(funcNode[symbols.ASSIGNED_NAME])) return;

            env.registerFunc(funcNode);
        });
    });

}


export default function generate(env, ENV_VARS) {

    registerAllUsedMethods(env);

    var body = '';

    // Include static modules
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/casting.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/funcref.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/gc.js')).toString();
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/heap.js')).toString();

    var asmMemoryMode = argv['asmjs-memory'] || 'chain';
    switch (asmMemoryMode) {
        case 'buddy':
        case 'chain':
            break;
        default:
            asmMemoryMode = 'chain';
    }
    body += fs.readFileSync(path.resolve(__dirname, '../../static/asmjs/memory-' + asmMemoryMode + '.js')).toString();

    // Translate and output each included context
    env.included.forEach(x => {
        body += jsTranslate(x) + '\n\n';
    });

    // Pre-define any string literals
    var registeredStringLiterals = Array.from(env.registeredStringLiterals.keys()).sort();
    if (registeredStringLiterals.length) {
        body += 'var initString = foreign.__initString;'
        body += registeredStringLiterals.map(str => 'var ' + env.registeredStringLiterals.get(str) + ' = 0;').join('\n');
    }

    if (env.inits.length || registeredStringLiterals.length) {
        body += '\nfunction $$init() {\n';
        body += '    ' + registeredStringLiterals.map(str => {
            var name = env.registeredStringLiterals.get(str);
            var out = name + ' = gcref(malloc(' + (str.length * 4 + 8) + ')|0)|0;\n    ';
            out += 'initString(' + name + '|0);'
            return out;
        }).join('\n    ') + '\n';
        body += '    ' + env.inits.map(init => init[symbols.ASSIGNED_NAME] + '();').join('\n    ') + '\n';
        body += '}\n';
        env.requested.exports['$$init'] = '$$init';
    }

    // Compile function list callers
    body += '\n' + Object.keys(env.funcList).map(function(flist) {
        if (env.funcList[flist].length === 1) return '';
        var funcList = env.funcList[flist];
        var funcType = env.funcListReverseTypeMap[flist];
        var paramList = funcType.args.map(function(param, i) {
            return '$param' + i;
        });

        var output = 'function ' + flist + '$$call($$ctx';

        if (paramList.length) {
            output += ', ';
            output += paramList.join(', ');
        }

        output += ') {\n';

        output += '    $$ctx = $$ctx | 0;\n';
        funcType.args.forEach(function(arg, i) {
            var base = '$param' + i;
            output += '    ' + base + ' = ' + typeAnnotation(base, arg) + ';\n';
        });

        output += '    var funcId = 0;\n';
        output += '    funcId = ptrheap[$$ctx >> 2];\n';
        output += '    var funcCtx = 0;\n';
        output += '    funcCtx = ptrheap[$$ctx + 4 >> 2];\n';

        var callBase = flist + '[funcId & ' + (funcList.length - 1) + ']';
        var rawCall = callBase + '(' + paramList.join(', ') + ')';
        output += '    if (!funcCtx) {\n';
        output += '        return ' + typeAnnotation(rawCall, funcType.returnType) + ';\n';
        output += '    }\n';

        var fullCall = callBase + '(funcCtx | 0' + (paramList.length ? ', ' + paramList.join(', ') : '') + ')';
        output += '    return ' + typeAnnotation(fullCall, funcType.returnType) + ';\n';

        output += '}';
        return output;

    }).join('\n');

    env.types.forEach(type => {
        if (type._type !== 'tuple') return;

        body += 'function makeTuple$' + type.flatTypeName() + '(' +
            type.contentsTypeArr.map((x, i) => 'm' + i).join(',') +
            ') {\n' +
            type.contentsTypeArr.map((x, i) => '    m' + i + ' = ' + typeAnnotation('m' + i, x) + ';\n').join('') +
            '    var x = 0;\n' +
            '    x = gcref(malloc(' + (type.getSize() + 8) + '|0)|0);\n' +
            type.contentsTypeArr.map((x, i) => {
                var typedArr = heapName(x);
                return '    ' + typedArr + '[x + ' + (type.getLayoutIndex(i) + 8) + HEAP_MODIFIERS[typedArr] + '] = ' +
                    typeAnnotation('m' + i, x) + ';\n';
            }).join('') +
            '    return x | 0;\n' +
            '}';
    });


    // Compile function lists
    env.funcList.forEach(flist => {
        if (flist.length === 1) return;
        body += '    var ' + flist + ' = [' + flist.join(',') + '];\n';
    });

    // Compile exports for the code.
    body += '\n    return {\n        ' +
        'malloc: malloc,\n        free: free,\n        calloc: calloc,\n        ' +
        Array.from(env.requested.exports.keys()).map(e => e + ': ' + env.requested.exports.get(e)).join(',\n        ') +
        '\n    };';

    body = postOptimizer(body);

    Object.keys(ENV_VARS).forEach(function(var_) {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
