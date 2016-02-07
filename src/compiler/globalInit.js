import {Context} from './context';
import * as hlirNodes from '../hlirNodes';
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

            if (current.value instanceof hlirNodes.LiteralHLIR ||
                current.value.litType === 'str') {

                var value = current.value;
                current.value = new hlirNodes.LiteralHLIR('null', null);

                var sym = new hlirNodes.SymbolHLIR(current.name);
                sym[symbols.REFCONTEXT] = ctx;
                sym[symbols.REFTYPE] = current.resolveType(ctx);
                sym[symbols.REFNAME] = current[symbols.ASSIGNED_NAME];
                var newNode = new hlirNodes.AssignmentHLIR(sym, value);
                body.splice(i, 1, newNode);
                prefixes.push(current);

            } else {
                body.splice(i, 1);
                prefixes.push(current);
            }

            i--;

        }
    }, node => {
        return !(node instanceof hlirNodes.FunctionHLIR ||
                 node instanceof hlirNodes.ObjectDeclarationHLIR);
    });

    // Next, move all of the top-level statements that are not declarations
    // into the initables array.
    for (var i = 0; i < ctx.scope.body.length; i++) {
        let current = ctx.scope.body[i];

        if (current instanceof hlirNodes.AssignmentHLIR ||
            current instanceof hlirNodes.CallStatementHLIR ||
            current instanceof hlirNodes.LoopHLIR ||
            current instanceof hlirNodes.IfHLIR) {
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
        var initFunc = new hlirNodes.FunctionHLIR(null, '$init', [], 0, 0);
        initFunc.setBody(initables);
        ctx.scope.body.push(initFunc);

        ctx.functions.add(initFunc);
        var assignedName = ctx.addVar(initFunc.name, initFunc.resolveType(ctx));
        initFunc[symbols.ASSIGNED_NAME] = assignedName;
        ctx.functionDeclarations.set(assignedName, initFunc);
        ctx.isFuncSet.add(assignedName);
        initFunc[symbols.IS_FIRSTCLASS] = false;

        var newCtx = new Context(ctx.env, initFunc, ctx, ctx.isPrivileged);
        // newCtx should automatically bind itself to the node

        env.addInit(initFunc);
    }

};
