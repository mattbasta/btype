import Module from './types/Module';


const COMMON_FILENAME = Symbol('common');
const COMMON_CONTEXT = Symbol('common context');


const commonSource = `
object error {
    final str:message;
    final int:line;
    final int:column;
    final str:sourceFuncName;

    new(str:message, int:line, int:column, str:sourceFuncName) {
        self.message = message;
        self.line = line;
        self.column = column;
        self.sourceFuncName = sourceFuncName;
    }
}

export error;
`;


export function setupEnvironment(env) {
    const commonCtx = env.loadFile(
        COMMON_FILENAME, // filename
        null, // tree
        true, // privileged
        commonSource // sourceCode
    );
    env[COMMON_CONTEXT] = commonCtx;
};

export function setupContext(ctx) {
    const commonCtx = ctx.env[COMMON_CONTEXT];
    if (!commonCtx) {
        // This means that we're loading the file in the function above!
        return;
    }
    ctx.typeNameMap.set('error', commonCtx.exportPrototypes.get('error'));
};
