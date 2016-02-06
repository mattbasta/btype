import BaseBlockNode from './BaseBlockNode';
import FunctionNode from './FunctionNode';
import * as symbols from '../symbols';


export default class ObjectConstructorNode extends BaseBlockNode {
    constructor(params, body, isFinal, start, end) {
        super(start, end);

        this.returnType = null;
        this.params = params;
        this.body = body;
        this.isFinal = isFinal;
    }

    get id() {
        return 19;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        bitstr.writebits(this.isFinal, 1);
        this.params.forEach(p => p.pack(bitstr));
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'new(' + this.params.map(p => p.toString()).join(', ') + ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        var node = FunctionNode.prototype[symbols.FMAKEHLIR].call(this, builder);
        node[symbols.IS_CONSTRUCTOR] = true;
        node[symbols.IS_FINAL] = this.isFinal;
        node[symbols.IS_METHOD] = true;
        var type = node.resolveType();
        type[symbols.IS_METHOD] = true;
        type.args[0][symbols.IS_SELF_PARAM] = true;
        return node;
    }

    [symbols.FCONSTRUCT](...args) {
        FunctionNode.prototype[symbols.FCONSTRUCT].apply(this, args);
    }

};
