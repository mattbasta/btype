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
        var token;
        do {
            token = tokenizer();
        } while(token.type === 'comment');
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
        if (!temp || temp.type !== type) {
            throw new SyntaxError('Expected "' + type + '", got "' + lastSeen.type + '".');
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
            parameters = parseSignature(true, ')');
            assert(')');
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
        var head = accept('return');
        if (!head) return;
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
    function parseDeclaration(type, start) {
        var identifier = assert('identifier');
        assert('=');
        var value = parseExpression();
        var end = assert(';');
        return node(
            'Declaration',
            type ? type.start : start,
            end.end,
            {
                type: type || null,
                identifier: identifier,
                value: value
            }
        );
    }
    function parseAssignment(isExpression, base) {
        if (base && base.type === 'Call') {
            throw new SyntaxError('Assignment to function call output');
        }
        if (!isExpression) {
            var start;
            if (start = accept('var')) {
                return parseDeclaration(null, start.start);
            }
            base = accept('identifier');
            if (base && accept(':')) {
                return parseDeclaration(base);
            }
            var expr = parseExpression(base);
            expr.end = assert(';').end;
            return expr;
        }

        assert('=');
        var expression = parseExpression();
        return node(
            'Assignment',
            base.start,
            expression.end,
            {base: base, value: expression}
        );
    }
    function parseSignature(typed, endToken) {
        var params = [];
        if (peek().type === endToken) return params;
        while (true) {
            if (typed) {
                params.push(parseTypedIdentifier());
            } else {
                params.push(parseExpression());
            }
            if (peek().type === endToken) {
                break;
            }
            assert(',');
        }
        return params;
    }
    function parseCall(base) {
        assert('(');
        var params = parseSignature(false, ')');
        var end = assert(')');
        return node(
            'Call',
            base.start,
            end.end,
            {
                callee: base,
                params: params
            }
        );
    }
    function parseExpression(base) {
        function parseNext(base) {
            if (base === 'EOF' || base.type === 'EOF') {
                throw new SyntaxError('Unexpected end of file in expression');
            }
            switch (base.type) {
                case '(':
                    var parsed = parseExpression();
                    assert(')');
                    if (parsed.precedence) delete parsed.precedence;
                    return parsed;
                case 'true':
                case 'false':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            type: 'bool',
                            value: base.text
                        }
                    );
                case 'null':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            type: 'null',
                            value: null
                        }
                    );
                case 'float':
                case 'integer':
                case 'string':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            type: base.type,
                            value: base.text
                        }
                    );
                default:
                    // This catches identifiers as well as complex expressions.
                    var part;
                    switch (peek().type) {
                        case '(':
                            part = parseCall(base);
                            break;
                        case '.':
                            part = parseMember(base);
                            break;
                        case '=':
                            // TODO: Multiple assignment?
                            // TODO: Chained assignment?
                            return parseAssignment(true, base);
                        default:
                            return base;
                    }
                    return parseNext(part);
            }
            // Throw an error?
            return null;
        }

        return parseNext(base || pop());
    }

    function parseTypedIdentifier(base) {
        // TODO: This should accept complex types
        var type = base || assert('identifier');
        assert(':');
        var ident = assert('identifier');
        return {type: type, name: ident};
    }

    function parseStatement() {
        return parseFunction() ||
               parseIf() ||
               parseSwitch() ||
               parseReturn() ||
               parseWhile() ||
               parseDoWhile() ||
               parseFor() ||
               parseAssignment(); //call?
               // TODO: return, break, continue
    }

    function parseStatements(endTokens) {
        endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
        var statements = [];
        var temp = peek();
        while (endTokens.indexOf(temp) === -1 &&
               (temp.type && endTokens.indexOf(temp.type) === -1)) {
            var statement = parseStatement();
            temp = peek();
            if (!statement) {
                continue;
            }
            statements.push(statement);
        }
        return statements;
    }

    function parseRoot() {
        return node('Root', null, null, {body: parseStatements('EOF')});
    }

    return parseRoot();

};

module.exports.node = node;
