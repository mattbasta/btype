function TranslationContext(env, ctx) {
    this.env = env;
    this.ctx = ctx;

    this.outputStack = [''];
    this.countStack = [0];
    this.indentation = '';
    this.loopStack = [];

    this.termToName = null;

    this.uniqCounter = 0;

    this.push = function() {
        this.outputStack.unshift('');
        this.countStack.unshift(0);
        this.indentation += '    ';
    };

    this.pushLoop = function(startLabel, exitLabel) {
        this.loopStack.unshift({
            start: startLabel,
            exit: exitLabel,
        });
    };

    this.pop = function() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
        this.termToName = null;
    };

    this.popLoop = function(startLabel, exitLabel) {
        this.loopStack.shift();
    };

    this.write = function(data, noIndent) {
        if (this.termToName !== null) {
            if (!noIndent) {
                this.outputStack[0] += this.termToName + '\n';
            }
            this.termToName = null;
        }

        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    };

    this.prepend = function(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    };

    this.toString = function() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in LLVM IR generator');
        }
        return this.outputStack[0];
    };

    this.getRegister = function() {
        return '%' + this.countStack[0]++;
    };

    this.getUniqueLabel = function(prefix) {
        return (prefix || 'lbl') + (this.uniqCounter++);
    };

    this.writeLabel = function(label) {
        this.termToName = label + ':';
    };

    this.writeTerminatorLabel = function(name) {
        this.writeLabel(this.getUniqueLabel(name || 'term'));
    };
}

module.exports = TranslationContext;
