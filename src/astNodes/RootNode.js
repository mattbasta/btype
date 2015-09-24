import BaseBlockNode from './BaseBlockNode';
import {RootContext} from '../compiler/context';
import ContextBuilder from '../contextBuilder';
import RootHLIR from '../hlirNodes/RootHLIR';
import * as symbols from '../symbols';


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

    toString() {
        return this.body.map(e => e.toString()).join('');
    }

    [symbols.FMAKEHLIR](env, privileged) {
        var builder = new ContextBuilder(env, privileged);
        var rootHLIR = new RootHLIR(this.start, this.end);
        var rootCtx = new RootContext(env, rootHLIR, privileged);

        builder.pushCtx(rootCtx);
        rootHLIR.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));

        builder.processFuncs();

        builder.popCtx();

        builder.getOpOverloads().forEach(node => {
            var env = rootCtx.env;

            var leftType = node.left.resolveType(rootContext).flatTypeName();
            if (!env.registeredOperators.has(leftType)) {
                env.registeredOperators.set(leftType, new Map());
            }
            var rightType = node.right.resolveType(rootCtx).flatTypeName();
            if (!env.registeredOperators.get(leftType).has(rightType)) {
                env.registeredOperators.get(leftType).set(rightType, new Map());
            }

            var pair = env.registeredOperators.get(leftType).get(rightType);

            if (pair.has(node[symbols.ORIG_OPERATOR])) {
                throw new Error('Cannot redeclare operator overload for ' +
                    '`' + leftType + ' ' + node[symbols.ORIG_OPERATOR] + ' ' + rightType + '`');
            }

            pair.set(node[symbols.ORIG_OPERATOR], node[symbols.ASSIGNED_NAME]);
            env.registeredOperatorReturns.set(
                node[symbols.ASSIGNED_NAME],
                node.returnType.resolveType(rootCtx)
            );

        });

        return rootHLIR;
    }

};
