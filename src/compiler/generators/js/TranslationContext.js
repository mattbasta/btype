function TranslationContext(env, ctx) {
    this.env = env;
    this.ctx = ctx;

    this.outputStack = [''];
    this.countStack = [0];
    this.indentation = '';

    this.uniqCounter = 0;

    this.push = function() {
        this.outputStack.unshift('');
        this.countStack.unshift(this.countStack[0]);
        this.indentation += '    ';
    };

    this.pop = function() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
    };

    this.write = function(data, noIndent) {
        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    };

    this.trimSemicolon = function() {
        var stack = this.outputStack[0].trim();
        var last = stack[stack.length - 1];
        if (last === ';') {
            this.outputStack[0] = stack.substr(0, stack.length - 2);
        }
    };

    this.prepend = function(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    };

    this.toString = function() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in asm.js generator');
        }
        return this.outputStack[0];
    };

}

module.exports = TranslationContext;
