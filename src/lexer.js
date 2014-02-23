// The lexer.

var tokens = [
    [/^(?:\r\n|\r|\n)/, null],
    [/^\s+/, null],
    [/^"(?:\\(?:.|\r\n|\r|\n)|[^"\\\n])*"/i, 'string'],
    [/^'(?:\\(?:.|\r\n|\r|\n)|[^'\\\n])*'/i, 'string'],
    [/^#[^\n\r]*/i, 'comment'],
    // Floats must be matched before integers
    [/^[1-9][0-9]+\.[0-9]+/, 'float'],
    [/^0\.[0-9]+/, 'float'],
    [/^[1-9][0-9]+(?!\.)/, 'integer'],
    [/^;/, ';'],
    [/^,/, ','],
    [/^\{/, '{'],
    [/^\}/, '}'],
    [/^\[/, '['],
    [/^\]/, ']'],
    [/^\(/, '('],
    [/^\)/, ')'],
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

    [/^var(?!\w)/, 'var'],
    [/^switch(?!\w)/, 'switch'],
    [/^case(?!\w)/, 'case'],
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
    [/^return(?!\w)/, 'return'],

    [/^[a-zA-Z]\w*/, 'identifier'],
];

function Token(text, type, start, end) {
    this.text = text;
    this.type = type;
    this.start = start;
    this.end = end;
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
            currentLine += match[0].split(/(?:\r\n|\r|\n)/).length;
            pointer += match[0].length;
            if (!tokens[i][1]) {
                i = -1;
                continue;
            }
            return new Token(match[0], tokens[i][1], startPointer, pointer);
        }
        return null;
    }
    return function() {
        if (!remainingData) return 'EOF';
        var token = readToken();
        if (!token) {
            console.error('Syntax Error');
            console.error(remainingData);
            throw new SyntaxError('Unknown token at line ' + currentLine);
        }
        return token;
    };
};

module.exports.token = Token;
