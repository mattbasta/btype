var nodes = require('./compiler/nodes');


function node(name, start, end, args) {
    return new (nodes[name])(start, end, args);
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
            throw new SyntaxError('Expected "' + type + '", got "' + lastSeen.type + '" at ' + temp.start);
        }
        return temp;
    }

    function parseFunction() {
        var func;
        if (!(func = accept('func'))) return;

        if (peek().type === '<') {
            return parseDeclaration(func);
        }

        var returnType = parseType();
        var identifier = null;
        if (returnType && accept(':')) {
            identifier = assert('identifier').text;
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

        if (returnType && !identifier) {
            identifier = returnType.name;
            returnType = null;
        }

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
        var hasBraces = !!accept('{');
        var body;
        var end;
        if (hasBraces) {
            body = parseStatements('}');
            end = assert('}');
        } else {
            body = [end = parseStatement()];
        }

        var alternate = null;
        if (accept('else')) {
            if (peek().type === 'if') {
                alternate = [end = parseIf()];
            } else {
                hasBraces = !!accept('{');
                if (hasBraces) {
                    alternate = parseStatements('}');
                    end = assert('}');
                } else {
                    alternate = [end = parseStatement()];
                }
            }
        }
        // TODO: Add else clause.
        return node(
            'If',
            head.start,
            end.end,
            {
                condition: condition,
                consequent: body,
                alternate: alternate
            }
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
        var case_head;
        var case_value;
        var case_body;
        var case_col;
        while (case_head = accept('case')) {
            case_value = parseExpression();
            case_col = assert(':');
            case_body = parseStatements(['case', '}']);
            cases.push(node(
                'Case',
                case_head.start,
                case_body.length ? case_body[case_body.length - 1].end : case_col.end,
                {
                    value: case_value,
                    body: case_body
                }
            ));
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
        var end = head;
        var value = null;
        if (!(end = accept(';'))) {
            value = parseExpression();
            end = assert(';');
        }
        return node(
            'Return',
            head.start,
            end.end,
            {value: value}
        );
    }
    function parseExport() {
        var head = accept('export');
        if (!head) return;
        var value = parseSymbol();
        var end = assert(';');
        return node(
            'Export',
            head.start,
            end.end,
            {value: value}
        );
    }
    function parseImport() {
        var head = accept('import');
        if (!head) return;
        var value = parseExpression();
        if (value.type !== 'Symbol' && value.type !== 'Member') {
            throw new SyntaxError('Unexpected import expression');
        } else if (value.type === 'Member' && value.base.type !== 'Symbol') {
            throw new SyntaxError('Cannot import complex expressions');
        }

        var base = value;
        var member = null;
        if (base.type === 'Member') {
            base = value.base;
            member = value.child;
        }

        var alias = null;
        if (accept('as')) {
            alias = parseSymbol();
        }

        var end = assert(';');
        return node(
            'Import',
            head.start,
            end.end,
            {
                base: base.name,
                member: member,
                alias: alias
            }
        );
    }
    function parseWhile() {
        var head;
        if (!(head = accept('while'))) return;
        assert('(');
        var condition = parseExpression();
        assert(')');
        var hasBraces = !!accept('{');
        var body;
        var end;
        if (hasBraces) {
            body = parseStatements('}');
            end = assert('}');
        } else {
            body = [parseStatement()];
            end = body[0];
        }
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
        assert(';');
        var iteration;
        if (!accept(')')) {
            iteration = parseAssignment();
            assert(')');
        }
        var end;
        var body;
        if (!!accept('{')) {
            body = parseStatements('}');
            end = assert('}');
        } else {
            body = [parseStatement()];
            end = body[0];
        }
        return node(
            'For',
            head.start,
            end.end,
            {
                assignment: assignment,
                condition: condition,
                iteration: iteration || null,
                loop: body
            }
        );
    }
    function parseDeclaration(type, start) {
        var origType = type;
        if (type && type.type !== 'Type') {
            type = parseType(type);
            if (origType.type === 'func') {
                assert(':');
            }
        }

        var identifier = assert('identifier');
        assert('=');
        var value = parseExpression();
        var end = assert(';');
        return node(
            'Declaration',
            type ? type.start : start,
            end.end,
            {
                declType: type || null,
                identifier: identifier.text,
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
    function parseMember(base) {
        assert('.');
        var child = assert('identifier');
        return node(
            'Member',
            base.start,
            child.end,
            {
                base: base,
                child: child.text
            }
        );
    }

    // https://github.com/mattbasta/btype/wiki/Operator-Precedence
    var OPERATOR_PRECEDENCE = {
        'or': 1,
        'and': 2,
        '==': 3,
        '!=': 3,
        '<': 4,
        '>': 4,
        '<=': 4,
        '>=': 4,
        '+': 5,
        '-': 5,
        '*': 6,
        '/': 6,
        '%': 6,
    };
    var OPERATOR_NODE = {
        'or': 'LogicalBinop',
        'and': 'LogicalBinop',
        '==': 'EqualityBinop',
        '!=': 'EqualityBinop',
        '<': 'RelativeBinop',
        '>': 'RelativeBinop',
        '<=': 'RelativeBinop',
        '>=': 'RelativeBinop',
        '+': 'Binop',
        '-': 'Binop',
        '*': 'Binop',
        '/': 'Binop',
        '%': 'Binop',

        '&': 'Binop',
        '|': 'Binop',
        '^': 'Binop',
        '~': 'Binop',
        '<<': 'Binop',
        '>>': 'Binop',
    };
    function parseOperator(left, newPrec) {
        var operator = pop();
        var precedence = newPrec;
        var right = parseExpression(null, precedence);
        return node(
            OPERATOR_NODE[operator.type],
            left.start,
            right.end,
            {
                left: left,
                right: right,
                operator: operator.type
            }
        );
    }

    function parseExpressionModifier(base, precedence) {
        var part;
        var peeked = peek();
        switch (peeked.type) {
            case '=':
                // TODO: Multiple assignment?
                // TODO: Chained assignment?
                return parseAssignment(true, base);
            case '(':
                part = parseCall(base);
                break;
            case '.':
                part = parseMember(base);
                break;
            case '+':
            case '-':
            case '*':
            case '/':
            case '%':
            case '==':
            case '!=':
            case '<=':
            case '>=':
            case '<':
            case '>':
            case 'and':
            case 'or':
                var newPrec = OPERATOR_PRECEDENCE[peeked.type];
                if (newPrec > precedence) {
                    return parseExpression(parseOperator(base, newPrec), newPrec);
                }
                // If the precedence is not higher, return so the
                // expression is terminated.
            default:
                return base;
        }
        return parseExpressionModifier(part, precedence);
    }
    function parseSymbol(base) {
        base = base || assert('identifier');
        return node(
            'Symbol',
            base.start,
            base.end,
            {name: base.text}
        );
    }
    function parseExpression(base, precedence) {
        function parseNext(base, precedence) {
            if (base === 'EOF' || base.type === 'EOF') {
                throw new SyntaxError('Unexpected end of file in expression');
            }
            var parsed;
            switch (base.type) {
                case '(':
                    parsed = parseExpression();
                    assert(')');
                    return parsed;
                case 'true':
                case 'false':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            litType: 'bool',
                            value: base.text === 'true'
                        }
                    );
                case 'null':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            litType: 'null',
                            value: null
                        }
                    );
                case 'float':
                case 'int':
                case 'string':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            litType: base.type,
                            value: base.text
                        }
                    );
                // Unary operators
                case '-':
                case '!':
                    parsed = parseExpression();
                    return node(
                        'Unary',
                        base.start,
                        parsed.end,
                        {
                            base: parsed,
                            operator: base.type
                        }
                    );
                case 'identifier':
                    return parseSymbol(base);
                default:
                    // This catches complex expressions.
                    return base;
            }
        }
        precedence = precedence || 0;
        var next = parseNext(base || pop(), precedence);
        var prev;
        do {
            prev = next;
            next = parseExpressionModifier(next, precedence);
        } while(next !== prev);
        return next;
    }

    function parseType(base, isTrait) {
        if (isTrait && accept('null')) {
            return null;
        }

        var type = base || accept('func') || assert('identifier');
        var typeEnd = type;
        var traits = [];
        if (type.type !== 'null' && accept('<')) {
            do {
                traits.push(parseType(null, true));
            } while (accept(','));
            typeEnd = assert('>');
        }
        return node(
            'Type',
            type.start,
            typeEnd.end,
            {
                name: type.text,
                traits: traits
            }
        );
    }

    function parseTypedIdentifier(base) {
        var type = parseType(base);
        assert(':');
        var ident = assert('identifier');
        return node(
            'TypedIdentifier',
            type.start,
            ident.end,
            {idType: type, name: ident.text}
        );
    }

    function parseStatement() {
        return parseFunction() ||
               parseIf() ||
               parseSwitch() ||
               parseReturn() ||
               parseExport() ||
               parseImport() ||
               parseWhile() ||
               parseDoWhile() ||
               parseFor() ||
               parseAssignment(); //call?
               // TODO: break, continue
    }

    function parseStatements(endTokens) {
        endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
        var statements = [];
        var temp = peek();
        while (endTokens.indexOf(temp) === -1 &&
               (temp.type && endTokens.indexOf(temp.type) === -1)) {
            var statement = parseStatement();
            temp = peek();
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
