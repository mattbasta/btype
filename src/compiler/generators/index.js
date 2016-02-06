import asmjsLib from './asmjs/generate';
import debugTreeLib from './debug-tree/generate';
import jsLib from './js/generate';
import llvmirLib from './llvmir/generate';

exports.asmjs = asmjsLib;
exports['debug-tree'] = debugTreeLib;
exports.js = jsLib;
exports.llvmir = llvmirLib;
