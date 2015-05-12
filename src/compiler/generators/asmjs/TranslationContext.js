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

    this.uniqCounter = 0;

}

/**
 * Pushes a level onto the stack
 * @return {void}
 */
TranslationContext.prototype.push = function() {
    this.outputStack.unshift('');
    this.countStack.unshift(this.countStack[0]);
    this.indentation += '    ';
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
};

/**
 * Writes a line to the output buffer
 * @param  {string} data The data to write
 * @param  {bool} [noIndent] Whether or not to indent
 * @return {void}
 */
TranslationContext.prototype.write = function(data, noIndent) {
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
        throw new Error('Leaking output in asm.js generator');
    }
    return this.outputStack[0];
};


module.exports = TranslationContext;
