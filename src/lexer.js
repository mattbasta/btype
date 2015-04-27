// The lexer.

var tokens = [
    [/^(?:\r\n|\r|\n)/, null],
    [/^\s+/, null],
    [/^"(?:\\(?:.|\r\n|\r|\n)|[^"\\\n])*"/i, 'str'],
    [/^'(?:\\(?:.|\r\n|\r|\n)|[^'\\\n])*'/i, 'str'],
    [/^#[^\n\r]*/i, 'comment'],
    // sfloat literals
    [/^\-?[1-9][0-9]*\.[0-9]+s/, 'sfloat'],
    [/^\-?0\.[0-9]+s/, 'sfloat'],
    // Floats must be matched before integers
    [/^\-?[1-9][0-9]*\.[0-9]+/, 'float'],
    [/^\-?0\.[0-9]+/, 'float'],
    [/^\-?[1-9][0-9]*(?!\.)/, 'int'],
    [/^0(?!\.)/, 'int'],
    [/^;/, ';'],
    [/^,/, ','],
    [/^\./, '.'],
    [/^\{/, '{'],
    [/^\}/, '}'],
    [/^\[:/, '[:'],
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

    // Reserved Words
    [/^catch(?!\w)/, 'reserved'],
    [/^enum(?!\w)/, 'reserved'],
    [/^extends(?!\w)/, 'reserved'],
    [/^finally(?!\w)/, 'reserved'],
    [/^implements(?!\w)/, 'reserved'],
    [/^interface(?!\w)/, 'reserved'],
    [/^module(?!\w)/, 'reserved'],
    [/^raise(?!\w)/, 'reserved'],
    [/^static(?!\w)/, 'reserved'],
    [/^super(?!\w)/, 'reserved'],
    [/^switchtype(?!\w)/, 'reserved'],
    [/^try(?!\w)/, 'reserved'],
    [/^typedef(?!\w)/, 'reserved'],
    [/^unittest(?!\w)/, 'reserved'],
    [/^yield(?!\w)/, 'reserved'],

    // Keywords
    [/^and(?!\w)/, 'and'],
    [/^as(?!\w)/, 'as'],
    [/^break(?!\w)/, 'break'],
    [/^case(?!\w)/, 'case'],
    [/^const(?!\w)/, 'const'],
    [/^continue(?!\w)/, 'continue'],
    [/^default(?!\w)/, 'default'],
    [/^do(?!\w)/, 'do'],
    [/^else(?!\w)/, 'else'],
    [/^export(?!\w)/, 'export'],
    [/^false(?!\w)/, 'false'],
    [/^final(?!\w)/, 'final'],
    [/^for(?!\w)/, 'for'],
    [/^func(?!\w)/, 'func'],
    [/^if(?!\w)/, 'if'],
    [/^import(?!\w)/, 'import'],
    [/^new(?!\w)/, 'new'],
    [/^null(?!\w)/, 'null'],
    [/^object(?!\w)/, 'object'],
    [/^operator(?!\w)/, 'operator'],
    [/^or(?!\w)/, 'or'],
    [/^private(?!\w)/, 'private'],
    [/^return(?!\w)/, 'return'],
    [/^switch(?!\w)/, 'switch'],
    [/^true(?!\w)/, 'true'],
    [/^var(?!\w)/, 'var'],
    [/^while(?!\w)/, 'while'],
    [/^with(?!\w)/, 'with'],

    [/^[a-zA-Z_][\w_]*/, 'identifier'],
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

module.exports = function Lexer(data) {
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
                startPointer = pointer;
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
