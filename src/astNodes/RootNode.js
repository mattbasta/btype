import BaseBlockNode from './BaseBlockNode';
import RootContext from '../compiler/context';


export default class RootNode extends BaseBlockNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    get id() {
        return 26;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        this.body.forEach(e => {
            cb(e, 'body');
        });
    }

    /**
     * Builds a context object for the AST tree
     * @param  {Environment} env
     * @param  {bool} [privileged]
     * @return {BaseCotnext}
     */
    buildContext(env, privileged) {
        var root = new RootContext(env, this, privileged || false);
        return root;
    }

    toString() {
        return this.body.map(e => e.toString()).join('') + '\n# EOF\n';
    }
};
