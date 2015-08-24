import BaseStatementNode from './BaseStatementNode';
import ExportHLIR from '../hlirNodes/ExportHLIR';
import * as symbols from '../symbols';


export default class ExportNode extends BaseStatementNode {
    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    get id() {
        return 10;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.value);
    }

    traverse() {}

    toString() {
        return 'export ' + this.value.toString() + ';\n';
    }


    [symbols.FMAKEHLIR](builder) {
        var node = new ExportHLIR(this.value, this.start, this.end);

        var ctx;
        var refName;
        try {
            ctx = builder.peekCtx().lookupVar(this.value);
            refName = ctx.nameMap.get(this.value);
            node[symbols.ASSIGNED_NAME] = refName;
            ctx.exports.set(this.value, refName);
        } catch (e) {
            if (!builder.peekCtx().prototypes.has(this.value)) {
                throw new ReferenceError('Undefined function or type "' + this.value + '" being exported');
            }

            throw new Error('no idea if this works');
            node[symbols.ASSIGNED_NAME] = builder.peekCtx().exportPrototypes.set(this.value, refName);
        }

        return node;
    }

};
