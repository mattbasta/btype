import * as nodes from './astNodes';


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
                throw new SyntaxError('Invalid escape code "' + b + '"');
        }
    });
}

/**
 * Parses a token stream into the AST
 * @param  {Lexer} lex
 * @return {*} The parsed AST
 */
module.exports = function parse(lex) {
    try {
        return new nodes.RootNode(
            parseStatements(lex, 'EOF', true),
            0,
            lex.pointer
        );
    } catch (e) {
        e.message += ' near line ' + lex.currentLine;
        throw e;
    }
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
        parameters.forEach(p => {
            if (p instanceof nodes.TypedIdentifierNode) return;
            throw new SyntaxError('Unexpected expression in function prototype "' + p.toString() + '"')
        });
        lex.assert(')');
    }
    lex.assert('{');

    var body = parseStatements(lex, '}');
    var end = lex.assert('}');

    return new nodes.FunctionNode(
        returnType,
        identifier,
        parameters,
        body,
        func.start,
        end.end
    );
}

function parseFunctionExpression(lex, func) {
    var returnType = null;

    if (lex.peek().type === 'identifier') {
        returnType = parseType(lex);
    }

    var parameters = [];
    // Parameter lists are optional.
    if (lex.accept('(')) {
        // If it's not an empty parameter list, start parsing.
        parameters = parseSignature(lex, true, ')');
        parameters.forEach(p => {
            if (p instanceof nodes.TypedIdentifierNode) return;
            throw new SyntaxError('Unexpected expression in function prototype "' + p.toString() + '"')
        });
        lex.assert(')');
    }
    lex.assert('{');

    var body = parseStatements(lex, '}');
    var end = lex.assert('}');

    return new nodes.FunctionNode(
        returnType,
        null,
        parameters,
        body,
        func.start,
        end.end
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
    return new nodes.IfNode(condition, body, alternate, head.start, end.end);
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
    return new nodes.ReturnNode(value, head.start, end.end);
}
function parseExport(lex) {
    var head = lex.accept('export');
    if (!head) return;
    var value = lex.accept('identifier');
    var end = lex.assert(';');
    return new nodes.ExportNode(value.text, head.start, end.end);
}

function parseImport(lex) {
    var head = lex.accept('import');
    if (!head) return;

    var value = parseSymbol(lex);
    function parseImportBase(lex, base) {
        var child;
        if (lex.accept('.')) {
            child = lex.assert('identifier');
            base = new nodes.MemberNode(base, child.text, base.start, child.end);
            return parseImportBase(lex, base);
        }
        return base;
    }
    value = parseImportBase(lex, value);
    if (!(value instanceof nodes.MemberNode) && value instanceof nodes.MemberNode) {
        throw new SyntaxError('Unexpected import expression');
    } else if (value instanceof nodes.MemberNode && !(value.base instanceof nodes.SymbolNode)) {
        throw new SyntaxError('Cannot import complex expressions');
    }

    var base = value;
    var member = null;
    if (base instanceof nodes.MemberNode) {
        base = value.base;
        member = value.child;
    }

    var alias = null;
    if (lex.accept('as')) {
        alias = parseSymbol(lex);
    }

    var end = lex.assert(';');
    return new nodes.ImportNode(base.name, member, alias, head.start, end.end);
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
    return new nodes.WhileNode(condition, body, head.start, end.end);
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
    return new nodes.DoWhileNode(condition, body, head.start, end.end);
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
    return new nodes.ForNode(
        assignment,
        condition,
        iteration || null,
        body,
        head.start,
        end.end
    );
}
function parseDeclaration(lex, type, start, isConst) {
    var origType = type;
    if (type &&
        (!(type instanceof nodes.TypeNode) &&
         !(type instanceof nodes.TypeMemberNode))) {
        type = parseType(lex, type);
        if (origType.type === 'func') {
            lex.assert(':');
        }
    }

    var identifier = lex.assert('identifier');
    lex.assert('=');
    var value = parseExpression(lex);
    var end = lex.assert(';');
    if (isConst) {
        return new nodes.ConstDeclarationNode(
            type || null,
            identifier.text,
            value,
            type ? type.start : start,
            end.end
        );
    } else {
        return new nodes.DeclarationNode(
            type || null,
            identifier.text,
            value,
            type ? type.start : start,
            end.end
        );
    }
}
function parseAssignment(lex, isExpression, base) {
    if (base && base instanceof nodes.CallNode) {
        throw new SyntaxError('Assignment to function call output');
    }

    if (!isExpression) {
        var expr = parseExpression(lex, base);
        expr.end = lex.assert(';').end;
        return expr;
    }

    lex.assert('=');
    var expression = parseExpression(lex);
    return new nodes.AssignmentNode(base, expression, base.start, expression.end);
}

function parseTypeCast(lex, base) {
    lex.assert('as');
    var type = parseType(lex);
    return new nodes.TypeCastNode(base, type, base.start, type.end);
}

function parseSignature(lex, typed, endToken, firstParam) {
    var params = [];
    if (lex.peek().type === endToken) return params;
    var temp;
    while (true) {
        if (typed) {
            params.push(parseTypedIdentifier(lex));
        } else {
            temp = parseExpression(lex);
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
    return new nodes.CallNode(base, params, base.start, end.end);
}
function parseMember(lex, base) {
    lex.assert('.');
    var child = lex.assert('identifier');
    return new nodes.MemberNode(base, child.text, base.start, child.end);
}

// https://github.com/mattbasta/btype/wiki/Operator-Precedence
const OPERATOR_PRECEDENCE = {
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

function parseOperator(lex, left, newPrec) {
    var operator = lex.next();
    var precedence = newPrec;
    var right = parseExpression(lex, null, precedence);
    return new nodes.BinopNode(left, operator.type, right, left.start, right.end);
}

function parseSubscript(lex, base) {
    lex.assert('[');
    var subscript = parseExpression(lex);
    var end = lex.assert(']');
    return new nodes.SubscriptNode(base, subscript, base.start, end.end);
}

function parseTuple(lex, base) {
    var endBracket;
    var content = [];
    do {
        content.push(parseExpression(lex));
    } while (lex.accept(','));

    endBracket = lex.assert(']');

    return new nodes.TupleLiteralNode(content, base.start, endBracket.end);
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
    return new nodes.SymbolNode(base.text, base.start, base.end);
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
                    lex.assert(')');
                    lex.assert(':');
                    exprBody = parseExpression(lex);
                    return new nodes.FunctionLambdaNode([], exprBody, base.start, exprBody.end);
                }

                parsed = parseExpression(lex);
                if (!(parsed instanceof nodes.SymbolNode)) {
                    lex.assert(')');
                    return parsed;
                }

                var args = [parsed];
                while (lex.accept(',')) {
                    args.push(parseSymbol(lex));
                }
                lex.assert(')');

                if (!lex.accept(':')) {
                    return parsed;
                }
                exprBody = parseExpression(lex);
                return new nodes.FunctionLambdaNode(args, exprBody, base.start, exprBody.end);
            case '[:':
                return parseTuple(lex, base);
            case 'true':
            case 'false':
                return new nodes.LiteralNode('bool', base.text === 'true', base.start, base.end);
            case 'null':
                return new nodes.LiteralNode('null', null, base.start, base.end);
            case 'sfloat':
                return new nodes.LiteralNode(base.type, base.text.substr(0, base.text.length - 1), base.start, base.end);
            case 'float':
            case 'int':
                return new nodes.LiteralNode(base.type, base.text, base.start, base.end);
            case 'str':
                return new nodes.LiteralNode(base.type, parseString(base.text), base.start, base.end);
            // Unary operators
            case '!':
            case '~':
                parsed = parseNext(lex.next(), 4);
                return new nodes.UnaryNode(base.type, parsed, base.start, parsed.end);
            case 'new':
                parsed = parseType(lex);
                lex.assert('(');
                var params = parseSignature(lex, false, ')');
                var closingParen = lex.assert(')');
                return new nodes.NewNode(parsed, params, parsed.start, closingParen.end);
            case 'identifier':
                return parseSymbol(lex, base);
            case 'func':
                return parseFunctionExpression(lex, base);
            default:
                if (base.isToken) {
                    throw new SyntaxError('Invalid token found while parsing expression: "' + base.text + '"');
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
        output = new nodes.SymbolNode(type.text, type.start, typeEnd.end);

        var member;
        while (lex.accept('.')) {
            member = lex.assert('identifier');
            output = new nodes.TypeMemberNode(output, member.text, [], output.start, member.end);
        }

        parseAttributes();
        output.attributes = attributes;
    } else {
        output = new nodes.TypeNode(type.text, attributes, type.start, typeEnd.end);
    }

    return output;
}

function parseTypedIdentifier(lex, base) {
    var type = parseType(lex, base);
    lex.assert(':');
    var ident = lex.assert('identifier');
    return new nodes.TypedIdentifierNode(type, ident.text, type.start, ident.end);
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
        var bottom = new nodes.SymbolNode(bottomToken.text, bottomToken.start, bottomToken.end);
        var token;
        while (stack.length) {
            token = stack.shift();
            bottom = new nodes.TypeMemberNode(bottom, token.text, [], bottom.start, token.end);
        }

        return bottom;
    }

    function convertStackToMember(stack) {
        var bottomToken = stack.shift();
        var bottom = new nodes.SymbolNode(bottomToken.text, bottomToken.start, bottomToken.end);
        var token;
        while (stack.length) {
            token = stack.shift();
            bottom = new nodes.MemberNode(bottom, token.text, bottom.start, token.end);
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
            if (temp instanceof nodes.CallNode) {
                temp = new nodes.CallStatementNode(temp, temp.start, semicolon.end);
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
        throw new SyntaxError('Unexpected token "' + lex.peek().text + '"');
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
    return new nodes.BreakNode(stmt.start, stmt.end);
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
    return new nodes.ContinueNode(stmt.start, stmt.end);
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
            throw new Error('Overriding invalid operator "' + lex.peek().text + '"');
    }
    var right = parseTypedIdentifier(lex);

    lex.assert(')');

    var returnType = parseType(lex);

    lex.assert('{');
    var body = parseStatements(lex, '}');
    var endBrace = lex.assert('}');

    return new nodes.OperatorStatementNode(
        returnType,
        left,
        binOp,
        right,
        body,
        operator.start,
        endBrace.end
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

    return new nodes.OperatorStatementNode(
        returnType,
        left,
        '[]',
        right,
        body,
        operator.start,
        endBrace.end
    );
}

function parseObjectDeclaration(lex) {
    var obj = lex.accept('object');
    if (!obj) return;

    var name = lex.assert('identifier');

    var attributes = [];
    if (lex.accept('<')) {
        while (true) {
            let ident = lex.assert('identifier')
            let attrIdent = ident.text;
            if (attributes.indexOf(attrIdent) !== -1) {
                throw new SyntaxError('Cannot declare attribute multiple times for the same object declaration');
            }

            attributes.push(new nodes.SymbolNode(attrIdent, ident.start, ident.end));

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
            methodSignature.unshift(
                methodSelfParam || new nodes.TypedIdentifierNode(
                    new nodes.TypeNode(name.text, [], 0, 0),
                    'self',
                    0,
                    0
                )
            );

            lex.assert(')');
            lex.assert('{');
            methodBody = parseStatements(lex, '}');
            endBrace = lex.assert('}');

            constructor = new nodes.ObjectConstructorNode(
                methodSignature,
                methodBody,
                !!isFinal,
                isFinal ? isFinal.start : constructorBase.start,
                endBrace.end
            );

            continue;

        } else if (lex.peek().type === 'operator') {
            var tempOpStmt = parseOperatorStatement(lex);

            if (tempOpStmt.left.type.name !== name.text &&
                tempOpStmt.right.type.name !== name.text) {
                throw new SyntaxError(
                    'Operator overload for ' + name.text + ' of "' + tempOpStmt.operator +
                    '" must include ' + name.text + ' in its declaration.'
                );
            }

            operatorStatements.push(
                new nodes.ObjectOperatorStatementNode(
                    tempOpStmt.returnType,
                    tempOpStmt.left,
                    tempOpStmt.operator,
                    tempOpStmt.right,
                    tempOpStmt.body,
                    tempOpStmt.start,
                    tempOpStmt.end
                )
            );
            continue;
        }

        peekedType = lex.peek();
        memberType = parseSymbol(lex);
        if (lex.peek().text === ':' || lex.peek().text === '<') {
            memberType = parseTypedIdentifier(lex, peekedType);
        }
        if (members.some(m => m.name === memberType.name) ||
            methods.some(m => m.name === memberType.name)) {
            console.log(memberType);
            console.log(members);
            console.log(methods);
            throw new SyntaxError('Class "' + name.text + '" cannot declare "' + memberType.name + '" more than once.');
        }

        if (memberType instanceof nodes.TypedIdentifierNode && lex.accept(';')) {
            members.push(
                new nodes.ObjectMemberNode(
                    memberType,
                    memberType.name,
                    null,
                    !!isFinal,
                    !!isPrivate,
                    isPrivate ? isPrivate.start : isFinal ? isFinal.start : memberType.start,
                    memberType.end
                )
            );
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
            methodSignature.unshift(
                methodSelfParam || new nodes.TypedIdentifierNode(
                    new nodes.TypeNode(name.text, [], 0, 0),
                    'self',
                    0,
                    0
                )
            );

            endBrace = lex.assert(')');
            lex.assert('{');
            methodBody = parseStatements(lex, '}');
            methodEndBrace = lex.assert('}');

            methods.push(
                new nodes.ObjectMethodNode(
                    memberType instanceof nodes.TypedIdentifierNode ? memberType.type : null,
                    memberType.name,
                    methodSignature,
                    methodBody,
                    !!isFinal,
                    !!isPrivate,
                    isPrivate ? isPrivate.start : isFinal ? isFinal.start : memberType.start,
                    methodEndBrace.end
                )
            );
            continue;
        }

        throw new SyntaxError('Unknown token in class definition "' + lex.peek().text + '"');

    }

    return new nodes.ObjectDeclarationNode(
        name.text,
        constructor,
        members,
        methods,
        attributes,
        operatorStatements,
        obj.start,
        endBrace.end
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

    return new nodes.SwitchTypeNode(expr, cases, start.start, end.end);
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
    return new nodes.SwitchTypeCaseNode(type, body, start.start, end.end);
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
