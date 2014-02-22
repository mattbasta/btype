function node(name, start, end, args) {
    var result = {
        type: name,
        start: start,
        end: end
    };
    for (var i in args) {
        if (!args.hasOwnProperty(i)) continue;
        result[i] = args[i];
    }
    return result;
}

module.exports = function(tokenizer) {
    var peeked = null;
    function peek() {
        return peeked || (peeked = tokenizer());
    }
    function _next() {
        var token = tokenizer();
        if (token.type === 'comment') return _next();
        return token;
    }
    function pop() {
        if (!peeked) {
            return _next();
        }
        var temp = peeked;
        peeked = null;
        return temp;
    }

    var lastSeen;
    function accept(type) {
        var temp = peek();
        if (!temp || !temp.type || temp.type !== type) return;
        return pop();
    }
    function assert(type) {
        var temp = lastSeen = pop();
        if (!temp) {
            throw new SyntaxError('Expected "' + type + '", got "' + lastSeen + '".');
        }
        return temp;
    }

    function parseFunction() {
        var func;
        if (!(func = accept('func'))) return;
        // TODO: Change this to parse types.
        var returnType = accept('identifier');
        var identifier = null;
        if (returnType && accept(':')) {
            identifier = assert('identifier');
        }
        var parameters = [];
        var param_type;
        var param_name;
        // Parameter lists are optional.
        if (accept('(')) {
            // If it's not an empty parameter list, start parsing.
            if (!accept(')')) {
                do {
                    // TODO: Change this to parse types.
                    param_type = assert('identifier');
                    assert(':');
                    param_name = assert('identifier');
                    parameters.push({type: param_type, name: param_name});
                } while(accept(','));
                assert(')');
            }
        }
        assert('{');
        var body = parseStatements('}');
        var end = assert('}');

        return node(
            'Function',
            func.start,
            end.end,
            {
                returnType: returnType,
                name: identifier,
                params: parameters,
                body: body
            }
        );
    }

    function parseIf() {
        var head;
        if (!(head = accept('if'))) return;
        assert('(');
        var condition = parseExpression();
        assert(')');
        assert('{');
        var body = parseStatements('}');
        var end = assert('}');
        // TODO: Add else clause.
        return node(
            'If',
            head.start,
            end.end,
            {condition: condition, consequent: body}
        );
    }
    function parseSwitch() {
        var head;
        if (!(head = accept('switch'))) return;
        assert('(');
        var condition = parseExpression();
        assert(')');
        assert('{');

        var cases = [];
        var case_value;
        while (accept('case')) {
            case_value = parseExpression();
            assert(':');
            cases.push({
                value: case_value,
                body: parseStatements(['case', '}'])
            });
        }

        var end = assert('}');
        return node(
            'Switch',
            head.start,
            end.end,
            {condition: condition, cases: cases}
        );
    }
    function parseReturn() {
        var head;
        if (!(head = accept('return'))) return;
        var value = parseExpression();
        var end = assert(';');
        return node(
            'Return',
            head.start,
            end.end,
            {value: value}
        );
    }
    function parseWhile() {
        var head;
        if (!(head = accept('while'))) return;
        assert('(');
        var condition = parseExpression();
        assert(')');
        assert('{');
        var body = parseStatements('}');
        var end = assert('}');
        return node(
            'While',
            head.start,
            end.end,
            {condition: condition, loop: body}
        );
    }
    function parseDoWhile() {
        var head;
        if (!(head = accept('do'))) return;
        assert('{');
        var body = parseStatements('}');
        assert('}');
        assert('while');
        assert('(');
        var condition = parseExpression();
        assert(')');
        var end = assert(';');
        return node(
            'DoWhile',
            head.start,
            end.end,
            {condition: condition, loop: body}
        );
    }
    function parseFor() {
        var head;
        if (!(head = accept('for'))) return;
        assert('(');
        // TODO: Add ForOf support.
        var assignment = parseAssignment();
        var condition = parseExpression();
        var iteration;
        if (!accept(')')) {
            iteration = parseExpression();
            assert(')');
        }
        assert('{');
        var body = parseStatements('}');
        var end = assert('}');
        return node(
            'For',
            head.start,
            end.end,
            {condition: condition, loop: body}
        );
    }
    function parseAssignment() {
        var identifier = accept('identifier');
        if (!identifier) {
            return parseDeclaration(null);
        }
        if (accept(':')) {
            return parseDeclaration(identifier);
        }
        assert('=');
        var expression = parseExpression();
        var end = assert(';');
        return node(
            'Assignment',
            identifier.start,
            end.end,
            {identifier: identifier, value: expression}
        );
    }
    function parseDeclaration(type) {
        if (!type) {
            type = accept('var');
        }
        if (!type) {
            return parseCallStatement();
        }
        var identifier = assert('identifier');
        assert('=');
        var value = parseExpression();
        var end = assert(';');
        return node(
            'Declaration',
            type.start,
            end.end,
            {
                type: type.type === 'var' ? null : type,
                identifier: identifier,
                value: value
            }
        );
    }
    function parseCallStatement() {
        var callee = parseExpression();
        var end = assert(';');
    }
    function parseExpression() {}

    function parseStatement() {
        return parseFunction() ||
               parseIf() ||
               parseSwitch() ||
               parseReturn() ||
               parseWhile() ||
               parseDoWhile() ||
               parseFor() ||
               parseAssignment(); // Leads into other identifier-first statements.
    }

    function parseStatements(endTokens) {
        endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
        var statements = [];
        var temp;
        do {
            var statement = parseStatement();
            if (!statement) {
                continue;
            }
            statements.push(statement);
        } while (temp = peek(), endTokens.indexOf(temp) === -1 &&
                                (temp.type && endTokens.indexOf(temp.type) === -1));
        return statements;
    }

    function parseRoot() {
        return node('Root', null, null, {body: parseStatements('EOF')});
    }

    return parseRoot();

};

module.exports.node = node;
