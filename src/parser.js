var nodes = require('./compiler/nodes');


function node(name, start, end, args) {
    return new (nodes[name])(start, end, args);
}

/**
 * Turns an encoded string into its text content
 * @param  {string} input
 * @return {string}
 */
function parseString(input) {
    var stripped = input.substring(1, input.length - 1);

    return stripped.replace(/\\(\w|\\)/gi, function(_, b) {
        switch (b) {
            case '\\r': return '\r';
            case '\\n': return '\n';
            case '\\t': return '\t';
            case '\\0': return '\0';
            case '\\\\': return '\\';
            default:
                throw new SyntaxError('Invalid escape code: ' + b);
        }
    });
}

/**
 * Parses a token stream into the AST
 * @param  {Lexer} lex
 * @return {*} The parsed AST
 */
module.exports = function parse(lex) {
    return node(
        'Root',
        null,
        null,
        {body: parseStatements(lex, 'EOF', true)}
    );
};

function parseFunctionDeclaration(lex, func) {
    if (!func && !(func = lex.accept('func'))) return;

    if (lex.peek().type === '<') {
        return parseDeclaration(lex, func);
    }

    var returnType = parseType(lex);
    var identifier = null;

    // If no return type is specified, swap the return type and name
    if (lex.accept(':')) {
        identifier = lex.assert('identifier').text;
    } else {
        identifier = returnType.name;
        returnType = null;
    }

    var parameters = [];
    // Parameter lists are optional.
    if (lex.accept('(')) {
        // If it's not an empty parameter list, start parsing.
        parameters = parseSignature(lex, true, ')');
        lex.assert(')');
    }
    lex.assert('{');

    var body = parseStatements(lex, '}');
    var end = lex.assert('}');

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

function parseFunctionExpression(lex, func, ) {
    var returnType = null;

    if (lex.peek().type === 'identifier') {
        returnType = parseType(lex);
    }

    var parameters = [];
    // Parameter lists are optional.
    if (lex.accept('(')) {
        // If it's not an empty parameter list, start parsing.
        parameters = parseSignature(lex, true, ')');
        lex.assert(')');
    }
    lex.assert('{');

    var body = parseStatements(lex, '}');
    var end = lex.assert('}');

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

function parseIf(lex) {
    var head;
    if (!(head = lex.accept('if'))) return;
    var condition = parseExpression(lex);
    lex.assert('{')
    var body;
    var end;
    body = parseStatements(lex, '}');
    end = lex.assert('}');

    var alternate = null;
    if (lex.accept('else')) {
        if (lex.peek().type === 'if') {
            alternate = [end = parseIf(lex)];
        } else {
            lex.assert('{');
            alternate = parseStatements(lex, '}');
            end = lex.assert('}');
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
function parseReturn(lex) {
    var head = lex.accept('return');
    if (!head) return;
    var end = head;
    var value = null;
    if (!(end = lex.accept(';'))) {
        value = parseExpression(lex);
        end = lex.assert(';');
    }
    return node(
        'Return',
        head.start,
        end.end,
        {value: value}
    );
}
function parseExport(lex) {
    var head = lex.accept('export');
    if (!head) return;
    var value = lex.accept('identifier');
    var end = lex.assert(';');
    return node(
        'Export',
        head.start,
        end.end,
        {value: value.text}
    );
}

function parseImport(lex) {
    var head = lex.accept('import');
    if (!head) return;

    var value = parseSymbol(lex);
    function parseImportBase(lex, base) {
        var child;
        if (lex.accept('.')) {
            child = lex.assert('identifier');
            base = node(
                'Member',
                base.start,
                child.end,
                {
                    base: base,
                    child: child.text,
                }
            );
            return parseImportBase(lex, base);
        }
        return base;
    }
    value = parseImportBase(lex, value);
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
    if (lex.accept('as')) {
        alias = parseSymbol(lex);
    }

    var end = lex.assert(';');
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
function parseWhile(lex) {
    var head;
    if (!(head = lex.accept('while'))) return;
    var condition = parseExpression(lex);
    lex.assert('{');
    var body;
    var end;
    loopDepth++;
    body = parseStatements(lex, '}');
    loopDepth--;
    end = lex.assert('}');
    return node(
        'While',
        head.start,
        end.end,
        {condition: condition, body: body}
    );
}
function parseDoWhile(lex) {
    var head;
    if (!(head = lex.accept('do'))) return;
    lex.assert('{');
    loopDepth++;
    var body = parseStatements(lex, '}');
    loopDepth--;
    lex.assert('}');
    lex.assert('while');
    var condition = parseExpression(lex);
    var end = lex.assert(';');
    return node(
        'DoWhile',
        head.start,
        end.end,
        {condition: condition, body: body}
    );
}
function parseFor(lex) {
    var head;
    if (!(head = lex.accept('for'))) return;
    var assignment = parseAssignment(lex);
    var condition = parseExpression(lex);
    lex.assert(';');
    var iteration;
    if (lex.peek().type !== '{') {
        iteration = parseAssignment(lex);
    }
    lex.assert('{');
    var end;
    var body;
    loopDepth++;
    body = parseStatements(lex, '}');
    loopDepth--;
    end = lex.assert('}');
    return node(
        'For',
        head.start,
        end.end,
        {
            assignment: assignment,
            condition: condition,
            iteration: iteration || null,
            body: body,
        }
    );
}
function parseDeclaration(lex, type, start, isConst) {
    var origType = type;
    if (type && (type.type !== 'Type' && type.type !== 'TypeMember')) {
        type = parseType(lex, type);
        if (origType.type === 'func') {
            lex.assert(':');
        }
    }

    var identifier = lex.assert('identifier');
    lex.assert('=');
    var value = parseExpression(lex);
    var end = lex.assert(';');
    return node(
        isConst ? 'ConstDeclaration' : 'Declaration',
        type ? type.start : start,
        end.end,
        {
            declType: type || null,
            identifier: identifier.text,
            value: value,
        }
    );
}
function parseAssignment(lex, isExpression, base) {
    if (base && base.type === 'CallRaw') {
        throw new SyntaxError('Assignment to function call output');
    }

    if (!isExpression) {
        var expr = parseExpression(lex, base);
        expr.end = lex.assert(';').end;
        return expr;
    }

    lex.assert('=');
    var expression = parseExpression(lex);
    return node(
        'Assignment',
        base.start,
        expression.end,
        {base: base, value: expression}
    );
}

function parseTypeCast(lex, base) {
    lex.assert('as');
    var type = parseType(lex);
    return node(
        'TypeCast',
        base.start,
        type.end,
        {
            left: base,
            rightType: type,
        }
    );
}

function parseSignature(lex, typed, endToken, firstParam) {
    var params = [];
    if (firstParam)
    if (lex.peek().type === endToken) return params;
    var temp;
    while (true) {
        if (typed) {
            params.push(parseTypedIdentifier(lex));
        } else {
            temp = parseExpression(lex);
            if (temp.type !== 'Symbol') {
                throw new SyntaxError('Unexpected expression in signature');
            }
            params.push(temp);
        }
        if (lex.peek().type === endToken) {
            break;
        }
        lex.assert(',');
    }
    return params;
}
function parseCall(lex, base) {
    lex.assert('(');
    var params = parseSignature(lex, false, ')');
    var end = lex.assert(')');
    return node(
        'CallRaw',
        base.start,
        end.end,
        {
            callee: base,
            params: params,
        }
    );
}
function parseMember(lex, base) {
    lex.assert('.');
    var child = lex.assert('identifier');
    return node(
        'Member',
        base.start,
        child.end,
        {
            base: base,
            child: child.text,
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
function parseOperator(lex, left, newPrec) {
    var operator = lex.next();
    var precedence = newPrec;
    var right = parseExpression(lex, null, precedence);
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

function parseSubscript(lex, base) {
    lex.assert('[');
    var subscript = parseExpression(lex);
    var end = lex.assert(']');
    return node(
        'Subscript',
        base.start,
        end.end,
        {
            base: base,
            subscript: subscript,
        }
    );
}

function parseTuple(lex, base) {
    var endBracket;
    var content = [];
    do {
        content.push(parseExpression(lex));
    } while (lex.accept(','));

    endBracket = lex.assert(']');

    return node(
        'TupleLiteral',
        base.start,
        endBracket.end,
        {content: content}
    );

}

function parseExpressionModifier(lex, base, precedence) {
    var part;
    var peeked = lex.peek();

    switch (peeked.type) {
        case '=':
            return parseAssignment(lex, true, base);
        case 'as':
            return parseTypeCast(lex, base);
        case '(':
            part = parseCall(lex, base);
            break;
        case '[':
            part = parseSubscript(lex, base);
            break;
        case '.':
            part = parseMember(lex, base);
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
                return parseExpression(lex, parseOperator(lex, base, newPrec), newPrec);
            }
            // If the precedence is not higher, return so the
            // expression is terminated.
        default:
            return base;
    }
    return parseExpressionModifier(lex, part, precedence);
}
function parseSymbol(lex, base) {
    base = base || lex.assert('identifier');
    return node(
        'Symbol',
        base.start,
        base.end,
        {name: base.text}
    );
}
function parseExpression(lex, base, precedence) {
    function parseNext(base, precedence) {
        if (base === 'EOF' || base.type === 'EOF') {
            throw new SyntaxError('Unexpected end of file in expression');
        }
        var parsed;
        var exprBody;
        switch (base.type) {
            case '(':
                if (lex.peek().type === ')') {
                    lex.assert(':');
                    exprBody = parseExpression(lex);
                    return node(
                        'FunctionLambda',
                        base.start,
                        exprBody.end,
                        {
                            returnType: null,
                            name: null,
                            params: [],
                            body: [
                                node('Return', {value: exprBody}),
                            ],
                        }
                    );
                }

                parsed = parseExpression(lex);
                if (parsed.type === 'Symbol') {
                    var args = [parsed];
                    if (lex.accept(',')) {
                        do {
                            args.push(parseSymbol(lex));
                        } while (lex.accept(','));
                        lex.assert(')');
                        lex.assert(':');
                        exprBody = parseExpression(lex);
                        return node(
                            'FunctionLambda',
                            base.start,
                            exprBody.end,
                            {
                                returnType: null,
                                name: null,
                                params: [],
                                body: [
                                    node('Return', {value: exprBody}),
                                ],
                            }
                        );
                    }
                }
                lex.assert(')');
                return parsed;
            case '[:':
                return parseTuple(lex, base);
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
            case 'sfloat':
                return node(
                    'Literal',
                    base.start,
                    base.end,
                    {
                        litType: base.type,
                        value: base.text.substr(0, base.text.length - 1),
                    }
                );
            case 'float':
            case 'int':
                return node(
                    'Literal',
                    base.start,
                    base.end,
                    {
                        litType: base.type,
                        value: base.text,
                    }
                );
            case 'str':
                return node(
                    'Literal',
                    base.start,
                    base.end,
                    {
                        litType: base.type,
                        value: parseString(base.text),
                    }
                );
            // Unary operators
            case '!':
            case '~':
                parsed = parseNext(lex.next(), 4);
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
                parsed = parseType(lex);
                lex.assert('(');
                var params = parseSignature(lex, false, ')');
                var closingParen = lex.assert(')');
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
                return parseSymbol(lex, base);
            case 'func':
                return parseFunctionExpression(lex, base);
            default:
                if (base.isToken) {
                    throw new SyntaxError('Invalid token found while parsing expression: "' + base.text + '"\nNear line ' + lex.currentLine);
                }

                // This catches complex expressions.
                return base;
        }
    }
    precedence = precedence || 0;
    var next = parseNext(base || lex.next(), precedence);
    var prev;
    do {
        prev = next;
        next = parseExpressionModifier(lex, next, precedence);
    } while(next !== prev);
    return next;
}

function parseType(lex, base, isAttribute) {
    if (isAttribute && lex.accept('null')) {
        return null;
    }

    var type = base || lex.accept('func') || lex.assert('identifier');
    var typeEnd = type;
    var attributes = [];

    function parseAttributes() {
        if (type.type !== 'null' && lex.accept('<')) {
            do {
                attributes.push(parseType(lex, null, true));
            } while (lex.accept(','));
            typeEnd = lex.assert('>');
        }
    }
    parseAttributes();

    var output;

    if (!attributes.length && lex.peek().type === '.') {
        output = node(
            'Symbol',
            type.start,
            typeEnd.end,
            {name: type.text}
        );

        var member;
        while (lex.accept('.')) {
            member = lex.assert('identifier');
            output = node(
                'TypeMember',
                output.start,
                member.end,
                {
                    base: output,
                    child: member.text,
                    attributes: [],
                }
            );
        }

        parseAttributes();
        output.attributes = attributes;
    } else {
        output = node(
            'Type',
            type.start,
            typeEnd.end,
            {
                name: type.text,
                attributes: attributes
            }
        );
    }

    return output;
}

function parseTypedIdentifier(lex, base) {
    var type = parseType(lex, base);
    lex.assert(':');
    var ident = lex.assert('identifier');
    return node(
        'TypedIdentifier',
        type.start,
        ident.end,
        {idType: type, name: ident.text}
    );
}

function parseExpressionBase(lex) {
    // This function recursively accumulates tokens until the proper node
    // can be determined.

    var peeked;
    var temp;
    var base = lex.accept('func');
    // If the first token is `func`, we've got two options:
    // - Variable declaration: func<foo>:bar = ...
    // - Function declaration: func foo:bar()...
    // Fortunately, `parseFunctionDeclaration` does both of these for us.
    if (base) {
        return parseFunctionDeclaration(lex, base);
    }

    peeked = lex.peek();

    // Another option is a paren, which allows its contents to be any valid
    // expression:
    //   (foo as Bar).member = ...
    //   (foo as Bar).method();
    // This is all handled by parseAssignment.
    if (peeked.type === '(') {
        return parseAssignment(lex);
    }

    // `var` and `const` are giveaways for a Declaration node.
    if (peeked.type === 'var' ||
        peeked.type === 'const') {
        temp = lex.next();
        return parseDeclaration(lex, null, temp.start, temp.type === 'const');
    }

    // At this point, the only valid token is an identifier.
    base = lex.assert('identifier');

    function convertStackToTypeMember(stack) {
        var bottomToken = stack.shift();
        var bottom = node(
            'Symbol',
            bottomToken.start,
            bottomToken.end,
            {name: bottomToken.text}
        );
        var token;
        while (stack.length) {
            token = stack.shift();
            bottom = node(
                'TypeMember',
                bottom.start,
                token.end,
                {
                    base: bottom,
                    child: token.text,
                }
            );
        }

        return bottom;
    }

    function convertStackToMember(stack) {
        var bottomToken = stack.shift();
        var bottom = node(
            'Symbol',
            bottomToken.start,
            bottomToken.end,
            {name: bottomToken.text}
        );
        var token;
        while (stack.length) {
            token = stack.shift();
            bottom = node(
                'Member',
                bottom.start,
                token.end,
                {
                    base: bottom,
                    child: token.text,
                }
            );
        }

        return bottom;
    }

    function accumulate(base) {
        if (lex.accept('.')) {
            // We're still accumulating a chain of identifiers into either
            // a Member node or a TypeMember node for a TypedIdentifier.
            base.push(lex.assert('identifier'));
            return accumulate(base);
        }
        var peeked = lex.peek();
        var temp;
        var semicolon;
        if (peeked.type === ':') {
            // We've parsed the type of a declaration.
            if (base.length === 1) {
                temp = parseType(lex, base[0]);
            } else {
                temp = convertStackToTypeMember(base);
            }
            lex.assert(':'); // for sanity and to pop
            return parseDeclaration(lex, temp);
        } else if (peeked.type === '<') {
            // We've encountered the attributes chunk of a typed identifier.
            if (base.length === 1) {
                temp = parseType(lex, base[0]);
            } else {
                temp = parseType(lex, convertStackToTypeMember(base));
            }
            lex.assert(':'); // for sanity and to pop
            return parseDeclaration(lex, temp);
        }
        if (peeked.type === '(' ||
            peeked.type === '[') {
            // We've hit a call or subscript. This means that we can defer
            // to the normal expression parse flow because it cannot be a
            // declaration:
            //   foo.bar() ...
            //   foo[bar] = ...
            temp = convertStackToMember(base);
            temp = parseExpression(lex, temp, 0);
            semicolon = lex.assert(';');
            if (temp.type === 'CallRaw') {
                temp = node(
                    'CallStatement',
                    temp.start, semicolon.end,
                    {base: temp}
                );
            }
            temp.end = semicolon.end;
            return temp;
        }
        if (peeked.type === '=') {
            // We've hit an assignment:
            //   foo.bar.zap = ...
            temp = convertStackToMember(base);
            temp = parseAssignment(lex, true, temp);
            semicolon = lex.assert(';');
            temp.end = semicolon.end;
            return temp;
        }
        throw new SyntaxError('Unexpected token "' + lex.peek().text + '" near line ' + lex.currentLine);
    }
    return accumulate([base]);
}

function parseBreak(lex) {
    var stmt = lex.accept('break');
    if (!stmt) {
        return;
    }
    if (!loopDepth) {
        throw new Error('Cannot use `break` when not within a loop');
    }
    lex.assert(';');
    return node(
        'Break',
        stmt.start,
        stmt.end,
        {}
    );
}
function parseContinue(lex) {
    var stmt = lex.accept('continue');
    if (!stmt) {
        return;
    }
    if (!loopDepth) {
        throw new Error('Cannot use `continue` when not within a loop');
    }
    lex.assert(';');
    return node(
        'Continue',
        stmt.start,
        stmt.end,
        {}
    );
}

function parseOperatorStatement(lex) {
    var operator = lex.accept('operator');
    if (!operator) return;

    lex.assert('(');
    var left = parseTypedIdentifier(lex);
    if (lex.accept('[')) {
        return parseOperatorStatementSubscript(lex, operator, left);
    }
    var binOp;
    switch (lex.peek().type) {
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
            binOp = lex.next().type;
            break;

        default:
            throw new Error('Overriding invalid operator: ' + lex.peek().text);
    }
    var right = parseTypedIdentifier(lex);

    lex.assert(')');

    var returnType = parseType(lex);

    lex.assert('{');
    var body = parseStatements(lex, '}');
    var endBrace = lex.assert('}');

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

function parseOperatorStatementSubscript(lex, operator, left) {
    var right = parseTypedIdentifier(lex);
    lex.assert(']');
    lex.assert(')');

    var returnType = parseType(lex);

    lex.assert('{');
    var body = parseStatements(lex, '}');
    var endBrace = lex.assert('}');

    return node(
        'OperatorStatement',
        operator.start,
        endBrace.end,
        {
            left: left,
            right: right,
            operator: '[]',
            body: body,
            returnType: returnType,
        }
    );
}

function parseObjectDeclaration(lex) {
    var obj = lex.accept('object');
    if (!obj) return;

    var name = lex.assert('identifier');

    var attributes = [];
    var attrIdent;
    if (lex.accept('<')) {
        while (true) {
            attrIdent = lex.assert('identifier').text;
            if (attributes.indexOf(attrIdent) !== -1) {
                throw new SyntaxError('Cannot declare attribute multiple times for the same object declaration');
            }

            attributes.push(attrIdent);

            if (lex.accept('>')) {
                break;
            }
            lex.assert(',');
        }
    }

    lex.assert('{');

    var constructor = null;
    var members = [];
    var methods = [];
    var operatorStatements = [];

    while (lex.accept('with')) {
        var attrIdent = lex.assert('identifier').text;
        if (attributes.indexOf(attrIdent) !== -1) {
            throw new SyntaxError('Cannot declare attribute multiple times for the same object declaration');
        }

        attributes.push(attrIdent);
        lex.assert(';');
    }

    var peekedType;
    var constructorBase;
    var memberType;
    var methodSignature;
    var methodBody;
    var methodEndBrace;
    var endBrace;
    var methodSelfParam;
    var isPrivate;
    var isFinal;
    while (!(endBrace = lex.accept('}'))) {
        methodSelfParam = null;

        isPrivate = lex.accept('private');
        isFinal = lex.accept('final');

        if (constructorBase = lex.accept('new')) {

            if (isPrivate) {
                throw new SyntaxError('Private constructors are not allowed');
            }

            if (constructor) {
                throw new SyntaxError('Cannot have multiple constructors in the same object declaration');
            }

            lex.assert('(');

            if (lex.accept('[')) {
                methodSelfParam = parseTypedIdentifier(lex);
                lex.assert(']');
            }

            methodSignature = [];
            if (methodSelfParam && lex.accept(',') || !methodSelfParam) {
                methodSignature = parseSignature(lex, true, ')');
            }
            methodSignature.unshift(methodSelfParam || node(
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
                            attributes: [],
                        }
                    ),
                    name: 'self',
                }
            ));

            lex.assert(')');
            lex.assert('{');
            methodBody = parseStatements(lex, '}');
            endBrace = lex.assert('}');

            constructor = node(
                'ObjectConstructor',
                isFinal ? isFinal.start : constructorBase.start,
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
                    isFinal: !!isFinal,
                }
            );

            continue;

        } else if (lex.peek().type === 'operator') {
            var tempOpStmt = parseOperatorStatement(lex);

            if (tempOpStmt.left.idType.name !== name.text &&
                tempOpStmt.right.idType.name !== name.text) {
                throw new SyntaxError(
                    'Operator overload for ' + name.text + ' of "' + tempOpStmt.operator +
                    '" must include ' + name.text + ' in its declaration.'
                );
            }

            operatorStatements.push(node(
                'ObjectOperatorStatement',
                tempOpStmt.start,
                tempOpStmt.end,
                {base: tempOpStmt}
            ));
            continue;
        }

        peekedType = lex.peek();
        memberType = parseSymbol(lex);
        if (lex.peek().text === ':' || lex.peek().text === '<') {
            memberType = parseTypedIdentifier(lex, peekedType);
        }
        if (members.some(function(member) {return member.name === memberType.name;}) ||
            methods.some(function(method) {return method.name === memberType.name;})) {
            throw new SyntaxError('Class "' + name.text + '" cannot declare "' + memberType.name + '" more than once.');
        }

        if (memberType.type === 'TypedIdentifier' && lex.accept(';')) {
            members.push(node(
                'ObjectMember',
                isPrivate ?
                    isPrivate.start :
                    isFinal ?
                        isFinal.start :
                        memberType.start,
                memberType.end,
                {
                    memberType: memberType,
                    name: memberType.name,
                    value: null,
                    isFinal: !!isFinal,
                    isPrivate: !!isPrivate,
                }
            ));
            continue;
        } else if (lex.accept('(')) {
            if (lex.accept('[')) {
                methodSelfParam = parseTypedIdentifier(lex);
                lex.assert(']');
            }

            methodSignature = [];
            if (methodSelfParam && lex.accept(',') || !methodSelfParam) {
                methodSignature = parseSignature(lex, true, ')');
            }
            methodSignature.unshift(methodSelfParam || node(
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
                            attributes: [],
                        }
                    ),
                    name: 'self',
                }
            ));

            endBrace = lex.assert(')');
            lex.assert('{');
            methodBody = parseStatements(lex, '}');
            methodEndBrace = lex.assert('}');

            methods.push(node(
                'ObjectMethod',
                isPrivate ?
                    isPrivate.start :
                    isFinal ?
                        isFinal.start :
                        memberType.start,
                methodEndBrace.end,
                {
                    name: memberType.name,
                    base: node(
                        'Function',
                        memberType.start,
                        methodEndBrace.end,
                        {
                            returnType: memberType.type === 'TypedIdentifier' ? memberType.idType : null,
                            name: memberType.name,
                            params: methodSignature,
                            body: methodBody,
                            __objectSpecial: 'method',
                        }
                    ),
                    isFinal: !!isFinal,
                    isPrivate: !!isPrivate,
                }
            ));
            continue;
        }

        throw new SyntaxError('Unknown token in class definition: ' + lex.peek().text + ' near line ' + lex.peek().line);

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
            attributes: attributes,
            operators: operatorStatements,
        }
    );
}

/**
 * Parses a `switchtype` statement
 * @param  {Lexer} lex
 * @return {SwitchType}
 */
function parseSwitchType(lex) {
    var start = lex.accept('switchtype');
    if (!start) {
        return null;
    }

    var expr = parseExpression(lex);
    lex.assert('{');

    var case_;
    var cases = [];
    var end;
    do {
        case_ = parseSwitchTypeCase(lex);
        cases.push(case_);
    } while (!(end = lex.accept('}')));

    return node(
        'SwitchType',
        start.start,
        end.end,
        {
            expr: expr,
            cases: cases,
        }
    );
}

/**
 * Parses a SwitchType's case statement
 * @param  {Lexer}
 * @return {SwitchTypeCase}
 */
function parseSwitchTypeCase(lex) {
    var start = lex.assert('case');
    var type = parseType(lex);
    lex.assert('{');

    var body = parseStatements(lex, '}', false);

    var end = lex.assert('}');

    return node(
        'SwitchTypeCase',
        start.start,
        end.end,
        {
            caseType: type,
            body: body,
        }
    );
}

/**
 * Parses a single statement
 * @param  {Lexer} lex
 * @param  {bool}
 * @return {*}
 */
function parseStatement(lex, isRoot) {
    return parseFunctionDeclaration(lex) ||
           isRoot && parseOperatorStatement(lex) ||
           isRoot && parseObjectDeclaration(lex) ||
           parseIf(lex) ||
           parseReturn(lex) ||
           isRoot && parseExport(lex) ||
           isRoot && parseImport(lex) ||
           parseSwitchType(lex) ||
           parseWhile(lex) ||
           parseDoWhile(lex) ||
           parseFor(lex) ||
           parseBreak(lex) ||
           parseContinue(lex) ||
           parseExpressionBase(lex);
}

/**
 * Parses an array of statements
 * @param  {Lexer} lex
 * @param  {string|string[]} endTokens
 * @param  {bool} isRoot
 * @return {array}
 */
function parseStatements(lex, endTokens, isRoot) {
    endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
    var statements = [];
    var temp = lex.peek();
    while (endTokens.indexOf(temp) === -1 &&
           (temp.type && endTokens.indexOf(temp.type) === -1)) {
        var statement = parseStatement(lex, isRoot);
        if (!statement) {
            throw new Error('Invalid statement');
        }
        temp = lex.peek();
        statements.push(statement);
    }
    return statements;
}

module.exports.node = node;
