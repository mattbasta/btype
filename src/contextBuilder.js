export default class ContextBuilder {
    constructor(env, privileged) {
        this.env = env;
        this.privileged = privileged;

        this.contextStack = [];
        this.functionStack = [];
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

};
