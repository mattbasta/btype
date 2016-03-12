import fs from 'fs';
import path from 'path';

import * as hlirNodes from '../../../hlirNodes';
import externalFuncs from '../js/externalFuncs';
import jsTranslate from './translate';
import {HEAP_MODIFIERS, heapName, typeAnnotation} from './translate';
import {optimize as postOptimizer} from '../js/postOptimizer';
import * as symbols from '../../../symbols';

var argv = require('minimist')(process.argv.slice(2));


function nextPowerOfTwo(n) {
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
        'var heap = new ArrayBuffer(' + nextPowerOfTwo(ENV_VARS.HEAP_SIZE + ENV_VARS.BUDDY_SPACE) + ');',
        // Shim imul if it doesn't exist (*COUGH* NODE *COUGH*)
        'this.Math.imul = this.Math.imul || function imul(a, b) {return (a | 0) * (b | 0) | 0;};',
        // Shim fround in the same way
        'var f32_ = new Float32Array(1);',
        'this.Math.fround = this.Math.fround || function fround(x) {return f32[0] = x, f32[0];};',
        // String literal initialization
        'var strings = [' +
            Array.from(env.registeredStringLiterals.keys()).sort().map(s => JSON.stringify(s)).join(', ') +
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
        'function BTAsmError(stackPtr, message, line, column, sourceFuncName) {',
        '    this.stackPtr = stackPtr;',
        '    this.message = message;',
        '    this.line = line;',
        '    this.column = column;',
        '    this.sourceFuncName = sourceFuncName;',
        '}',
        'function throwErr(err, message, line, column, sourceFuncName) {',
        '    throw new BTAsmError(err, readString(message), line, column, readString(sourceFuncName));',
        '}',
        // Get an instance of the asm module, passing in all of the externally requested items
        'var ret = module(this, {__initString: initString, throwErr: throwErr,' +
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
        '$internal: {heap: heap, malloc: ret.malloc, free: ret.free, calloc: ret.calloc},',
        '$strings: {read: readString},',
        Array.from(env.requested.exports.keys())
            .filter(e => e !== '$$init')
            .map(e => `${e}: ret.${e}`)
            .join(',\n'),
        '};',
        // Declare the asm module
        '}).call(typeof global !== "undefined" ? global : this, function module_(stdlib, foreign, heap) {',
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

    if (env.inits.length || env.registeredStringLiterals.size) {
        let registeredStringLiterals = Array.from(env.registeredStringLiterals.keys()).sort();
        if (registeredStringLiterals.length) {
            body += 'var initString = foreign.__initString;\n';
            registeredStringLiterals.forEach(str => body += `var ${env.registeredStringLiterals.get(str)} = 0;\n`);
        }
        body += '\nfunction $$init() {\n';
        registeredStringLiterals.forEach(str => {
            var name = env.registeredStringLiterals.get(str);
            body += `    ${name} = gcref(malloc(${str.length * 4 + 8})|0)|0;\n    initString(${name}|0);\n`;
        });
        body += env.inits.map(init => `    ${init[symbols.ASSIGNED_NAME]}();\n`).join();
        body += '}\n';
        env.requested.exports.set('$$init', '$$init');
    }

    env.types.forEach(type => {
        if (type._type !== 'tuple') return;
        body += `function makeTuple$${type.flatTypeName()}(${type.contentsTypeArr.map((x, i) => 'm' + i).join(',')}) {
            ${type.contentsTypeArr.map((x, i) => `m${i} = ${typeAnnotation(`m${i}`, x)};`).join('\n    ')}
            var x = 0;
            x = gcref(malloc(${type.getSize() + 8} | 0) | 0);
            ${type.contentsTypeArr.map((x, i) => {
                var typedArr = heapName(x);
                var subscript = `x + ${(type.getLayoutIndex(i) + 8) + HEAP_MODIFIERS[typedArr]}`;
                return `${typedArr}[${subscript}] = ${typeAnnotation(`m${i}`, x)};`;
            }).join('\n    ')}
            return x | 0;
        }`;
    });

    // Compile function lists
    env.funcList.forEach((flist, name) => {
        var type = env.funcListReverseTypeMap.get(name);

        // If this is a function list for functions with a context param and
        // another function list exists for the same signature without a
        // context param, just skip this one. The other will always be
        // preferred.
        if (type.args.length &&
            (type.args[0][symbols.IS_CTX_OBJ] || type.args[0][symbols.IS_SELF_PARAM])) {
            let ctxlessType = type.clone();
            ctxlessType.args.splice(0, 1);
            if (env.funcListTypeMap.has(ctxlessType.flatTypeName(true))) {
                return;
            } else {
                type = type.clone();
                type.args.splice(0, 1);
            }
        }

        var contextedSignatureType = type.clone();
        contextedSignatureType.args.unshift({
            [symbols.IS_CTX_OBJ]: true,
            flatTypeName: () => 'ptr',
        });
        var contextedSignatureFlistName = env.getFuncListName(contextedSignatureType);

        var arglist = type.args.map((_, i) => '_' + i).join(', ');

        var flistSize = nextPowerOfTwo(flist.length) - 1;

        body += `
        function calldyn${name}(
            ptr
            ${arglist ? ', ' + arglist : ''}
        ) {
            ptr = ptr | 0;
            ${type.args.map((t, i) => `_${i} = ${typeAnnotation('_' + i, t)};`).join('\n    ')}
            var funcIdx = 0;
            var ctxPtr = 0;
            funcIdx = ptrheap[ptr + 8 >> 2] | 0;
            ctxPtr = ptrheap[ptr + 12 >> 2] | 0;
            if (!ctxPtr) {
                return ${name}[funcIdx & ${flistSize}](${arglist});
            } else {
                return ${contextedSignatureFlistName}[funcIdx & ${flistSize}](ctxPtr${arglist ? ', ' + arglist : ''});
            }
        }\n`;
    });
    env.funcList.forEach((flist, name) => {
        body += `    var ${name} = [${flist.join(',')}];\n`;
    });

    // Compile exports for the code.
    body += `
    return {
        malloc: malloc,
        free: free,
        calloc: calloc,
        ${Array.from(env.requested.exports).map(([key, value]) => `${key}: ${value},`).join('\n        ')}
    };`;

    body = postOptimizer(body);

    Object.keys(ENV_VARS).forEach(var_ => {
        body = body.replace(new RegExp(var_, 'g'), ENV_VARS[var_].toString());
    });

    return makeModule(env, ENV_VARS, body);
};
