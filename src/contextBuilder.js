import * as symbols from './symbols';


export default class ContextBuilder {
    constructor(env, privileged) {
        this.env = env;
        this.privileged = privileged;

        this.contextStack = [];
        this.functionStack = [];
        this.opOverloads = new Set();
    }

    pushCtx(ctx) {
        this.contextStack.push(ctx);
        this.functionStack.push([]);
    }

    peekCtx() {
        return this.contextStack[this.contextStack.length - 1];
    }

    rootCtx() {
        return this.contextStack[0];
    }

    popCtx() {
        this.functionStack.pop();
        return this.contextStack.pop();
    }

    addFunc(astNode, hlirNode) {
        this.functionStack[this.functionStack.length - 1].push([astNode, hlirNode]);
    }

    getFuncs() {
        return this.functionStack[this.functionStack.length - 1];
    }

    addOpOverload(node) {
        var [left, right] = node.params;
        var rootCtx = this.contextStack[0];
        this.env.setOverload(
            left.resolveType(rootCtx),
            right.resolveType(rootCtx),
            node[symbols.ORIG_OPERATOR],
            node[symbols.ASSIGNED_NAME],
            node.returnType.resolveType(rootCtx)
        );
    }

    processFuncs() {
        this.getFuncs().forEach(f => {
            let [ast, hlir] = f;
            ast[symbols.FCONSTRUCT](this, hlir);
        });
    }

};
