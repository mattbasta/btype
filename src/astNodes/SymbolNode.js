import BaseExpressionNode from './BaseExpressionNode';
import SymbolHLIR from '../hlirNodes/SymbolHLIR';
import * as symbols from '../symbols';


export default class SymbolNode extends BaseExpressionNode {
    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

    get id() {
        return 30;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.name);
    }

    traverse(cb) {}

    toString() {
        return this.name;
    }


    [symbols.FMAKEHLIR](builder) {
        var node = new SymbolHLIR(this.name, this.start, this.end);

        var ctx = builder.peekCtx().lookupVar(this.name);
        node[symbols.REFCONTEXT] = ctx;
        var refName = ctx.nameMap.get(this.name);
        node[symbols.REFNAME] = refName;
        node[symbols.REFTYPE] = ctx.typeMap.get(refName);
        var isFunc = ctx.isFuncSet.has(refName);
        node[symbols.IS_FUNC] = isFunc;

        if (ctx === builder.rootCtx() && builder.contextStack.length > 1) {
            // If the context referenced is the global scope, mark the
            // context as accessing global scope.
            builder.peekCtx().accessesGlobalScope = true;

        } else if (ctx !== builder.peekCtx() && ctx !== builder.rootCtx()) {
            // Ignore calls from a nested function to itself (recursion)
            if (isFunc && refName === builder.peekCtx().scope[symbols.ASSIGNED_NAME]) {
                return;
            }

            // Otherwise the lookup is lexical and needs to be marked as such.
            for (var i = builder.contextStack.length - 1; i && builder.contextStack[i] !== ctx; i--) {
                builder.contextStack[i].accessesLexicalScope = true;
                builder.contextStack[i].lexicalLookups.set(refName, ctx);
            }
        }

        return node;
    }

};
