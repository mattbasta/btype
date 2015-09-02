import BaseStatementNode from './BaseStatementNode';
import AssignmentHLIR from '../hlirNodes/AssignmentHLIR';
import MemberHLIR from '../hlirNodes/MemberHLIR';
import CallHLIR from '../hlirNodes/CallHLIR';
import SubscriptHLIR from '../hlirNodes/SubscriptHLIR';
import SymbolHLIR from '../hlirNodes/SymbolHLIR';
import * as symbols from '../symbols';


const HAS_SIDEEFFECTS = Symbol();


export default class AssignmentNode extends BaseStatementNode {
    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    get id() {
        return 1;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        this.value.pack(bitstr);
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.value, 'value');
    }

    toString() {
        return this.base.toString() + ' = ' + this.value.toString() + ';';
    }

    [symbols.FMAKEHLIR](builder) {
        var baseNode = this.base[symbols.FMAKEHLIR](builder);

        if (baseNode instanceof SymbolHLIR &&
            baseNode[symbols.REFCONTEXT].isFuncSet.has(baseNode[symbols.REFNAME])) {
            throw new TypeError('Cannot assign values to function declarations');
        }

        var baseType = baseNode.resolveType(builder.peekCtx());
        if (builder.peekCtx().sideEffectFree) {
            this[HAS_SIDEEFFECTS](builder, baseType);
        }

        var valueNode = this.value[symbols.FMAKEHLIR](builder, baseType);

        return new AssignmentHLIR(baseNode, valueNode, this.start, this.end);
    }

    [HAS_SIDEEFFECTS](builder, baseNode) {
        function follow(node, called) {
            if (node instanceof SymbolHLIR) {
                if (!called &&
                    node[symbols.REFCONTEXT] !== builder.rootCtx() &&
                    node[symbols.REFCONTEXT] !== builder.peekCtx()) {
                    var i = builder.contextStack.length - 1;
                    while (builder.contextStack[i] &&
                           builder.contextStack[i] !== node[symbols.REFCONTEXT]) {
                        builder.contextStack[i].lexicalModifications.add(node[symbols.REFNAME]);
                        builder.contextStack[i].sideEffectFree = false;
                        i--;
                    }
                }
                return true;
            }

            if (node instanceof MemberHLIR) {
                return follow(node.base, called);
            }

            if (node instanceof SubscriptHLIR) {
                return follow(node.base, called);
            }

            if (node instanceof CallHLIR) {
                return follow(node.callee, true);
            }
        }
        var hasSideEffects = follow(baseNode);

        if (hasSideEffects) {
            builder.peekCtx().sideEffectFree = false;
        }
    }
};
