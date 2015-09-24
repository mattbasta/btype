import assert from 'assert';

import lexer from '../src/lexer';


function justTokens(lex) {
    var token;
    var output = [];
    while ((token = lex.next()) !== 'EOF') {
        output.push(token.text);
    }
    return output;
}

function tokensOfType(token, type) {
    var token = lexer(token).next();
    assert.equal(token.type, type);
}

function matches(input) {
    var tokens = justTokens(lexer(input));
    assert.equal(input, tokens.join(' '));
}

describe('Lexer', function() {

    describe('peek()', function() {

        it('should show the first matched token', function() {
            var lex = lexer('true false false');
            assert.equal(lex.peek().type, 'true');
            assert.equal(lex.peek().type, 'true');
            assert.equal(lex.peek().type, 'true');

        });

        it('should be cleared on next()', function() {
            var lex = lexer('true false false');
            assert.equal(lex.peek().type, 'true');
            assert.equal(lex.next().type, 'true');
            assert.equal(lex.peek().type, 'false');

        });

    });

    describe('accept()', function() {

        it('should accept the first matched token', function() {

            var lex = lexer('true false false');
            assert.equal(lex.accept('int'), null);
            assert.equal(lex.accept('true').type, 'true');

        });

    });

    describe('assert()', function() {

        it('should return the first token if it matches', function() {

            var lex = lexer('true false false');
            assert.equal(lex.assert('true').type, 'true');

        });

        it('should return a syntax error if it does not match', function() {

            var lex = lexer('true false false');
            assert.throws(function() {
                lex.assert('false');
            }, /SyntaxError/);

        });

    });

    it('should tokenize most symbols', function() {
        matches('{ ( [ ] ) }');
        matches('+ - / * % == != <= >= = < >');
    });
    it('should tokenize keywords', function() {
        tokensOfType('var', 'var');
        tokensOfType('return', 'return');
        tokensOfType('while', 'while');
        tokensOfType('if', 'if');
        tokensOfType('else', 'else');
        tokensOfType('true', 'true');
        tokensOfType('false', 'false');
        tokensOfType('for', 'for');
        tokensOfType('null', 'null');
        tokensOfType('continue', 'continue');
        tokensOfType('break', 'break');
        tokensOfType('or', 'or');
        tokensOfType('and', 'and');
        tokensOfType('func', 'func');
    });
    it('should tokenize identifiers', function() {
        tokensOfType('hello', 'identifier');
        tokensOfType('Hello', 'identifier');
        tokensOfType('hell0', 'identifier');
    });
    it('should tokenize identifiers containing keywords', function() {
        matches('varfoo casebar');
    });
    it('should tokenize integers', function() {
        matches('123345 1000');
        tokensOfType('123456', 'int');
        tokensOfType('1000', 'int');
        tokensOfType('0', 'int');
    });
    it('should tokenize floats', function() {
        matches('123.456 0.98765400');
        tokensOfType('123.456', 'float');
        tokensOfType('100.0', 'float');
        tokensOfType('0.98765400', 'float');
    });
    it('should tokenize string literals', function() {
        matches('"asdf" "foo" "123" "123\\nbar"');
        tokensOfType('"foo"', 'str');
        tokensOfType('"123"', 'str');
        tokensOfType('"0.123"', 'str');
        tokensOfType('"123.456"', 'str');
    });
    it('should tokenize string literals with single quotes', function() {
        matches("'asdf' 'foo' '123' '123\\nbar'");
        tokensOfType("'foo'", 'str');
        tokensOfType("'123'", 'str');
        tokensOfType("'0.123'", 'str');
        tokensOfType("'123.456'", 'str');
    });
    it('should tokenize strings with escapes', function() {
        matches("'asd\\'f' 'f\\\\oo' '1\\n23' '123\\tbar'");
    });

    it('should fail on unknown tokens', function() {
        assert.throws(function() {
            lexer('\\')();
        });
    });

    it('should ignore comments at EOF', function() {
        tokensOfType('"foo" #bar', 'str');
    });
});

