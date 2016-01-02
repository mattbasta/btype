import fs from 'fs';
import path from 'path';

var argv = require('minimist')(process.argv.slice(2));

import constantFold from './optimizer/constantFold';
import ErrorFormatter from '../errorFormatter';
import flatten from './flattener';
import globalInit from './globalInit';
import lexer from '../lexer';
import Module from './types/Module';
import NamerFactory from './namer';
import parser from '../parser';
import RootContext from './context';
import * as specialModules from './specialModules/__directory';
import * as symbols from '../symbols';
import transform from './transformer';


const LOWEST_ORDER = argv.minblocksize || 16;
const HEAP_SIZE = argv.heapsize || 64 * 1024 * 1024;

// Declare a set of project environment variables.
const ENV_VARS = {
    HEAP_SIZE: HEAP_SIZE,
    BUDDY_SPACE: HEAP_SIZE / LOWEST_ORDER / 4,  // 4 == sizeof(uint8) / 2 bits
    LOWEST_ORDER: LOWEST_ORDER,
};


export default class Environment {
    constructor(name, config) {
        this.name = name ? name.trim() : '';
        this.config = new Map();
        for (let k in config) {
            if (config.hasOwnProperty(k)) {
                this.config.set(k, config[k]);
            }
        }

        this.namer = NamerFactory();
        this.foreigns = [];
        this.included = new Set();
        this.requested = null;
        this.modules = new Map();
        this.inits = []; // Ordered list of things to initialize

        // Mapping of assigned type names to types
        this.typeMap = new Map();
        // Mapping of assigned type names to host contexts
        this.typeContextMap = new Map();
        // Set of types
        this.types = new Set();
        // Mapping of stringified constructed types to constructed types
        this.constructedTypeMap = new Map();

        // Mapping of module identifiers to the associated module types.
        this.moduleTypeMap = new Map();

        this.moduleCache = new Map();

        this.funcList = new Map();  // Mapping of func list assigned names to arrays of func assigned names
        this.funcListTypeMap = new Map();  // Mapping of serialized func types to names of func lists
        this.funcListReverseTypeMap = new Map();  // Mapping of func list assigned names to func types

        // Map of left type names to map of right type names to map of operators to
        // operator statement assigned names
        this.registeredOperators = new Map();
        // Map of operator statement assigned names to their return types
        this.registeredOperatorReturns = new Map();

        // Mapping of string literal text to a global name for the string
        this.registeredStringLiterals = new Map();
    }

    setConfig(name, value) {
        this.config.set(name, value);
    }

    getConfig(name) {
        return this.config.get(name);
    }


    loadFile(filename, tree = null, privileged = false, sourceCode = null) {
        if (this.moduleCache.has(filename)) {
            return this.moduleCache.get(filename);
        }

        var errorFormatter;

        if (!tree) {
            if (!sourceCode) {
                try {
                    sourceCode = fs.readFileSync(filename).toString();
                } catch (e) {
                    e.message = `Could not read source contents from "${filename}"\n${e.message}`;
                    throw e;
                }
            }

            errorFormatter = new ErrorFormatter(sourceCode.split(/\n/g));
            let lex = lexer(sourceCode);
            try {
                tree = parser(lexer(sourceCode));
            } catch (e) {
                this.formatError(e, errorFormatter);
                throw e;
            }
        } else if (sourceCode) {
            errorFormatter = new ErrorFormatter(sourceCode.split(/\n/g));
        }

        try {
            var rootNode = tree[symbols.FMAKEHLIR](this, privileged);
            var ctx = rootNode[symbols.CONTEXT];
            rootNode.settleTypes(ctx);
            // console.log('or', ctx.scope.toString());

            // Flatten lexical scope
            transform(ctx);
            // console.log('tf', ctx.scope.toString());
            // Flatten complex expressions
            flatten(ctx);
            // console.log('fl', ctx.scope.toString());

            // Move global statements to init functions.
            globalInit(ctx, this);
            // console.log('gi', ctx.scope.toString());

            // Perform constant folding.
            constantFold(ctx);
            // console.log('cf', ctx.scope.toString());
        } catch (e) {
            this.formatError(e, errorFormatter);
            throw e;
        }

        this.addContext(ctx);
        this.moduleCache.set(filename, ctx);
        return ctx;
    }

    formatError(e, errorFormatter) {
        if (!errorFormatter || !e[symbols.ERR_MSG]) {
            return;
        }
        if (typeof e[symbols.ERR_START] !== 'undefined') {
            e[symbols.ERR_LINE] = errorFormatter.getLine(e[symbols.ERR_START]);
            e[symbols.ERR_COL] = errorFormatter.getColumn(e[symbols.ERR_START]);
        }

        var snippet = errorFormatter.getVerboseError(
            e[symbols.ERR_LINE],
            e[symbols.ERR_COL]
        );
        e.message += `\n${snippet}\n`;
    }

