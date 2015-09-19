import AssignmentHLIR from '../hlirNodes/AssignmentHLIR';
import CallStatementHLIR from '../hlirNodes/CallStatementHLIR';
import DoWhileHLIR from '../hlirNodes/DoWhileHLIR';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import IfHLIR from '../hlirNodes/IfHLIR';
import LiteralHLIR from '../hlirNodes/LiteralHLIR';
import LoopHLIR from '../hlirNodes/LoopHLIR';
import ObjectDeclarationHLIR from '../hlirNodes/ObjectDeclarationHLIR';
import SymbolHLIR from '../hlirNodes/SymbolHLIR';
import * as context from './context';
import * as symbols from '../symbols';

/*
This file is responsible for taking all global-scoped non-declaration
statements and moving them into a function that gets executed at module
initialization.
*/


export default function globalInit(ctx, env) {
    var body = ctx.scope.body;

    var prefixes = [];
    var initables = [];

    // First uplift all of the declarations to the top level.
    ctx.scope.iterateBodies(body => {
        for (var i = 0; i < body.length; i++) {
            let current = body[i];

            if (current.type !== 'Declaration') {
                continue;
            }

            if (current.value instanceof LiteralHLIR || current.value.litType === 'str') {
                var value = current.value;
                current.value = new LiteralHLIR('null', null);

                var sym = new SymbolHLIR(current.identifier);
                sym[symbols.REFCONTEXT] = ctx;
                sym[symbols.REFTYPE] = current.resolveType(ctx);
                sym[symbols.REFNAME] = current[symbols.ASSIGNED_NAME];
                var newNode = new AssignmentHLIR(sym, value);
                body.splice(i, 1, newNode);
                prefixes.push(current);

            } else {
                body.splice(i, 1);
                prefixes.push(current);
            }

            i--;

        }
    }, node => {
        return !(node instanceof FunctionHLIR ||
                 node instanceof ObjectDeclarationHLIR);
    });

    // Next, move all of the top-level statements that are not declarations
    // into the initables array.
    for (var i = 0; i < ctx.scope.body.length; i++) {
        let current = ctx.scope.body[i];
        let cType = current.type;

        if (cType instanceof AssignmentHLIR ||
            cType instanceof CallStatementHLIR ||
            cType instanceof DoWhileHLIR ||
            cType instanceof LoopHLIR ||
            cType instanceof IfHLIR) {

            initables.push(current);
            ctx.scope.body.splice(i, 1);
            i--;
            continue;
        }
    }

    if (prefixes.length) {
        ctx.scope.body.splice.apply(ctx.scope.body, [0, 0].concat(prefixes));
    }

    if (initables.length) {
        var initFunc = new FunctionHLIR(null, '$init', [], 0, 0);
        initFunc.setBody(initables);
        ctx.scope.body.push(initFunc);

        ctx.function.add(initFunc);
        var assignedName = ctx.addVar(initFunc.name, initFunc.resolveType(ctx));
        ctx.functionDeclarations.set(assignedName, initFunc);
        ctx.isFuncSet.add(assignedName);
        initFunc[symbols.IS_FIRSTCLASS] = false;

        var newCtx = new context.Context(ctx.env, initFunc, ctx, ctx.isPrivileged);
        // newCtx should automatically bind itself to the node

        env.addInit(initFunc);
    }

};
