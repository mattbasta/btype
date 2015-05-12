/**
 * @constructor
 * @param {Environment} env
 * @param {Context} ctx
 */
function TranslationContext(env, ctx) {
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
TranslationContext.prototype.push = function() {
    this.outputStack.unshift('');
    this.countStack.unshift(0);
    this.indentation += '    ';
};

/**
 * Pushes a loop onto the loop stack
 * @param {string} startLabel The label for the start of the loop
 * @param {string} exitLabel The label to exit the loop
 * @return {void}
 */
TranslationContext.prototype.pushLoop = function(startLabel, exitLabel) {
    this.loopStack.unshift({
        start: startLabel,
        exit: exitLabel,
    });
};

/**
 * Pops a level from the output stack
 * @return {void}
 */
TranslationContext.prototype.pop = function() {
    var popped = this.outputStack.shift();
    this.outputStack[0] += popped;
    this.countStack.shift();
    this.indentation = this.indentation.substr(4);
    this.termToName = null;
};

/**
 * Pops a loop from the loop stack
 * @return {void}
 */
TranslationContext.prototype.popLoop = function() {
    this.loopStack.shift();
};

/**
 * Writes a line to the output buffer
 * @param  {string} data The data to write
 * @param  {bool} [noIndent] Whether or not to indent
 * @return {void}
 */
TranslationContext.prototype.write = function(data, noIndent) {
    if (this.termToName !== null) {
        if (!noIndent) {
            this.outputStack[0] += this.termToName + '\n';
        }
        this.termToName = null;
    }

    this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
};

/**
 * Prepends a line to the output buffer
 * @param  {string} data The data to write
 * @param  {bool} [noIndent] Whether or not to indent
 * @return {void}
 */
TranslationContext.prototype.prepend = function(data, noIndent) {
    this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
};

/**
 * Returns the output of the buffer
 * @return {string}
 */
TranslationContext.prototype.toString = function() {
    if (this.outputStack.length > 1) {
        throw new Error('Leaking output in LLVM IR generator');
    }
    return this.outputStack[0];
};

/**
 * Gets the next available register number
 * @return {string}
 */
TranslationContext.prototype.getRegister = function() {
    return '%' + this.countStack[0]++;
};

/**
 * Generates a unique label name
 * @param  {string} [prefix] A name to prefixthe label with
 * @return {string}
 */
TranslationContext.prototype.getUniqueLabel = function(prefix) {
    return (prefix || 'lbl') + (this.uniqCounter++);
};

/**
 * Queues a label name to be output with the next written line or the end of
 * the current output buffer level
 * @param  {string} label The label to write
 * @return {void}
 */
TranslationContext.prototype.writeLabel = function(label) {
    this.termToName = label + ':';
};

/**
 * Writes the label to terminate the current output buffer level
 * @param  {string} [name] The prefix of the label
 * @return {void}
 */
TranslationContext.prototype.writeTerminatorLabel = function(name) {
    this.writeLabel(this.getUniqueLabel(name || 'term'));
};


module.exports = TranslationContext;
