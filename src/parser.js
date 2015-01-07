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

    function parseFunctionDeclaration() {
        var func;
        if (!(func = accept('func'))) return;

        if (peek().type === '<') {
            return parseDeclaration(func);
        }

        var returnType = parseType();
        var identifier = null;

        // If no return type is specified, swap the return type and name
        if (accept(':')) {
            identifier = assert('identifier').text;
        } else {
            identifier = returnType.name;
            returnType = null;
        }

        var parameters = [];
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
                body: body,
            }
        );
    }

    function parseFunctionExpression(func) {
        var returnType = null;

        if (peek().type === 'identifier') {
            returnType = parseType();
        }

        var parameters = [];
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
                name: null,
                params: parameters,
                body: body,
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
                    body: case_body,
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

    var loopDepth = 0;
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
            loopDepth++;
            body = parseStatements('}');
            loopDepth--;
            end = assert('}');
        } else {
            loopDepth++;
            body = [parseStatement()];
            loopDepth--;
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
        loopDepth++;
        var body = parseStatements('}');
        loopDepth--;
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
            loopDepth++;
            body = parseStatements('}');
            loopDepth--;
            end = assert('}');
        } else {
            loopDepth++;
            body = [parseStatement()];
            loopDepth--;
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
                loop: body,
            }
        );
    }
    function parseDeclaration(type, start, isConst) {
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
            isConst ? 'ConstDeclaration' : 'Declaration',
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
        if (base && base.type === 'CallRaw') {
            throw new SyntaxError('Assignment to function call output');
        }
        if (!isExpression) {
            var start;
            var isConst = false;
            if (start = accept('var')) {
                return parseDeclaration(null, start.start, false);
            } else if (start = accept('const')) {
                return parseDeclaration(null, start.start, true);
            }
            base = accept('identifier');
            if (base && accept(':')) {
                return parseDeclaration(base);
            }
            var expr = parseExpression(base);
            expr.end = assert(';').end;
            if (expr.type === 'CallRaw') {
                expr = node(
                    'CallStatement',
                    expr.start, expr.end,
                    {base: expr}
                );
            }
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
            'CallRaw',
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

        '|': 6,
        '^': 7,
        '&': 8,

        '<<': 8,
        '>>': 8,
        '+': 9,
        '-': 9,
        '*': 10,
        '/': 10,
        '%': 10,

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
            case '&':
            case '|':
            case '^':
            case '<<':
            case '>>':
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
                case 'str':
                    return node(
                        'Literal',
                        base.start,
                        base.end,
                        {
                            litType: base.type,
                            value: base.text,
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
                            operator: base.type,
                        }
                    );
                case 'new':
                    parsed = parseType();
                    assert('(');
                    var params = parseSignature(false, ')');
                    var closingParen = assert(')');
                    return node(
                        'New',
                        parsed.start,
                        closingParen.end,
                        {
                            newType: parsed,
                            params: params,
                        }
                    );
                case 'identifier':
                    return parseSymbol(base);
                case 'func':
                    return parseFunctionExpression(base);
                default:
                    if (base.isToken) {
                        throw new Error('Invalid token found while parsing expression: ' + base.text);
                    }

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

    function parseBreak() {
        var stmt;
        if (stmt = accept('break')) {
            if (!loopDepth) {
                throw new Error('Cannot use `break` when not within a loop');
            }
            assert(';');
            return node(
                'Break',
                stmt.start,
                stmt.end,
                {}
            );
        }
    }
    function parseContinue() {
        var stmt;
        if (stmt = accept('continue')) {
            if (!loopDepth) {
                throw new Error('Cannot use `continue` when not within a loop');
            }
            assert(';');
            return node(
                'Continue',
                stmt.start,
                stmt.end,
                {}
            );
        }
    }

    function parseOperatorStatement() {
        var operator = accept('operator');
        if (!operator) return;

        assert('(');
        var left = parseTypedIdentifier();
        var binOp;
        switch (peek().type) {
            case '+':
            case '-':
            case '*':
            case '/':
            case '%':
            case '&':
            case '|':
            case '^':
            case '<<':
            case '>>':
            case 'and':
            case 'or':
            case '<':
            case '<=':
            case '>':
            case '>=':
            case '==':
            case '!=':
                binOp = pop().type;
                break;

            default:
                throw new Error('Overriding invalid operator: ' + peek().text);
        }
        var right = parseTypedIdentifier();

        assert(')');

        var returnType = parseType();

        assert('{');
        var body = parseStatements('}');
        var endBrace = assert('}');

        return node(
            'OperatorStatement',
            operator.start,
            endBrace.end,
            {
                left: left,
                right: right,
                operator: binOp,
                body: body,
                returnType: returnType,
            }
        );
    }

    function parseObjectDeclaration() {
        var obj = accept('object');
        if (!obj) return;

        var name = assert('identifier');

        assert('{');

        var constructor = null;
        var members = [];
        var methods = [];

        var constructorBase;
        var memberType;
        var methodSignature;
        var methodBody;
        var methodEndBrace;
        var endBrace;
        while (!(endBrace = accept('}'))) {

            if (constructorBase = accept('new')) {

                if (constructor) {
                    throw new SyntaxError('Cannot have multiple constructors in the same object declaration');
                }

                assert('(');
                methodSignature = parseSignature(true, ')');
                methodSignature.unshift(node(
                    'TypedIdentifier',
                    0,
                    0,
                    {
                        idType: node(
                            'Type',
                            0,
                            0,
                            {
                                name: name.text,
                                traits: [],
                            }
                        ),
                        name: 'self',
                    }
                ));

                assert(')');
                assert('{');
                methodBody = parseStatements('}');
                endBrace = assert('}');

                constructor = node(
                    'ObjectConstructor',
                    constructorBase.start,
                    endBrace.end,
                    {
                        base: node(
                            'Function',
                            constructorBase.start,
                            endBrace.end,
                            {
                                name: 'new',
                                returnType: null,
                                params: methodSignature,
                                body: methodBody,
                                __objectSpecial: 'constructor',
                            }
                        ),
                    }
                );

                continue;
            }

            memberType = parseTypedIdentifier();
            if (members.some(function(member) {return member.name === memberType.name;}) ||
                methods.some(function(method) {return method.name === memberType.name;})) {
                throw new SyntaxError('Class "' + name + '" cannot declare "' + memberType.name + '" more than once.');
            }

            if (accept(';')) {
                members.push(node(
                    'ObjectMember',
                    memberType.start,
                    memberType.end,
                    {
                        memberType: memberType,
                        name: memberType.name,
                        value: null,
                    }
                ));
                continue;
            } else if (accept('(')) {
                methodSignature = parseSignature(true, ')');

                endBrace = assert(')');
                methodSignature.unshift(node(
                    'TypedIdentifier',
                    0,
                    0,
                    {
                        idType: node(
                            'Type',
                            0,
                            0,
                            {
                                name: name.text,
                                traits: [],
                            }
                        ),
                        name: 'self',
                    }
                ));

                assert('{');
                methodBody = parseStatements('}');
                methodEndBrace = assert('}');

                methods.push(node(
                    'ObjectMethod',
                    memberType.start,
                    methodEndBrace.end,
                    {
                        name: memberType.name,
                        base: node(
                            'Function',
                            memberType.start,
                            methodEndBrace.end,
                            {
                                returnType: memberType.idType,
                                name: memberType.name,
                                params: methodSignature,
                                body: methodBody,
                                __objectSpecial: 'method',
                            }
                        ),
                    }
                ));
                continue;
            }

            throw new SyntaxError('Unknown token in class definition: ' + peek().text);

        }

        return node(
            'ObjectDeclaration',
            obj.start,
            endBrace.end,
            {
                name: name.text,
                objConstructor: constructor,
                members: members,
                methods: methods,
            }
        );
    }

    function parseStatement(isRoot) {
        return parseFunctionDeclaration() ||
               isRoot && parseOperatorStatement() ||
               isRoot && parseObjectDeclaration() ||
               parseIf() ||
               parseSwitch() ||
               parseReturn() ||
               isRoot && parseExport() ||
               isRoot && parseImport() ||
               parseWhile() ||
               parseDoWhile() ||
               parseFor() ||
               parseBreak() ||
               parseContinue() ||
               parseAssignment();
    }

    function parseStatements(endTokens, isRoot) {
        endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
        var statements = [];
        var temp = peek();
        while (endTokens.indexOf(temp) === -1 &&
               (temp.type && endTokens.indexOf(temp.type) === -1)) {
            var statement = parseStatement(isRoot);
            if (!statement) {
                throw new Error('Invalid statement');
            }
            temp = peek();
            statements.push(statement);
        }
        return statements;
    }

    function parseRoot() {
        return node('Root', null, null, {body: parseStatements('EOF', true)});
    }

    return parseRoot();

};

module.exports.node = node;
