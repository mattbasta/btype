// The lexer.

var tokens = [
    [/^(?:\r\n|\r|\n)/, null],
    [/^\s+/, null],
    [/^"(?:\\(?:.|\r\n|\r|\n)|[^"\\\n])*"/i, 'string'],
    [/^'(?:\\(?:.|\r\n|\r|\n)|[^'\\\n])*'/i, 'string'],
    [/^#[^\n\r]*/i, 'comment'],
    [/^[1-9][0-9]+/i, 'integer'],
    [/^[1-9][0-9]+\.[0-9]+/i, 'float'],
    [/^0\.[0-9]+/i, 'float'],
    [/^;/, ';'],
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

    [/^var(?!\w)/, 'var'],
    [/^return(?!\w)/, 'return'],
    [/^switch(?!\w)/, 'switch'],
    [/^case(?!\w)/, 'case'],
    [/^while(?!\w)/, 'while'],
    [/^if(?!\w)/, 'if'],
    [/^else(?!\w)/, 'else'],
    [/^true(?!\w)/, 'true'],
    [/^false(?!\w)/, 'false'],
    [/^for(?!\w)/, 'for'],
    [/^null(?!\w)/, 'null'],
    [/^continue(?!\w)/, 'continue'],
    [/^break(?!\w)/, 'break'],
    [/^or(?!\w)/, 'or'],
    [/^and(?!\w)/, 'and'],
    [/^func(?!\w)/, 'func'],

    [/^[a-zA-Z]\w*/, 'identifier'],
];

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
            return {
                text: match[0],
                type: tokens[i][1],
                start: startPointer,
                end: pointer
            };
        }
        return null;
    }
    return function() {
        if (!remainingData) return 'EOF';
        var token = readToken();
        if (!token) {
            console.error('Syntax Error');
            throw new SyntaxError('Unknown token at line ' + currentLine);
        }
        return token;
    };
};

