export default class TranslationContext {
    /**
     * @constructor
     * @param {Environment} env
     * @param {Context} ctx
     */
    constructor(env, ctx) {
        this.env = env;
        this.ctx = ctx;

        this.outputStack = [''];
        this.countStack = [0];
        this.indentation = '';

        this.uniqCounter = 0;
    }

    /**
     * Pushes a level onto the stack
     * @return {void}
     */
    push() {
        this.outputStack.unshift('');
        this.countStack.unshift(this.countStack[0]);
        this.indentation += '    ';
    };

    /**
     * Pops a level from the output stack
     * @return {void}
     */
    pop() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
    };

    /**
     * Writes a line to the output buffer
     * @param  {string} data The data to write
     * @param  {bool} [noIndent] Whether or not to indent
     * @return {void}
     */
    write(data, noIndent) {
        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    };

    /**
     * If there is a trailing semicolon in the current level of the output buffer,
     * it will automatically be trimmed
     * @return {void}
     */
    trimSemicolon() {
        var stack = this.outputStack[0].trim();
        var last = stack[stack.length - 1];
        if (last === ';') {
            this.outputStack[0] = stack.substr(0, stack.length - 1);
        }
    };

    /**
     * Prepends a line to the output buffer
     * @param  {string} data The data to write
     * @param  {bool} [noIndent] Whether or not to indent
     * @return {void}
     */
    prepend(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    };

    /**
     * Returns the output of the buffer
     * @return {string}
     */
    toString() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in js generator');
        }
        return this.outputStack[0];
    };
};
