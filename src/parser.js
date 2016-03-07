import BaseNode from './astNodes/BaseNode';
import * as nodes from './astNodes';
import * as symbols from './symbols';


/**
 * Turns an encoded string into its text content
 * @param  {string} input
 * @return {string}
 */
function parseString(input) {
    const stripped = input.substring(1, input.length - 1);

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
export default function parse(lex) {
    try {
        return new nodes.RootNode(
            parseStatements(lex, 'EOF', true),
            0,
            lex.pointer
        );
    } catch (e) {
        if (e instanceof SyntaxError && !e[symbols.ERR_MSG]) {
            e[symbols.ERR_MSG] = e.message;
            e[symbols.ERR_LINE] = lex.currentLine;
            e[symbols.ERR_COL] = lex.getColumn(lex.pointer);
        }
        throw e;
    }
};

function raiseSyntaxError(message, startIndex, endIndex) {
    const err = new SyntaxError(message);
    err[symbols.ERR_MSG] = message;
    err[symbols.ERR_START] = startIndex;
    err[symbols.ERR_END] = endIndex;
    throw err;
}

function parseFunctionDeclaration(lex, func) {
    if (!func && !(func = lex.accept('func'))) return;

    if (lex.peek().type === '<') {
        return parseDeclaration(lex, func);
    }

    let returnType = parseType(lex);
    let identifier = null;

    // If no return type is specified, swap the return type and name
    if (lex.accept(':')) {
        identifier = lex.assert('identifier').text;
    } else {
        identifier = returnType.name;
        returnType = null;
    }

    let parameters = [];
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

    const body = parseStatementsWithCatchesAndFinally(lex, '}');
    const end = lex.assert('}');

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
    const returnType = lex.peek().type === 'identifier' ? parseType(lex) : null;

    let parameters = [];
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

    const body = parseStatementsWithCatchesAndFinally(lex, '}');
    const end = lex.assert('}');

    return new nodes.FunctionNode(
        returnType,
        null,
        parameters,
        body,
        func.start,
        end.end
    );
}


function parseStatementsWithCatchesAndFinally(lex, stmts) {
    stmts = Array.isArray(stmts) ? stmts : [stmts];

    const body = parseStatements(
        lex,
        stmts.concat(['catch', 'finally'])
    ).concat(parseCatches(lex));

    if (lex.peek().type === 'finally') {
        body.push(parseFinally(lex));
    }

    return body;
}

function parseCatches(lex) {
    const result = [];
    while (true) {
        const catchStart = lex.accept('catch')
        if (!catchStart) {
            return result;
        }
        const ident = lex.accept('identifier');
        lex.assert('{');
        const body = parseStatements(lex, '}');
        const catchEnd = lex.assert('}');
        result.push(
            new nodes.CatchNode(
                new nodes.SymbolNode(ident.text, ident.start, ident.end),
                body,
                catchStart.start,
                catchEnd.end
            )
        );
    }
}
function parseFinally(lex) {
    const finallyStart = lex.assert('finally');
    lex.assert('{');
    const body = parseStatements(lex, '}');
    const finallyEnd = lex.assert('}');
    return new nodes.FinallyNode(
        body,
        finallyStart.start,
        finallyEnd.end
    );
}

function parseIf(lex) {
    const head = lex.accept('if');
    if (!head) return;
    const condition = parseExpression(lex);
    lex.assert('{');
    const body = parseStatements(lex, '}');
    let end = lex.assert('}');

    let alternate = null;
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
    const head = lex.accept('return');
    if (!head) return;
    const value = lex.peek().type !== ';' ? parseExpression(lex) : null;
    const end = lex.assert(';');
    return new nodes.ReturnNode(value, head.start, end.end);
}
function parseRaise(lex) {
    const head = lex.accept('raise');
    if (!head) return;
    const value = parseExpression(lex);
    const end = lex.assert(';');
    return new nodes.RaiseNode(value, head.start, end.end);
}
function parseExport(lex) {
    const head = lex.accept('export');
    if (!head) return;
    const value = lex.accept('identifier');
    const end = lex.assert(';');
    return new nodes.ExportNode(value.text, head.start, end.end);
}

function parseImport(lex) {
    const head = lex.accept('import');
    if (!head) return;

    function parseImportBase(lex, base) {
        if (lex.accept('.')) {
            const child = lex.assert('identifier');
            base = new nodes.MemberNode(base, child.text, base.start, child.end);
            return parseImportBase(lex, base);
        }
        return base;
    }
    const value = parseImportBase(lex, parseSymbol(lex));
    if (!(value instanceof nodes.MemberNode) && value instanceof nodes.MemberNode) {
        throw new SyntaxError('Unexpected import expression');
    } else if (value instanceof nodes.MemberNode && !(value.base instanceof nodes.SymbolNode)) {
        throw new SyntaxError('Cannot import complex expressions');
    }

    const valueIsMember = value instanceof nodes.MemberNode;
    const base = valueIsMember ? value.base : value;
    const member = valueIsMember ? value.child : null;

    const alias = lex.accept('as') ? parseSymbol(lex).name : null;
    const end = lex.assert(';');
    return new nodes.ImportNode(base.name, member, alias, head.start, end.end);
}

function parseWhile(lex) {
    const head = lex.accept('while');
    if (!head) return;
    const condition = parseExpression(lex);
    lex.assert('{');
    lex.loopDepth++;
    const body = parseStatements(lex, '}');
    lex.loopDepth--;
    const end = lex.assert('}');
    return new nodes.WhileNode(condition, body, head.start, end.end);
}
function parseDoWhile(lex) {
    const head = lex.accept('do');
    if (!head) return;
    lex.assert('{');
    lex.loopDepth++;
    const body = parseStatements(lex, '}');
    lex.loopDepth--;
    lex.assert('}');
    lex.assert('while');
    const condition = parseExpression(lex);
    const end = lex.assert(';');
    return new nodes.DoWhileNode(condition, body, head.start, end.end);
}
function parseFor(lex) {
    const head = lex.accept('for');
    if (!head) return;
    const assignment = parseAssignment(lex);
    const condition = parseExpression(lex);
    lex.assert(';');
    let iteration;
    if (lex.peek().type !== '{') {
        iteration = parseAssignment(lex);
    }
    lex.assert('{');
    lex.loopDepth++;
    const body = parseStatements(lex, '}');
    lex.loopDepth--;
    const end = lex.assert('}');
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
    const origType = type;
    if (type &&
        (!(type instanceof nodes.TypeNode) &&
         !(type instanceof nodes.TypeMemberNode))) {
        type = parseType(lex, type);
        if (origType.type === 'func') {
            lex.assert(':');
        }
    }

    const identifier = lex.assert('identifier');
    lex.assert('=');
    const value = parseExpression(lex);
    const end = lex.assert(';');
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
function parseAssignment(lex, base) {
    if (!base) {
        return parseExpressionBase(lex);
    }

    if (base && base instanceof nodes.CallNode) {
        throw new SyntaxError('Assignment to function call output');
    }

    lex.assert('=');
    const expression = parseExpression(lex);
    return new nodes.AssignmentNode(base, expression, base.start, expression.end);
}

function parseTypeCast(lex, base) {
    lex.assert('as');
    const type = parseType(lex);
    return new nodes.TypeCastNode(base, type, base.start, type.end);
}

function parseSignature(lex, typed, endToken, firstParam) {
    const params = [];
    if (lex.peek().type === endToken) return params;
    while (true) {
        if (typed) {
            params.push(parseTypedIdentifier(lex));
        } else {
            let temp = parseExpression(lex);
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
    const params = parseSignature(lex, false, ')');
    const end = lex.assert(')');
    return new nodes.CallNode(base, params, base.start, end.end);
}
function parseMember(lex, base) {
    lex.assert('.');
    const child = lex.assert('identifier');
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
    const operator = lex.next();
    const precedence = newPrec;
    const right = parseExpression(lex, null, precedence);
    return new nodes.BinopNode(left, operator.type, right, left.start, right.end);
}

function parseSubscript(lex, base) {
    lex.assert('[');
    const subscript = parseExpression(lex);
    const end = lex.assert(']');
    return new nodes.SubscriptNode(base, subscript, base.start, end.end);
}

function parseTuple(lex, base) {
    const content = [];
    do {
        content.push(parseExpression(lex));
    } while (lex.accept(','));

    const endBracket = lex.assert(']');
    return new nodes.TupleLiteralNode(content, base.start, endBracket.end);
}

function parseExpressionModifier(lex, base, precedence) {
    let part;
    const peeked = lex.peek();

    switch (peeked.type) {
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
            const newPrec = OPERATOR_PRECEDENCE[peeked.type];
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
        let parsed;
        switch (base.type) {
            case '(':
                if (lex.peek().type === ')') {
                    lex.assert(')');
                    lex.assert(':');
                    const exprBody = parseExpression(lex);
                    return new nodes.FunctionLambdaNode([], exprBody, base.start, exprBody.end);
                }

                parsed = parseExpression(lex);
                if (!(parsed instanceof nodes.SymbolNode)) {
                    lex.assert(')');
                    return parsed;
                }

                const args = [parsed];
                while (lex.accept(',')) {
                    args.push(parseSymbol(lex));
                }
                lex.assert(')');

                if (!lex.accept(':')) {
                    return parsed;
                }
                const exprBody = parseExpression(lex);
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
                const params = parseSignature(lex, false, ')');
                const closingParen = lex.assert(')');
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
    let next = parseNext(base || lex.next(), precedence);
    let prev;
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

    const type = base || lex.accept('func') || lex.assert('identifier');
    let typeEnd = type;
    const attributes = [];

    function parseAttributes() {
        if (type.type !== 'null' && lex.accept('<')) {
            if (typeEnd = lex.accept('>')) {
                return;
            } else if (typeEnd = lex.accept('>>')) {
                splitRShift();
                return;
            }
            do {
                attributes.push(parseType(lex, null, true));
            } while (lex.accept(','));
            if (typeEnd = lex.accept('>>')) {
                splitRShift();
            } else {
                typeEnd = lex.assert('>');
            }
        }
        function splitRShift() {
            const orig = typeEnd;
            typeEnd = orig.clone();

            orig.type = '>';
            orig.start += 1;
            orig.col += 1;

            typeEnd.type = '>';
            typeEnd.end -= 1;

            lex.unpeek(orig);
        }
    }
    parseAttributes();

    if (!attributes.length && lex.peek().type === '.') {
        let output = new nodes.SymbolNode(type.text, type.start, typeEnd.end);

        while (lex.accept('.')) {
            const member = lex.assert('identifier');
            output = new nodes.TypeMemberNode(output, member.text, [], output.start, member.end);
        }

        parseAttributes();
        output.attributes = attributes;
        return output;
    }
    return new nodes.TypeNode(type.text, attributes, type.start, typeEnd.end);

}

function parseTypedIdentifier(lex, base) {
    const type = parseType(lex, base);
    lex.assert(':');
    const ident = lex.assert('identifier');
    return new nodes.TypedIdentifierNode(type, ident.text, type.start, ident.end);
}

function parseExpressionBase(lex) {
    // This function recursively accumulates tokens until the proper node
    // can be determined.

    let base = lex.accept('func');
    // If the first token is `func`, we've got two options:
    // - Variable declaration: func<foo>:bar = ...
    // - Function declaration: func foo:bar()...
    // Fortunately, `parseFunctionDeclaration` does both of these for us.
    if (base) {
        return parseFunctionDeclaration(lex, base);
    }

    const peeked = lex.peek();
    // Another option is a paren, which allows its contents to be any valid
    // expression:
    //   (foo as Bar).member = ...
    //   (foo as Bar).method();
    if (peeked.type === '(') {
        lex.accept('(');
        const base = parseExpression(lex);
        lex.assert(')');
        return accumulate([base]);
    }

    // `var` and `const` are giveaways for a Declaration node.
    if (peeked.type === 'var' || peeked.type === 'const') {
        const temp = lex.next();
        return parseDeclaration(lex, null, temp.start, temp.type === 'const');
    }

    // At this point, the only valid token is an identifier.
    base = lex.assert('identifier');

    function convertStackToTypeMember(stack) {
        const bottomToken = stack.shift();
        let bottom = new nodes.SymbolNode(bottomToken.text, bottomToken.start, bottomToken.end);
        while (stack.length) {
            const token = stack.shift();
            bottom = new nodes.TypeMemberNode(bottom, token.text, [], bottom.start, token.end);
        }

        return bottom;
    }

    function convertStackToMember(stack) {
        const bottomToken = stack.shift();
        let bottom = bottomToken instanceof BaseNode ?
            bottomToken :
            new nodes.SymbolNode(bottomToken.text, bottomToken.start, bottomToken.end);
        while (stack.length) {
            const token = stack.shift();
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
        const peeked = lex.peek();
        if (peeked.type === ':') {
            // We've parsed the type of a declaration.
            const temp = base.length === 1 ?
                parseType(lex, base[0]) :
                convertStackToTypeMember(base);
            lex.assert(':'); // for sanity and to pop
            return parseDeclaration(lex, temp);
        } else if (peeked.type === '<') {
            // We've encountered the attributes chunk of a typed identifier.
            const temp = parseType(lex, base.length === 1 ? base[0] : convertStackToMember(base));
            lex.assert(':'); // for sanity and to pop
            return parseDeclaration(lex, temp);
        }
        if (peeked.type === '[') {
            const temp = convertStackToMember(base);
            lex.assert('[');
            const subscript = parseExpression(lex);
            const end = lex.assert(']');
            return accumulate([new nodes.SubscriptNode(temp, subscript, temp.start, end)]);
        }
        if (peeked.type === '(') {
            // We've hit a call or subscript. This means that we can defer
            // to the normal expression parse flow because it cannot be a
            // declaration:
            //   foo.bar() ...
            let temp = convertStackToMember(base);
            temp = parseExpression(lex, temp, 0);
            const semicolon = lex.assert(';');
            if (temp instanceof nodes.CallNode) {
                temp = new nodes.CallStatementNode(temp, temp.start, semicolon.end);
            }
            temp.end = semicolon.end;
            return temp;
        }
        if (peeked.type === '=') {
            // We've hit an assignment:
            //   foo.bar.zap = ...
            const temp = parseAssignment(lex, convertStackToMember(base));
            const semicolon = lex.assert(';');
            temp.end = semicolon.end;
            return temp;
        }
        throw new SyntaxError('Unexpected token "' + lex.peek().text + '"');
    }
    return accumulate([base]);
}

function parseBreak(lex) {
    const stmt = lex.accept('break');
    if (!stmt) {
        return;
    }
    if (!lex.loopDepth) {
        throw new Error('Cannot use `break` when not within a loop');
    }
    lex.assert(';');
    return new nodes.BreakNode(stmt.start, stmt.end);
}
function parseContinue(lex) {
    const stmt = lex.accept('continue');
    if (!stmt) {
        return;
    }
    if (!lex.loopDepth) {
        throw new Error('Cannot use `continue` when not within a loop');
    }
    lex.assert(';');
    return new nodes.ContinueNode(stmt.start, stmt.end);
}

function parseOperatorStatement(lex) {
    const operator = lex.accept('operator');
    if (!operator) return;

    lex.assert('(');
    const left = parseTypedIdentifier(lex);
    if (lex.accept('[')) {
        return parseOperatorStatementSubscript(lex, operator, left);
    }
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
            break;

        default:
            throw new Error(`Overriding invalid operator "${lex.peek().text}"`);
    }
    const binOp = lex.next().type;
    const right = parseTypedIdentifier(lex);

    lex.assert(')');

    const returnType = parseType(lex);

    lex.assert('{');
    const body = parseStatementsWithCatchesAndFinally(lex, '}');
    const endBrace = lex.assert('}');

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
    const right = parseTypedIdentifier(lex);
    lex.assert(']');
    lex.assert(')');

    const returnType = parseType(lex);

    lex.assert('{');
    const body = parseStatements(lex, '}');
    const endBrace = lex.assert('}');

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
    const obj = lex.accept('object');
    if (!obj) return;

    const name = lex.assert('identifier');

    const attributes = [];
    const definedAttributes = new Set();
    if (lex.accept('<')) {
        while (true) {
            const ident = lex.assert('identifier')
            const attrIdent = ident.text;
            if (definedAttributes.has(attrIdent)) {
                throw new SyntaxError(
                    `Cannot declare attribute "${attrIdent}" multiple times`
                );
            }

            attributes.push(
                new nodes.TypeNode(attrIdent, null, ident.start, ident.end)
            );
            definedAttributes.add(attrIdent);

            if (lex.accept('>')) {
                break;
            }
            lex.assert(',');
        }
    }

    lex.assert('{');

    let constructor = null;
    const members = [];
    const methods = [];
    const operatorStatements = [];

    while (lex.peek().type !== '}') {
        let methodSelfParam = null;

        const isPrivate = lex.accept('private');
        const isFinal = lex.accept('final');

        const constructorBase = lex.accept('new');
        if (constructorBase) {

            if (isPrivate) {
                throw new SyntaxError('Private constructors are not allowed');
            }

            if (isFinal) {
                throw new SyntaxError('Final constructors are not allowed');
            }

            if (constructor) {
                raiseSyntaxError(
                    'Cannot have multiple constructors in the same object declaration',
                    constructorBase.start,
                    constructorBase.end
                );
            }

            lex.assert('(');

            if (lex.accept('[')) {
                methodSelfParam = parseTypedIdentifier(lex);
                lex.assert(']');
            }

            const methodSignature = !methodSelfParam || lex.accept(',') ? parseSignature(lex, true, ')') : [];
            methodSignature.unshift(
                methodSelfParam || new nodes.TypedIdentifierNode(
                    new nodes.TypeNode(
                        name.text,
                        attributes,
                        0,
                        0
                    ),
                    'self',
                    0,
                    0
                )
            );

            lex.assert(')');
            lex.assert('{');
            const methodBody = parseStatementsWithCatchesAndFinally(lex, '}');
            const endBrace = lex.assert('}');

            constructor = new nodes.ObjectConstructorNode(
                methodSignature,
                methodBody,
                !!isFinal,
                isFinal ? isFinal.start : constructorBase.start,
                endBrace.end
            );

            continue;

        } else if (lex.peek().type === 'operator') {
            let tempOpStmt = parseOperatorStatement(lex);

            if (tempOpStmt.left.type.name !== name.text &&
                tempOpStmt.right.type.name !== name.text) {
                raiseSyntaxError(
                    `Operator overload for ${name.text} of "${tempOpStmt.operator}" must include ${name.text} in its declaration`,
                    tempOpStmt.start,
                    tempOpStmt.end
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

        const peekedType = lex.peek();
        let memberType = parseSymbol(lex);
        const memberStart = isPrivate ? isPrivate.start : isFinal ? isFinal.start : memberType.start;
        if (lex.peek().text === ':' || lex.peek().text === '<') {
            memberType = parseTypedIdentifier(lex, peekedType);
        }
        if (members.some(m => m.name === memberType.name) ||
            methods.some(m => m.name === memberType.name)) {
            raiseSyntaxError(
                `Class "${name.text}" cannot declare "${memberType.name}" more than once.`,
                memberStart,
                memberType.end
            );
        }

        if (memberType instanceof nodes.TypedIdentifierNode && lex.accept(';')) {
            members.push(
                new nodes.ObjectMemberNode(
                    memberType,
                    memberType.name,
                    null,
                    !!isFinal,
                    !!isPrivate,
                    memberStart,
                    memberType.end
                )
            );
            continue;
        } else if (lex.accept('(')) {
            if (lex.accept('[')) {
                methodSelfParam = parseTypedIdentifier(lex);
                lex.assert(']');
            }

            const methodSignature = !methodSelfParam || lex.accept(',') ? parseSignature(lex, true, ')') : [];
            methodSignature.unshift(
                methodSelfParam || new nodes.TypedIdentifierNode(
                    new nodes.TypeNode(
                        name.text,
                        attributes,
                        0,
                        0
                    ),
                    'self',
                    0,
                    0
                )
            );

            lex.assert(')');
            lex.assert('{');
            const methodBody = parseStatementsWithCatchesAndFinally(lex, '}');
            const methodEndBrace = lex.assert('}');

            methods.push(
                new nodes.ObjectMethodNode(
                    memberType instanceof nodes.TypedIdentifierNode ? memberType.type : null,
                    memberType.name,
                    methodSignature,
                    methodBody,
                    !!isFinal,
                    !!isPrivate,
                    memberStart,
                    methodEndBrace.end
                )
            );
            continue;
        }

        throw new SyntaxError('Unknown token in class definition "' + lex.peek().text + '"');

    }

    const endBrace = lex.assert('}');
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
    const start = lex.accept('switchtype');
    if (!start) {
        return null;
    }

    const expr = parseExpression(lex);
    lex.assert('{');

    const cases = [];
    while (true) {
        cases.push(parseSwitchTypeCase(lex));
        const end = lex.accept('}');
        if (end) {
            return new nodes.SwitchTypeNode(expr, cases, start.start, end.end);
        }
    }
}

/**
 * Parses a SwitchType's case statement
 * @param  {Lexer}
 * @return {SwitchTypeCase}
 */
function parseSwitchTypeCase(lex) {
    const start = lex.assert('case');
    const type = parseType(lex);
    lex.assert('{');

    const body = parseStatements(lex, '}', false);

    const end = lex.assert('}');
    return new nodes.SwitchTypeCaseNode(type, body, start.start, end.end);
}

/**
 * Parses a single statement
 * @param  {Lexer} lex
 * @param  {bool}
 * @return {*}
 */
function parseStatement(lex, isRoot = false) {
    return parseFunctionDeclaration(lex) ||
           isRoot && parseOperatorStatement(lex) ||
           isRoot && parseObjectDeclaration(lex) ||
           parseIf(lex) ||
           parseRaise(lex) ||
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
function parseStatements(lex, endTokens, isRoot = false) {
    endTokens = Array.isArray(endTokens) ? endTokens : [endTokens];
    const statements = [];
    let temp = lex.peek();
    while (endTokens.indexOf(temp) === -1 &&
           (temp.type && endTokens.indexOf(temp.type) === -1)) {
        let statement = parseStatement(lex, isRoot);
        if (!statement) {
            throw new Error('Invalid statement');
        }
        temp = lex.peek();
        statements.push(statement);
    }
    return statements;
}
