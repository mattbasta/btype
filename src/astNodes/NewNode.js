import BaseExpressionNode from './BaseExpressionNode';
import NewHLIR from '../hlirNodes/NewHLIR';
import * as symbols from '../symbols';


export default class NewNode extends BaseExpressionNode {
    constructor(type, args, start, end) {
        super(start, end);

        this.type = type;
        this.args = args;
    }

    get id() {
        return 18;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.args.length, 32);
        this.type.pack(bitstr);
        this.args.forEach(a => a.pack(bitstr));
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.args.forEach(a => cb(a, 'args'));
    }

    toString() {
        return 'new ' + this.type.toString() + '(' +
            this.args.map(a => a.toString()).join(', ') + ')';
    }

    [symbols.FMAKEHLIR](builder) {
        return new NewHLIR(
            this.type[symbols.FMAKEHLIR](builder),
            // TODO: maybe pass expected argument types?
            this.args.map(a => a[symbols.FMAKEHLIR](builder)),
            this.start,
            this.end
        );
    }

};