    doImport(importNode, requestingContext) {
        var target;

        // TODO: Make this handle multiple levels of nesting.
        var baseDir = path.dirname(requestingContext.filename);
        target = path.resolve(baseDir, importNode.base);
        if (importNode.member) {
            target = path.resolve(target, importNode.member);
        }
        target += '.bt';

        var isStdlib = false;

        // Test to see whether the file exists in the project
        if (!fs.existsSync(target)) {
            // If not, try for the stdlib.
            target = path.resolve(__dirname, 'static', 'stdlib', importNode.base);
            if (importNode.member) {
                target = path.resolve(target, importNode.member);
            }
            target += '.bt';

            isStdlib = true;
        }

        // Test to see whether the file exists in the stdlib
        if (!fs.existsSync(target)) {
            if (importNode.member || !specialModules.isSpecialModule(importNode.base)) {
                throw new Error('Could not find imported module: ' + target);
            }
            // Handle the case of special modules
            let mod = specialModules.getConstructor(importNode.base).get(this);
            let modType = new Module(mod);
            this.moduleTypeMap.set(target, modType);
            return modType;
        }

        if (this.moduleTypeMap.has(target)) {
            return this.moduleTypeMap.get(target);
        }

        var importedContext = this.loadFile(target, null, isStdlib);
        var mod = new Module(importedContext);
        this.moduleTypeMap.set(target, mod);
        return mod;
    }

    addModule(module, context) {
        this.modules.set(module, context);
    }

    addContext(context) {
        this.included.add(context);
    }

    registerType(assignedName, type, context) {
        type[symbols.ASSIGNED_NAME] = assignedName || this.namer();
        this.typeMap.set(assignedName, type);
        this.typeContextMap.set(assignedName, context);
        this.types.add(type);
    }

    markRequested(context) {
        this.requested = context;
    }

    getFuncListName(funcType, noAdd) {
        var fts = funcType.toString();
        if (!this.funcListTypeMap.has(fts) && !noAdd) {
            let name = this.namer();
            this.funcListTypeMap.set(fts, name);
            this.funcListReverseTypeMap.set(name, funcType);
            this.funcList.set(name, []);
        }
        return this.funcListTypeMap.get(fts);
    }

    registerFunc(funcNode) {
        // If the function was already registered, return the cached index.
        if (symbols.FUNCLIST_IDX in funcNode) {
            return funcNode[symbols.FUNCLIST_IDX];
        }

        // Get the function's type and use that to determine the table.
        var ft = funcNode.resolveType(funcNode[symbols.CONTEXT]);
        var funcList = this.getFuncListName(ft);
        // If the table doesn't exist yet, create it.
        if (!this.funcList.has(funcList)) {
            this.funcList.set(funcList, []);
        }
        // Add the function's assigned name to the table.
        this.funcList.get(funcList).push(funcNode[symbols.ASSIGNED_NAME]);

        // Cache and return the function's index in the table.
        funcNode[symbols.FUNCLIST] = funcList;
        return funcNode[symbols.FUNCLIST_IDX] = this.funcList.get(funcList).length - 1;
    }

    addInit(stmt) {
        this.inits.push(stmt);
    }

    make(outputLanguage) {
        if (!this.requested) {
            throw new Error('No context was requested for export.');
        }

        return require('./generators/' + outputLanguage + '/generate').default(this, ENV_VARS);
    }

    findFunctionByAssignedName(assignedName) {
        var temp;
        for (var i of this.included) {
            if (temp = i.lookupFunctionByName(assignedName)) {
                return temp;
            }
        }
        return null;
    }

    getStrLiteralIdentifier(text) {
        if (this.registeredStringLiterals.has(text)) {
            return this.registeredStringLiterals.get(text);
        }
        var name = this.namer();
        this.registeredStringLiterals.set(text, name);
        return name;
    }

    getOverloadReturnType(leftType, rightType, operator) {
        var leftTypeName = leftType.flatTypeName();
        if (!this.registeredOperators.has(leftTypeName)) {
            return null;
        }
        var rightTypeName = rightType.flatTypeName();
        if (!this.registeredOperators.get(leftTypeName).has(rightTypeName)) {
            return null;
        }

        if (!this.registeredOperators.get(leftTypeName).get(rightTypeName).has(operator)) {
            return null;
        }

        var funcName = this.registeredOperators.get(leftTypeName).get(rightTypeName).get(operator);
        return this.registeredOperatorReturns.get(funcName);
    }

    setOverload(leftType, rightType, operator, assignedName, returnType, node) {
        var temp;

        var leftTypeName = leftType.flatTypeName();
        if (!this.registeredOperators.has(leftTypeName)) {
            this.registeredOperators.set(leftTypeName, new Map());
        }
        temp = this.registeredOperators.get(leftTypeName);

        var rightTypeName = rightType.flatTypeName();
        if (!temp.has(rightTypeName)) {
            temp.set(rightTypeName, new Map());
        }
        temp = temp.get(rightTypeName);

        if (temp.has(operator)) {
            throw node.TypeError(
                `Cannot redeclare operator overload for ${leftType.toString()} ${operator} ${rightType.toString()}`
            );
        }

        temp.set(operator, assignedName);
        this.registeredOperatorReturns.set(assignedName, returnType);
    }

};
