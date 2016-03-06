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
        const node = new ExportHLIR(this.value, this.start, this.end);
        const thisCtx = builder.peekCtx();

        if (!thisCtx.hasVar(this.value)) {
            if (!thisCtx.prototypes.has(this.value)) {
                throw new ReferenceError(`Undefined function or type "${this.value}" being exported`);
            }
            const refName = thisCtx.typeNameMap.get(this.value);
            node[symbols.ASSIGNED_NAME] = refName;
            thisCtx.exportPrototypes.set(this.value, refName);
            return node;
        }

        const varCtx = thisCtx.lookupVar(this.value);
        const refName = varCtx.nameMap.get(this.value);
        node[symbols.ASSIGNED_NAME] = refName;
        varCtx.exports.set(this.value, refName);

        return node;
    }

};
