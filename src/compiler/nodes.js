var types = require('./types');

var Type = types.Type;


function binop_traverser(cb) {
    cb(this.left, 'left');
    cb(this.right, 'right');
}
function binop_substitution(cb) {
    this.left = cb(this.left, 'left') || this.left;
    this.right = cb(this.right, 'right') || this.right;
}
function loop_traverser(cb) {
    cb(this.condition, 'condition');
    this.loop.forEach(function(stmt) {cb(stmt, 'loop');});
}
function loop_substitution(cb) {
    this.condition = cb(this.condition, 'condition') || this.condition;
    this.loop = this.loop.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
}
function boolType() {
    return types.publicTypes.bool;
}
function loopValidator(ctx) {
    this.condition.validateTypes(ctx);
    this.loop.forEach(function(stmt) {stmt.validateTypes(ctx);});
}

function ident(arg) {return arg;}
function oneArg(func) {
    return function(arg) {func.call(this, arg);};
}

function indentEach(input, level) {
    level = level || 1;
    var indentation = '';
    while (level) {
        indentation += '    ';
        level--;
    }
    return input.split('\n').map(function(line) {
        return indentation + line;
    }).join('\n');
}


var NODES = {
    Root: {
        traverse: function(cb) {
            this.body.forEach(function(stmt) {
                cb(stmt, 'body');
            });
        },
        traverseStatements: function(cb) {
            cb(this.body, 'body');
        },
        substitute: function(cb) {
            this.body = this.body.map(function(stmt) {
                return cb(stmt, 'body');
            }).filter(ident);
        },
        validateTypes: function(ctx) {
            this.body.forEach(function(stmt) {
                stmt.validateTypes(ctx);
            });
        },
        toString: function() {
            return 'Root:\n' + indentEach(this.body.map(function(stmt) {
                return stmt.toString();
            }).join('\n')) + '\n';
        },
    },
    Unary: {
        traverse: function(cb) {
            cb(this.base);
        },
        substitute: function(cb) {
            this.base = cb(this.base, 'base') || this.base;
        },
        getType: function(ctx) {
            return this.operator === '-' ? this.base.getType(ctx) : boolType();
        },
        validateTypes: function(ctx) {
            this.base.validateTypes(ctx);
            if (this.operator === '-') {
                var baseType = this.base.getType(ctx);
                if (baseType.typeName !== 'int' && baseType.typeName !== 'float') {
                    throw new TypeError('Invalid type for unary minus: ' + baseType.toString());
                }
            }
        },
        toString: function() {
            return 'Unary(' + this.operator + '): ' + this.base.toString() + '\n';
        },
    },
    LogicalBinop: {
        traverse: binop_traverser,
        substitute: binop_substitution,
        getType: boolType,
        validateTypes: function(ctx) {
            this.left.validateTypes(ctx);
            this.right.validateTypes(ctx);
        },
        toString: function() {
            return 'LogicalBinop(' + this.operator + '):\n' +
                   '    Left:\n' +
                   indentEach(this.left.toString(), 2) + '\n' +
                   '    Right:\n' +
                   indentEach(this.right.toString(), 2) + '\n';
        },
    },
    EqualityBinop: {
        traverse: binop_traverser,
        substitute: binop_substitution,
        getType: boolType,
        validateTypes: function(ctx) {
            this.left.validateTypes(ctx);
            this.right.validateTypes(ctx);
            if (!this.left.getType(ctx).equals(this.right.getType(ctx))) {
                throw new TypeError('Equality operations may only be performed against same types');
            }
        },
        toString: function() {
            return 'EqualityBinop(' + this.operator + '):\n' +
                   '    Left:\n' +
                   indentEach(this.left.toString(), 2) + '\n' +
                   '    Right:\n' +
                   indentEach(this.right.toString(), 2) + '\n';
        },
    },
    RelativeBinop: {
        traverse: binop_traverser,
        substitute: binop_substitution,
        getType: boolType,
        validateTypes: function(ctx) {
            this.left.validateTypes(ctx);
            this.right.validateTypes(ctx);
            if (!this.left.getType(ctx).equals(this.right.getType(ctx))) {
                throw new TypeError('Comparison operations may only be performed against same types');
            }
        },
        toString: function() {
            return 'RelativeBinop(' + this.operator + '):\n' +
                   '    Left:\n' +
                   indentEach(this.left.toString(), 2) + '\n' +
                   '    Right:\n' +
                   indentEach(this.right.toString(), 2) + '\n';
        },
    },
    Binop: {
        traverse: binop_traverser,
        substitute: binop_substitution,
        getType: function(ctx) {
            return this.left.getType(ctx);
        },
        validateTypes: function(ctx) {
            this.left.validateTypes(ctx);
            this.right.validateTypes(ctx);
            var left = this.left.getType(ctx);
            var right = this.right.getType(ctx);
            if (!left.equals(right)) {
                throw new TypeError('Mismatched types in binop (' + this.operator + '): ' + left.toString() + ' != ' + right.toString());
            }
        },
        toString: function() {
            return 'Binop(' + this.operator + '):\n' +
                   '    Left:\n' +
                   indentEach(this.left.toString(), 2) + '\n' +
                   '    Right:\n' +
                   indentEach(this.right.toString(), 2) + '\n';
        },
    },
    CallStatement: {
        traverse: function(cb) {
            cb(this.base, 'base');
        },
        substitute: function(cb) {
            this.base = cb(this.base, 'base') || this.base;
        },
        getType: function(ctx) {
            return this.base.getType(ctx);
        },
        validateTypes: function(ctx) {
            this.base.validateTypes(ctx);
        },
        toString: function() {
            return 'CallStatement: ' + this.base.toString();
        },
    },
    CallRaw: {
        traverse: function(cb) {
            cb(this.callee, 'callee');
            this.params.forEach(oneArg(cb));
        },
        substitute: function(cb) {
            this.callee = cb(this.callee, 'callee') || this.callee;
            this.params = this.params.map(function(stmt) {
                return cb(stmt, 'params');
            }).filter(ident);
        },
        getType: function(ctx) {
            return this.callee.getType(ctx).getReturnType();
        },
        validateTypes: function(ctx) {
            this.callee.validateTypes(ctx);
            this.params.forEach(function(p) {p.validateTypes(ctx);});

            var base = this.callee.getType(ctx);

            // Ignore type checking on external (foreign) functions.
            if (base._type === '_stdlib') {
                return;
            }

            if (base._type !== 'func' && base._type !== '_foreign_curry') {
                throw new Error('Call to non-executable type: ' + base.toString());
            }

            var paramTypes = base.getArgs();
            if (this.params.length < paramTypes.length) {
                throw new TypeError('Too few arguments passed to function call');
            } else if (this.params.length < paramTypes.length) {
                throw new TypeError('Too many arguments passed to function call');
            }
            for (var i = 0; i < this.params.length; i++) {
                if (!this.params[i].getType(ctx).equals(paramTypes[i])) {
                    throw new TypeError('Wrong type passed as parameter to function call');
                }
            }
        },
        __getName: function() {
            return 'CallRaw';
        },
        toString: function() {
            return this.__getName() + ':\n' +
                   '    Base:\n' +
                   indentEach(this.callee.toString(), 2) + '\n' +
                   '    Args:\n' +
                   indentEach(this.params.map(function(param) {return param.toString()}).join('\n'), 2) + '\n';
        },
    },
    CallDecl: { // Calls a function declaration
        traverse: function(cb) {
            return NODES.CallRaw.traverse.call(this, cb);
        },
        substitute: function(cb) {
            return NODES.CallRaw.substitute.call(this, cb);
        },
        getType: function(ctx) {
            return NODES.CallRaw.getType.call(this, ctx);
        },
        validateTypes: function(ctx) {
            return NODES.CallRaw.validateTypes.call(this, ctx);
        },
        __getName: function() {
            return 'CallDecl';
        },
        toString: function() {
            return NODES.CallRaw.toString.call(this);
        },
    },
    CallRef: { // Calls a reference to a function
        traverse: function(cb) {
            return NODES.CallRaw.traverse.call(this, cb);
        },
        substitute: function(cb) {
            return NODES.CallRaw.substitute.call(this, cb);
        },
        getType: function(ctx) {
            return NODES.CallRaw.getType.call(this, ctx);
        },
        validateTypes: function(ctx) {
            return NODES.CallRaw.validateTypes.call(this, ctx);
        },
        __getName: function() {
            return 'CallRef';
        },
        toString: function() {
            return NODES.CallRaw.toString.call(this);
        },
    },
    FunctionReference: { // Wraps a symbol pointing at a function so that it can become a reference
        traverse: function(cb) {
            cb(this.base, 'base');
            cb(this.ctx, 'ctx');
        },
        substitute: function(cb) {
            this.base = cb(this.base, 'base') || this.base;
            this.ctx = cb(this.ctx, 'ctx') || this.ctx;
        },
        getType: function(ctx) {
            return this.base.getType(ctx);
        },
        validateTypes: function(ctx) {
            return this.base.validateTypes(ctx);
        },
        toString: function() {
            return 'FunctionReference(' + this.ctx.toString() + '):\n' +
                indentEach(this.base.toString()) + '\n';
        },
    },
    Member: {
        traverse: function(cb) {
            cb(this.base, 'base');
        },
        substitute: function(cb) {
            this.base = cb(this.base, 'base') || this.base;
        },
        getType: function(ctx) {
            var baseType = this.base.getType(ctx);
            if (!baseType.hasMember(this.child)) {
                throw new Error('Member not found for type "' + baseType.toString() + '": ' + this.child);
            }
            return baseType.getMemberType(this.child);
        },
        validateTypes: function(ctx) {
            var baseType = this.base.getType(ctx);
            if (!baseType.hasMember(this.child)) {
                throw new TypeError('Requesting incompatible member (' + this.child + ') from type');
            }
            this.base.validateTypes(ctx);
        },
        toString: function() {
            return 'Member(' + this.child + '):\n' +
                   indentEach(this.base.toString()) + '\n';
        },
    },
    Assignment: {
        traverse: function(cb) {
            cb(this.base, 'base');
            cb(this.value, 'value');
        },
        substitute: function(cb) {
            this.base = cb(this.base, 'base') || this.base;
            this.value = cb(this.value, 'value') || this.value;
        },
        getType: function(ctx) {
            return this.value.getType(ctx);
        },
        validateTypes: function(ctx) {
            var baseType = this.base.getType(ctx);
            var valueType = this.value.getType(ctx);
            if (!baseType.equals(valueType)) {
                throw new TypeError('Mismatched types in assignment: ' + baseType.toString() + ' != ' + valueType.toString());
            }
            this.value.validateTypes(ctx);
        },
        toString: function() {
            return 'Assignment:\n' +
                   '    Lval:\n' +
                   indentEach(this.base.toString(), 2) + '\n' +
                   '    Rval:\n' +
                   indentEach(this.value.toString(), 2) + '\n';
        },
    },
    Declaration: {
        traverse: function(cb) {
            if (this.declType) cb(this.declType, 'type');
            cb(this.value, 'value');
        },
        substitute: function(cb) {
            this.value = cb(this.value, 'value') || this.value;
        },
        getType: function(ctx) {
            return this.declType.getType(ctx);
        },
        validateTypes: function(ctx) {
            this.value.validateTypes(ctx);
            if (!this.declType) return;
            var declType = this.declType.getType(ctx);
            var valueType = this.value.getType(ctx);
            if (!valueType.equals(declType)) {
                throw new TypeError('Mismatched types in declaration: ' + declType.toString() + ' != ' + valueType.toString());
            }
        },
        toString: function() {
            return 'Declaration(' + this.identifier + (this.__assignedName ? '::' + this.__assignedName : '') + '):\n' +
                   (!this.declType ? '' :
                       '    Type:\n' +
                       indentEach(this.declType.toString(), 2) + '\n'
                    ) +
                   '    Value:\n' +
                   indentEach(this.value.toString(), 2);
        },
    },
    ConstDeclaration: {
        traverse: function(cb) {
            return NODES.Declaration.traverse.call(this, cb);
        },
        substitute: function(cb) {
            return NODES.Declaration.substitute.call(this, cb);
        },
        getType: function(ctx) {
            return NODES.Declaration.getType.call(this, ctx);
        },
        validateTypes: function(ctx) {
            var valueType = this.value.getType(ctx);
            if (valueType._type !== 'primitive') {
                throw new TypeError('Cannot assign non-primitive values to constants');
            }
            return NODES.Declaration.validateTypes.call(this, ctx);
        },
        toString: function() {
            return 'Const' + NODES.Declaration.toString.call(this);
        },
    },
    Return: {
        traverse: function(cb) {
            if (this.value) cb(this.value);
        },
        substitute: function(cb) {
            if (!this.value) return;
            this.value = cb(this.value, 'value') || this.value;
        },
        validateTypes: function(ctx) {
            this.value.validateTypes(ctx);
            var valueType = this.value.getType(ctx);
            var func = ctx.scope;
            var funcReturnType = func.returnType && func.returnType.getType(ctx);
            if (!!valueType !== !!funcReturnType) {
                throw new TypeError('Mismatched void/typed return type');
            }
            if (!funcReturnType.equals(valueType)) {
                throw new TypeError('Mismatched return type: ' + funcReturnType.toString() + ' != ' + valueType.toString());
            }
        },
        toString: function() {
            return 'Return:\n' +
                   indentEach(this.value.toString()) + '\n';
        },
    },
    Export: {
        traverse: function(cb) {
            cb(this.value);
        },
        substitute: function() {},
        validateTypes: function(ctx) {
            this.value.validateTypes(ctx);
            var valueType = this.value.getType(ctx);
            if (valueType._type !== 'func') {
                throw new TypeError('Cannot export non-executable objects');
            }
        },
        toString: function() {
            return 'Export:\n' +
                   indentEach(this.value.toString()) + '\n';
        },
    },
    Import: {
        traverse: function(cb) {
            cb(this.base, 'base');
            if (this.member) cb(this.member, 'member');
            if (this.alias) cb(this.alias, 'alias');
        },
        substitute: function() {},
        validateTypes: function(ctx) {
            // this.base.validateTypes(ctx);
            // if (this.member) this.member.validateTypes(ctx);
            // if (this.alias) this.alias.validateTypes(ctx);
        },
        toString: function() {
            return 'Import:\n' +
                   '    Base:\n' +
                   indentEach(this.base.toString(), 2) + '\n' +
                   (this.member ?
                    '    Member:\n' +
                    indentEach(this.member.toString(), 2) + '\n' : '') +
                   (this.alias ?
                    '    Alias:\n' +
                    indentEach(this.alias.toString(), 2) + '\n' : '');
        },
    },
    For: {
        traverseStatements: function(cb) {
            cb(this.loop, 'loop');
        },
        traverse: loop_traverser,
        substitute: loop_substitution,
        validateTypes: loopValidator,
        toString: function() {
            return 'For:\n' +
                   '    Assignment:\n' +
                   indentEach(this.assignment.toString(), 2) + '\n' +
                   '    Condition:\n' +
                   indentEach(this.condition.toString(), 2) + '\n' +
                   (this.iteration ?
                    '    Iteration:\n' +
                    indentEach(this.iteration.toString(), 2) + '\n' : '') +
                   '    Body:\n' +
                   indentEach(this.loop.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
        },
    },
    DoWhile: {
        traverseStatements: function(cb) {
            cb(this.loop, 'loop');
        },
        traverse: loop_traverser,
        substitute: loop_substitution,
        validateTypes: loopValidator,
        toString: function() {
            return 'DoWhile:\n' +
                   '    Condition:\n' +
                   indentEach(this.condition.toString(), 2) + '\n' +
                   '    Body:\n' +
                   indentEach(this.loop.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
        },
    },
    While: {
        traverseStatements: function(cb) {
            cb(this.loop, 'loop');
        },
        traverse: loop_traverser,
        substitute: loop_substitution,
        validateTypes: loopValidator,
        toString: function() {
            return 'While:\n' +
                   '    Condition:\n' +
                   indentEach(this.condition.toString(), 2) + '\n' +
                   '    Body:\n' +
                   indentEach(this.loop.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
        },
    },
    Switch: {
        traverse: function(cb) {
            cb(this.condition, 'condition');
            this.cases.forEach(oneArg(cb));
        },
        substitute: function(cb) {
            this.condition = cb(this.condition, 'condition') || this.condition;
            this.cases = this.cases.map(function(case_) {
                return cb(case_, 'case');
            }).filter(ident);
        },
        validateTypes: function(ctx) {
            this.cases.forEach(function(c) {
                c.validateTypes(ctx);
            });
        },
        toString: function() {
            return 'Switch(' + this.condition.toString() + '):\n' +
                   indentEach(this.cases.map(function(stmt) {return stmt.toString();}).join('\n'));
        },
    },
    Case: {
        traverse: function(cb) {
            cb(this.value, 'value');
            this.body.forEach(function(stmt) {
                cb(stmt, 'body');
            });
        },
        traverseStatements: function(cb) {
            cb(this.body, 'body');
        },
        substitute: function(cb) {
            this.value = cb(this.value, 'value') || this.value;
            this.body = this.body.map(function(stmt) {
                return cb(stmt, 'stmt');
            }).filter(ident);
        },
        validateTypes: function(ctx) {
            this.body.forEach(function(stmt) {
                stmt.validateTypes(ctx);
            });
        },
        toString: function() {
            return 'Case(' + this.value.toString() + '):\n' +
                   indentEach(this.body.map(function(stmt) {return stmt.toString()}).join('\n'));
        },
    },
    If: {
        traverse: function(cb) {
            cb(this.condition, 'condition');
            this.consequent.forEach(function(stmt) {
                cb(stmt, 'consequent');
            });
            if (this.alternate) {
                this.alternate.forEach(function(stmt) {
                    cb(stmt, 'alternate');
                });
            }
        },
        traverseStatements: function(cb) {
            cb(this.consequent, 'consequent');
            cb(this.alternate, 'alternate');
        },
        substitute: function(cb) {
            this.condition = cb(this.condition, 'condition') || this.condition;
            this.consequent = this.consequent.map(function(stmt) {
                return cb(stmt, 'consequent');
            }).filter(ident);
            if (!this.alternate) return;
            this.alternate = this.alternate.map(function(stmt) {
                return cb(stmt, 'alternate');
            }).filter(ident);
        },
        validateTypes: function(ctx) {
            this.condition.validateTypes(ctx);
            if(!this.condition.getType(ctx).equals(boolType()))
                throw new TypeError('Unexpected type passed as condition');
            this.consequent.forEach(function(stmt) {
                stmt.validateTypes(ctx);
            });
            if (this.alternate) {
                this.alternate.forEach(function(stmt) {
                    stmt.validateTypes(ctx);
                });
            }
        },
        toString: function() {
            return 'If:\n' +
                   '    Condition:\n' +
                   indentEach(this.condition.toString(), 2) + '\n' +
                   '    Consequent:\n' +
                   indentEach(this.consequent.map(function(stmt) {return stmt.toString()}).join('\n'), 2) +
                   (!this.alternate ? '' :
                       '\n    Alternate:\n' +
                       indentEach(this.alternate.map(function(stmt) {return stmt.toString()}).join('\n'), 2)
                    );
        },
    },
    Function: {
        traverse: function(cb) {
            if (this.returnType)
                cb(this.returnType, 'return');

            this.body.forEach(function(stmt) {
                cb(stmt, 'body');
            });
        },
        traverseStatements: function(cb) {
            cb(this.body, 'body');
        },
        substitute: function(cb) {
            this.body = this.body.map(function(stmt) {
                return cb(stmt, 'stmt');
            }).filter(ident);
        },
        getType: function(ctx) {
            if (this.__originalType) {
                return this.__originalType;
            }
            var returnType = this.returnType ? this.returnType.getType(ctx) : null;
            return new types.Func(
                returnType,
                this.params.map(function(p) {
                    return p.getType(ctx);
                })
            );
        },
        validateTypes: function(ctx) {
            var context = this.__context;
            this.body.forEach(function(stmt) {
                stmt.validateTypes(context);
            });
        },
        toString: function() {
            return 'Function ' + this.name + (this.__assignedName ? '::' + this.__assignedName : '') +
                       '(' + this.params.map(function(param) {return param.toString();}).join(', ') + ') ' +
                       (this.returnType ? this.returnType.toString() : 'void') + '\n' +
                   indentEach(this.body.map(function(stmt) {return stmt.toString()}).join('\n'));
        },
    },
    Type: {
        traverse: function(cb) {
            if (this.traits) this.traits.forEach(oneArg(cb));
        },
        substitute: function() {},
        getType: function(ctx) {
            if (this.__type) {
                return this.__type;
            }

            if (this.name === 'func') {
                return this.__type = new types.Func(
                    this.traits[0] && this.traits[0].getType(ctx),
                    this.traits.slice(1).map(function(trait) {
                        return trait.getType(ctx);
                    })
                );
            } else if (this.name === 'array') {
                return this.__type = new types.Array_(this.traits[0].getType(ctx));
            }

            return this.__type = ctx.resolveType(this.name);
        },
        validateTypes: function() {},
        toString: function() {
            return '<' + this.name + (this.traits.length ? '; ' + this.traits.map(function(trait) {return trait ? trait.toString() : 'null';}).join(', ') : '') + '>';
        },
    },
    TypedIdentifier: {
        traverse: function(cb) {
            cb(this.idType);
        },
        substitute: function() {},
        getType: function(ctx) {
            return this.idType.getType(ctx);
        },
        validateTypes: function() {},
        toString: function() {
            return 'TypedId(' + this.name + ': ' + this.idType.toString() + ')';
        },
    },
    Literal: {
        traverse: function(cb) {},
        substitute: function() {},
        getType: function() {
            return types.resolve(this.litType);
        },
        validateTypes: function() {},
        toString: function() {
            return 'Literal(' + this.value + ')';
        },
    },
    Symbol: {
        traverse: function(cb) {},
        substitute: function() {},
        getType: function(ctx) {
            if (this.__refType) return this.__refType;
            var objContext = ctx.lookupVar(this.name);
            return objContext.typeMap[this.__refName];
        },
        validateTypes: function() {},
        toString: function() {
            return 'Symbol(' + this.name + (this.__refName ? '::' + this.__refName : '') + ')';
        },
    },
    New: {
        traverse: function(cb) {
            if (this.newType && this.newType.type)
                cb(this.newType);
            this.params.forEach(oneArg(cb));
        },
        substitute: function(cb) {
            this.callee = cb(this.callee, 'callee') || this.callee;
            this.params = this.params.map(function(stmt) {
                return cb(stmt, 'params');
            }).filter(ident);
        },
        getType: function(ctx) {
            return this.newType.getType(ctx);
        },
        validateTypes: function() {
            // TODO: Check that the params match the params of the constructor
        },
        toString: function() {
            return 'New: ' + this.newType.toString() + '\n' +
                   indentEach(this.params.map(function(stmt) {return stmt.toString();}).join('\n'), 1);
        },
    },

    Break: {
        traverse: function() {},
        substitute: function() {},
        getType: function() {return null;},
        validateTypes: function() {},
        toString: function() {
            return 'Break';
        },
    },
    Continue: {
        traverse: function() {},
        substitute: function() {},
        getType: function() {return null;},
        validateTypes: function() {},
        toString: function() {
            return 'Continue';
        },
    },

    OperatorStatement: {
        traverse: function(cb) {
            cb(this.left, 'left');
            cb(this.right, 'right');
            cb(this.returnType, 'returnType');
            this.body.forEach(function(stmt) {
                cb(stmt, 'body');
            });
        },
        substitute: function(cb) {
            this.left = cb(this.left, 'left') || this.left;
            this.right = cb(this.right, 'right') || this.right;
            this.returnType = cb(this.returnType, 'returnType') || this.returnType;
            this.body = this.body.map(function(stmt) {
                return cb(stmt, 'body');
            }).filter(ident);
        },
        getType: function() {
            if (this.__originalType) {
                return this.__originalType;
            }
            var returnType = this.returnType ? this.returnType.getType(ctx) : null;
            return new types.Func(
                returnType,
                [
                    this.left.getType(),
                    this.left.getType(),
                ]
            );
        },
        validateTypes: function() {
            var context = this.__context;
            this.body.forEach(function(stmt) {
                stmt.validateTypes(context);
            });
        },
        toString: function() {
            return 'Operator(' + this.operator + '): ' + this.returnType.toString() + '\n' +
                '    Left: ' + this.left.toString() + '\n' +
                '    Right: ' + this.right.toString() + '\n' +
                '    Body:\n' +
                indentEach(this.body.map(function(stmt) {return stmt.toString()}).join('\n'), 2);
        },
    },
};

function buildNode(proto, name) {
    function node(start, end, base) {
        // Allow non-positional shorthand
        if (start && typeof start !== 'number') {
            base = start;
            start = 0;
            end = 0;
        }

        this.start = start;
        this.end = end;
        this.__base = base;
        for (var prop in base) {
            this[prop] = base[prop];
        }
    }
    for(var protoMem in proto) {
        node.prototype[protoMem] = proto[protoMem];
    }
    node.prototype.type = name;
    node.prototype.clone = function() {
        var out = new node(
            this.start,
            this.end,
            {}
        );
        for (var item in this.__base) {
            if (this.__base[item].clone) {
                out[item] = this.__base[item].clone();
            } else {
                out[item] = this.__base[item];
            }
            out.__base[item] = out[item];
        }
    };
    return node;
}

var preparedNodes = module.exports = {};
for(var node in NODES) {
    preparedNodes[node] = buildNode(NODES[node], node);
}
