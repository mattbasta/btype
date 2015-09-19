const TOKENS = [
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
    [/^:/, ':'],  // For types
    [/^!/, '!'],
    [/^~/, '~'],

    // Reserved Words
    [/^=>/, 'reserved'],
    [/^catch(?!\w)/, 'reserved'],
    [/^default(?!\w)/, 'reserved'],
    [/^enum(?!\w)/, 'reserved'],
    [/^extends(?!\w)/, 'reserved'],
    [/^finally(?!\w)/, 'reserved'],
    [/^iter(?!\w)/, 'reserved'],
    [/^implements(?!\w)/, 'reserved'],
    [/^interface(?!\w)/, 'reserved'],
    [/^module(?!\w)/, 'reserved'],
    [/^raise(?!\w)/, 'reserved'],
    [/^static(?!\w)/, 'reserved'],
    [/^super(?!\w)/, 'reserved'],
    [/^switch(?!\w)/, 'switch'],
    [/^try(?!\w)/, 'reserved'],
    [/^typedef(?!\w)/, 'reserved'],
    [/^unittest(?!\w)/, 'reserved'],
    [/^with(?!\w)/, 'reserved'],
    [/^yield(?!\w)/, 'reserved'],

    // Keywords
    [/^and(?!\w)/, 'and'], // binary and
    [/^as(?!\w)/, 'as'], // typecasting
    [/^break(?!\w)/, 'break'], // loop break
    [/^case(?!\w)/, 'case'],
    [/^const(?!\w)/, 'const'], // constant variable declarations
    [/^continue(?!\w)/, 'continue'], // loop continue
    [/^do(?!\w)/, 'do'], // do loop
    [/^else(?!\w)/, 'else'], // if/else
    [/^export(?!\w)/, 'export'], // module export
    [/^false(?!\w)/, 'false'],
    [/^final(?!\w)/, 'final'], // final members/methods
    [/^for(?!\w)/, 'for'], // for loop
    [/^func(?!\w)/, 'func'], // function
    [/^if(?!\w)/, 'if'],
    [/^imm(?!\w)/, 'imm'], // immutability
    [/^import(?!\w)/, 'import'], // module import
    [/^new(?!\w)/, 'new'],
    [/^null(?!\w)/, 'null'],
    [/^object(?!\w)/, 'object'], // classes
    [/^operator(?!\w)/, 'operator'], // operator overloading
    [/^or(?!\w)/, 'or'], // binary or
    [/^private(?!\w)/, 'private'], // member/method visibility
    [/^return(?!\w)/, 'return'],
    [/^switchtype(?!\w)/, 'switchtype'],
    [/^true(?!\w)/, 'true'],
    [/^var(?!\w)/, 'var'], // type inference declaration
    [/^while(?!\w)/, 'while'], // while loop

    [/^[a-zA-Z_][\w_]*/, 'identifier'],
];


class Token {
    /**
     * @param {string} text  Text content of the token
     * @param {string} type  Token type
     * @param {int} start Start position of token
     * @param {int} end   End position of token
     * @param {int} line  Line number of token
     */
    constructor(text, type, start, end, line) {
        this.text = text;
        this.type = type;
        this.start = start;
        this.end = end;
        this.line = line;

        this.isToken = true;
    }

    /**
     * @return {string} Stringified version of the token
     */
    toString() {
        return '[token ' + this.type + ']';
    }
}


class Lexer {
    /**
     * @param {string} text Input data
     */
    constructor(text) {
        this.pointer = 0;
        this.remainingData = text;
        this.currentLine = 1;

        this.peeked = null;
    }

    /**
     * Returns the next token from the stream
     * @return {Token|null} The next token
     */
    readToken() {
        var match;
        var startPointer = this.pointer;
        for (var i = 0; i < TOKENS.length; i++) {
            if (!(match = TOKENS[i][0].exec(this.remainingData))) {
                continue;
            }
            if (match.index !== 0) {
                continue;
            }
            this.remainingData = this.remainingData.substr(match[0].length);
            this.currentLine += match[0].split(/(?:\r\n|\r|\n)/).length - 1;
            this.pointer += match[0].length;
            if (!TOKENS[i][1] || TOKENS[i][1] === 'comment') {
                i = -1;
                startPointer = this.pointer;
                continue;
            }
            return new Token(match[0], TOKENS[i][1], startPointer, this.pointer, this.currentLine);
        }
        return null;
    }

    /**
     * Gets the next token
     * @return {Token|string} The next token
     */
    next() {
        if (this.peeked !== null) {
            var tmp = this.peeked;
            this.peeked = null;
            return tmp;
        }

        if (!this.remainingData || !this.remainingData.trim()) return 'EOF';
        var token = this.readToken();
        if (!token) {
            if (!this.remainingData.trim()) return 'EOF';
            throw new SyntaxError('Unknown token at line ' + this.currentLine + ' near "' + this.remainingData.substr(0, 20) + '"');
        }
        return token;
    }

    /**
     * Peeks the next token without removing it from the stream
     * @return {Token}
     */
    peek() {
        if (this.peeked !== null) {
            return this.peeked;
        }
        var next = this.next();
        this.peeked = next;
        return next;
    }

    /**
     * If the next token matches the provided type, it is returned.
     * @param  {string} tokenType
     * @return {Token|null}
     */
    accept(tokenType) {
        var peeked = this.peek();
        if (peeked.type !== tokenType) {
            return null;
        }
        return this.next();
    }

    /**
     * Asserts that the next token is of the specified type and returns
     * the token.
     * @param  {string} tokenType
     * @return {Token}
     */
    assert(tokenType) {
        var next = this.next();
        if (next === 'EOF') {
            if (tokenType !== 'EOF') {
                throw new SyntaxError('Expected ' + tokenType + ' but reached the end of the file');
            }
        } else if (next.type !== tokenType) {
            throw new SyntaxError(
                'Unexpected token "' + next.type + '", expected "' + tokenType + '"' +
                ' at line ' + this.currentLine + ' near "' +
                this.remainingData.substr(0, 20) + '"');
        }
        return next;
    }

}


/**
 * Creates a new lexer
 * @param  {string} input
 * @return {Lexer}
 */
export default function lexer(input) {
    return new Lexer(input);
};

export {Token as token};
