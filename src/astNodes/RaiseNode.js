import BaseStatementNode from './BaseStatementNode';
import {LiteralHLIR, NewHLIR, RaiseHLIR, TypeHLIR} from '../hlirNodes';
import {ObjectConstructorNode, ObjectOperatorStatementNode, OperatorStatementNode} from '../astNodes';
import String_ from '../compiler/types/String';
import * as symbols from '../symbols';


export default class RaiseNode extends BaseStatementNode {
    constructor(expr, start, end) {
        super(start, end);
        this.expr = expr;
    }

    get id() {
        return 40;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.expr.pack(bitstr);
    }

    traverse(cb) {
        cb(this.expr);
    }

    toString() {
        return `raise ${this.expr};\n`;
    }


    [symbols.FMAKEHLIR](builder) {
        const exprHLIR = this.expr[symbols.FMAKEHLIR](builder);
        const exprHLIRType = exprHLIR.resolveType(builder.peekCtx());
        if (!(exprHLIRType instanceof String_)) {
            throw this.TypeError(`Attempted to raise ${exprHLIRType} but only strings can be raised.`);
        }

        const newExpr = new NewHLIR(
            new TypeHLIR('error'), // TODO: make this somehow resolve to the global error object
            [
                exprHLIR,
                new LiteralHLIR('int', builder.errorFormatter.getLine(this.start)),
                new LiteralHLIR('int', builder.errorFormatter.getColumn(this.start)),
                new LiteralHLIR('str', this.getScopeName(builder.peekCtx().scope)),
            ]
        );

        return new RaiseHLIR(newExpr, this.start, this.end);
    }

    getScopeName(scope) {
        if (scope instanceof ObjectOperatorStatementNode || scope instanceof OperatorStatementNode) {
            return `operator (${scope.left} ${scope.operator} ${scope.right})`;
        }
        if (scope instanceof ObjectConstructorNode) {
            return `new`;
        }
        if (!scope.name) {
            throw new Error(`Missing scope name on ${scope.constructor.name}`);
        }
        return scope.name;
    }

};
