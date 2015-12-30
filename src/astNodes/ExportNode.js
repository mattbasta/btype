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
        var thisCtx = builder.peekCtx();

        if (!thisCtx.hasVar(this.value)) {
            if (!thisCtx.prototypes.has(this.value)) {
                throw new ReferenceError(`Undefined function or type "${this.value}" being exported`);
            }
            let refName = thisCtx.typeNameMap.get(this.value);
            node[symbols.ASSIGNED_NAME] = thisCtx.exportPrototypes.set(this.value, refName);
            return node;
        }

        var varCtx = thisCtx.lookupVar(this.value);
        let refName = varCtx.nameMap.get(this.value);
        node[symbols.ASSIGNED_NAME] = refName;
        varCtx.exports.set(this.value, refName);

        return node;
    }

};
