import BaseBlockNode from './BaseBlockNode';
import * as symbols from '../symbols';


export default class SwitchTypeCaseNode extends BaseBlockNode {
    constructor(type, body, start, end) {
        super(start, end);
        this.type = type;
        this.body = body;
    }

    get id() {
        return 28;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.type.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.body.forEach(a => cb(a, 'body'));
    }

    toString() {
        return 'case ' + this.type.toString() + ' {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder, expectedType) {
        var type = this.type[symbols.FMAKEHLIR](builder).resolveType(builder.peekCtx());
        if (!type.equals(expectedType)) {
            return [];
        }
        return this[symbols.FMAKEHLIRBLOCK](builder, this.body);
    }
};
