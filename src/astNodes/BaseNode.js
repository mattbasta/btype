
export default class BaseNode {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }

    traverse() {
        throw new Error('Not implemented');
    }

    substitute() {
        throw new Error('Not implemented');
    }

    toString() {
        return 'Unknown Node';
    }

    _indent(input, level) {
        level = level || 1;
        var indentation = '';
        while (level) {
            indentation += '    ';
            level--;
        }
        return input.split('\n').map(function(line) {
            return indentation + line;
        }).join('\n');
    }
};
