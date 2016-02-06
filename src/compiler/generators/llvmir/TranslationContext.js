export default class TranslationContext {
    constructor(env, ctx) {
        this.env = env;
        this.ctx = ctx;

        this.outputStack = [''];
        this.countStack = [0];
        this.indentation = '';
        this.loopStack = [];

        this.termToName = null;

        this.uniqCounter = 0;
    }

    /**
     * Pushes a level onto the stack
     * @return {void}
     */
    push() {
        this.outputStack.unshift('');
        this.countStack.unshift(0);
        this.indentation += '    ';
    }

    /**
     * Pushes a loop onto the loop stack
     * @param {string} start The label for the start of the loop
     * @param {string} exit The label to exit the loop
     * @return {void}
     */
    pushLoop(start, exit) {
        this.loopStack.unshift({start, exit});
    }

    /**
     * Pops a level from the output stack
     * @return {void}
     */
    pop() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
        this.termToName = null;
    }

    /**
     * Pops a loop from the loop stack
     * @return {void}
     */
    popLoop() {
        this.loopStack.shift();
    }

    /**
     * Writes a line to the output buffer
     * @param  {string} data The data to write
     * @param  {bool} [noIndent] Whether or not to indent
     * @return {void}
     */
    write(data, noIndent) {
        if (this.termToName !== null) {
            if (!noIndent) {
                this.outputStack[0] += this.termToName + '\n';
            }
            this.termToName = null;
        }

        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    }

    /**
     * Prepends a line to the output buffer
     * @param  {string} data The data to write
     * @param  {bool} [noIndent] Whether or not to indent
     * @return {void}
     */
    prepend(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    }

    /**
     * Returns the output of the buffer
     * @return {string}
     */
    toString() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in LLVM IR generator');
        }
        return this.outputStack[0];
    }

    /**
     * Gets the next available register number
     * @return {string}
     */
    getRegister() {
        return '%' + this.countStack[0]++;
    }

    /**
     * Generates a unique label name
     * @param  {string} [prefix] A name to prefixthe label with
     * @return {string}
     */
    getUniqueLabel(prefix) {
        return (prefix || 'lbl') + (this.uniqCounter++);
    }

    /**
     * Queues a label name to be output with the next written line or the end of
     * the current output buffer level
     * @param  {string} label The label to write
     * @return {void}
     */
    writeLabel(label) {
        this.termToName = label + ':';
    }

    /**
     * Writes the label to terminate the current output buffer level
     * @param  {string} [name] The prefix of the label
     * @return {void}
     */
    writeTerminatorLabel(name) {
        this.writeLabel(this.getUniqueLabel(name || 'term'));
    }
};
