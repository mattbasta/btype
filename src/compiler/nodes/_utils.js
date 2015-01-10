exports.ident = function ident(x) {return x;};

exports.indentEach = function indentEach(input, level) {
    level = level || 1;
    var indentation = '';
    while (level) {
        indentation += '    ';
        level--;
    }
    return input.split('\n').map(function(line) {
        return indentation + line;
    }).join('\n');
};
