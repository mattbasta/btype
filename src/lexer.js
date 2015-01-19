// The lexer.

var tokens = [
    [/^(?:\r\n|\r|\n)/, null],
    [/^\s+/, null],
    [/^"(?:\\(?:.|\r\n|\r|\n)|[^"\\\n])*"/i, 'str'],
    [/^'(?:\\(?:.|\r\n|\r|\n)|[^'\\\n])*'/i, 'str'],
    [/^#[^\n\r]*/i, 'comment'],
    // Floats must be matched before integers
    [/^[1-9][0-9]*\.[0-9]+/, 'float'],
    [/^0\.[0-9]+/, 'float'],
    [/^[1-9][0-9]*(?!\.)/, 'int'],
    [/^0(?!\.)/, 'int'],
    [/^;/, ';'],
    [/^,/, ','],
    [/^\./, '.'],
    [/^\{/, '{'],
    [/^\}/, '}'],
    [/^\[/, '['],
    [/^\]/, ']'],
    [/^\(/, '('],
    [/^\)/, ')'],

    // Bitwise operators
    [/^\|/, '|'],
    [/^&/, '&'],
    [/^\^/, '^'],
    [/^<</, '<<'],
    [/^>>/, '>>'],

    [/^\+/, '+'],
    [/^\-/, '-'],
    [/^\//, '/'],
    [/^\*/, '*'],
    [/^%/, '%'],
    [/^==/, '=='],
    [/^!=/, '!='],
    [/^<=/, '<='],
    [/^>=/, '>='],
    [/^=/, '='],
    [/^</, '<'],
    [/^>/, '>'],
    [/^:/, ':'],  // For `case` and types
    [/^!/, '!'],
    [/^~/, '~'],

    [/^const(?!\w)/, 'const'],
    [/^var(?!\w)/, 'var'],
    [/^as(?!\w)/, 'as'],
    [/^switch(?!\w)/, 'switch'],
    [/^case(?!\w)/, 'case'],
    [/^default(?!\w)/, 'default'],
    [/^do(?!\w)/, 'do'],
    [/^while(?!\w)/, 'while'],
    [/^if(?!\w)/, 'if'],
    [/^else(?!\w)/, 'else'],
    [/^true(?!\w)/, 'true'],
    [/^false(?!\w)/, 'false'],
    [/^null(?!\w)/, 'null'],
    [/^for(?!\w)/, 'for'],
    [/^continue(?!\w)/, 'continue'],
    [/^break(?!\w)/, 'break'],
    [/^or(?!\w)/, 'or'],
    [/^and(?!\w)/, 'and'],
    [/^func(?!\w)/, 'func'],
    [/^new(?!\w)/, 'new'],
    [/^return(?!\w)/, 'return'],
    [/^import(?!\w)/, 'import'],
    [/^export(?!\w)/, 'export'],
    [/^operator(?!\w)/, 'operator'],
    [/^object(?!\w)/, 'object'],

    [/^[a-zA-Z_][\w\-_]*/, 'identifier'],
];

function Token(text, type, start, end, line) {
    this.text = text;
    this.type = type;
    this.start = start;
    this.end = end;
    this.line = line;
}
Token.prototype.isToken = true;
Token.prototype.toString = function() {
    return '[token ' + this.type + ']';
};

module.exports = function(data) {
    var pointer = 0;
    var remainingData = data;
    var currentLine = 1;

    function readToken() {
        var match;
        var startPointer = pointer;
        for (var i = 0; i < tokens.length; i++) {
            if (!(match = tokens[i][0].exec(remainingData))) {
                continue;
            }
            remainingData = remainingData.substr(match[0].length);
            currentLine += match[0].split(/(?:\r\n|\r|\n)/).length - 1;
            outbound.currentLine = currentLine;
            pointer += match[0].length;
            if (!tokens[i][1] || tokens[i][1] === 'comment') {
                i = -1;
                continue;
            }
            return new Token(match[0], tokens[i][1], startPointer, pointer, currentLine);
        }
        return null;
    }
    var outbound = function lexerIterator() {
        if (!remainingData.trim()) return 'EOF';
        var token = readToken();
        if (!token) {
            if (!remainingData.trim()) return 'EOF';
            throw new SyntaxError('Unknown token at line ' + currentLine + ' near "' + remainingData.substr(0, 20) + '"');
        }
        return token;
    };
    outbound.currentLine = currentLine;
    return outbound;
};

module.exports.token = Token;
