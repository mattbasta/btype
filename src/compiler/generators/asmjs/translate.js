var types = require('../../types');


function TranslationContext(env, ctx) {
    this.env = env;
    this.ctx = ctx;

    this.outputStack = [''];
    this.countStack = [0];
    this.indentation = '';

    this.uniqCounter = 0;

    this.push = function() {
        this.outputStack.unshift('');
        this.countStack.unshift(this.countStack[0]);
        this.indentation += '    ';
    };

    this.pop = function() {
        var popped = this.outputStack.shift();
        this.outputStack[0] += popped;
        this.countStack.shift();
        this.indentation = this.indentation.substr(4);
    };

    this.write = function(data, noIndent) {
        this.outputStack[0] += (noIndent ? '' : this.indentation) + data + '\n';
    };

    this.prepend = function(data, noIndent) {
        this.outputStack[0] = (noIndent ? '' : this.indentation) + data + '\n' + this.outputStack[0];
    };

    this.toString = function() {
        if (this.outputStack.length > 1) {
            throw new Error('Leaking output in asm.js generator');
        }
        return this.outputStack[0];
    };

}

var HEAP_MODIFIERS = {
    memheap: '>>0',
    intheap: '>>2',
    ptrheap: '>>2',
    sfloatheap: '>>2',
    floatheap: '>>3',
};

function trimSemicolon(inp) {
    inp = inp.trim();
    if (inp[inp.length - 1] === ';') {
        inp = inp.substr(0, inp.length - 1);
    }
    return inp;
}

function _binop(env, ctx, tctx) {
    var out;
    var left = typeAnnotation(_node(this.left, env, ctx, tctx), this.left.getType(ctx));
    var right = typeAnnotation(_node(this.right, env, ctx, tctx), this.right.getType(ctx));

    var leftType = this.left.getType(ctx).flatTypeName();
    var rightType = this.right.getType(ctx).flatTypeName();
    if (ctx.env.registeredOperators[leftType] &&
        ctx.env.registeredOperators[leftType][rightType] &&
        ctx.env.registeredOperators[leftType][rightType][this.operator]) {

        var operatorStmtFunc = ctx.env.registeredOperators[leftType][rightType][this.operator];
        out = operatorStmtFunc + '(' + left + ',' + right + ')';
        return typeAnnotation(out, ctx.env.registeredOperatorReturns[operatorStmtFunc]);
    }

    switch (this.operator) {
        case 'and':
        case 'or':
            throw new Error('Unconverted logical binop!');
        case '*':
            if (this.left.getType(ctx) === types.publicTypes.int &&
                this.right.getType(ctx) === types.publicTypes.int) {

                out = '(imul(' + left + ', ' + right + ')|0)';
                break;
            }
        default:
            if (this.left.type !== 'Literal') left = '(' + typeAnnotation(left, this.left.getType(ctx)) + ')';
            if (this.right.type !== 'Literal') right = '(' + typeAnnotation(right, this.right.getType(ctx)) + ')';
            out = left + ' ' + this.operator + ' ' + right;
    }

    return typeAnnotation(out, this.getType(ctx));
}

function _node(node, env, ctx, tctx, extra) {
    return NODES[node.type].call(node, env, ctx, tctx, extra);
}

function heapName(type) {
    var typedArr = 'ptrheap';
    if (type.typeName === 'float') typedArr = 'floatheap';
    else if (type.typeName === 'sfloat') typedArr = 'sfloatheap';
    else if (type.typeName === 'byte') typedArr = 'memheap';
    else if (type.typeName === 'bool') typedArr = 'memheap';
    else if (type.typeName === 'int') typedArr = 'intheap';
    return typedArr;
}

function typeAnnotation(base, type) {
    if (!type) return base;
    if (/^\-?[\d\.]+$/.exec(base)) return base;

    var origBase = base;
    base = '(' + base + ')';

    switch (type.typeName) {
        case 'sfloat':
            return 'fround' + base + '';
        case 'float':
            if (origBase[0] === '+') return base;
            return '+' + base;
        case 'byte':
        case 'int':
        case 'uint':
        default:
            if (origBase.substr(-2) === '|0') return base;
            return base + '|0';
    }

}

function getFunctionDerefs(ctx, exclude) {
    var output = '';
    var params;
    if (ctx.scope.type === 'Function') {
        params = ctx.scope.params.map(function(p) {
            return p.__assignedName;
        });
    } else {
        params = [
            ctx.scope.left.__assignedName,
            ctx.scope.right.__assignedName,
        ];
    }
    Object.keys(ctx.typeMap).forEach(function(name) {
        var type = ctx.typeMap[name];
        if (type._type === 'primitive') return;

        // Ignore returned symbols
        if (exclude && exclude.type === 'Symbol' && exclude.__refName === name) return;

        // Ignore recursion
        if (exclude && exclude.type === 'Symbol' && exclude.__refName === ctx.scope.__assignedName) {
            return;
        }

        // Ignore parameters
        if (params.indexOf(name) !== -1) return;

        output += 'gcderef(' + name + ');\n';
    });

    return output;
}


var NODES = {
    Root: function(env, ctx, tctx) {
        env.__globalPrefix = '';
        env.__stdlibRequested = {};
        env.__foreignRequested = {};
        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });
        tctx.prepend(env.__globalPrefix);
        delete env.__globalPrefix;
        delete env.__stdlibRequested;
        delete env.__foreignRequested;
    },
    Unary: function(env, ctx, tctx) {
        var out = typeAnnotation(_node(this.base, env, ctx, tctx), this.base.getType(ctx));
        if (this.operator === '~') {
            out = '(~' + out + ')';
        } else if (this.operator === '!') {
            out = '!(' + typeAnnotation(out, types.publicTypes.int) + ')';
        }
        return out;
    },
    LogicalBinop: _binop,
    EqualityBinop: _binop,
    RelativeBinop: _binop,
    Binop: _binop,
    CallStatement: function(env, ctx, tctx) {
        var output = _node(this.base, env, ctx, tctx);

        if (this.base.getType(ctx)._type !== 'primitive') {
            output = 'gcderef(' + output + ')';
        }

        tctx.write(output + ';');
    },
    CallRaw: function(env, ctx, tctx) {
        return typeAnnotation(_node(this.callee, env, ctx, tctx) + '(/* CallRaw */' +
            this.params.map(function(param) {
                return typeAnnotation(_node(param, env, ctx, tctx), param.getType(ctx));
            }).join(',') +
            ')', this.getType(ctx));
    },
    CallDecl: function(env, ctx, tctx) {
        return typeAnnotation('(' +
            typeAnnotation(
                _node(this.callee, env, ctx, tctx) +
                    '(/* CallDecl */' +
                    this.params.map(function(param) {
                        return typeAnnotation(_node(param, env, ctx, tctx), param.getType(ctx));
                    }).join(',') +
                    ')',
                this.callee.getType(ctx).getReturnType()
            ) +
            ')', this.getType(ctx));
    },
    CallRef: function(env, ctx, tctx) {
        var funcType = this.callee.getType(ctx);
        var listName = env.getFuncListName(funcType);

        var paramList = this.params.map(function(param) {
            return typeAnnotation(_node(param, env, ctx, tctx), param.getType(ctx));
        }).join(',');

        var isMethodCall = funcType.__isMethod;

        var temp;
        if (this.callee.type === 'Member' &&
            (temp = this.callee.base.getType(ctx)).hasMethod &&
            temp.hasMethod(this.callee.child)) {

            return typeAnnotation(
                temp.getMethod(this.callee.child) + '(/* CallRef:Method */' +
                _node(this.callee.base, env, ctx, tctx) + '|0' +
                (this.params.length ? ',' + paramList : '') +
                ')',
                funcType.getReturnType()
            );
        }

        if (env.funcList[listName].length === 1) {
            return typeAnnotation('(' +
                typeAnnotation(
                    env.funcList[listName][0] + '(/* CallRef;Compacted */' +
                    (isMethodCall ? 'ptrheap[(' + _node(this.callee, env, ctx, tctx) + ' + 4) >> 2]|0' : '') +
                    (isMethodCall && this.params.length ? ',' : '') +
                    paramList +
                    ')',
                    funcType.getReturnType()
                ) +
                ')', this.getType(ctx));
        }

        return typeAnnotation('(' +
            typeAnnotation(
                listName + '$$call(/* CallRef */' +
                    _node(this.callee, env, ctx, tctx) +
                    (this.params.length ? ',' : '') +
                    paramList + ')',
                funcType.getReturnType()
            ) +
            ')', this.getType(ctx));
    },
    FunctionReference: function(env, ctx, tctx) {
        var funcName = this.base.__refName;
        var funcType = this.base.getType(ctx);
        var listName = env.getFuncListName(funcType);

        // TODO: Optimize this for the case that there is only one function in
        // the table.

        if (!this.ctx) {
            return '((getfuncref(' + this.base.__refIndex + ', 0)|0) | 0)';
        }

        return '((getfuncref(' + this.base.__refIndex + ', ' + typeAnnotation(_node(this.ctx, env, ctx, tctx), this.ctx.getType(ctx)) + ')|0) | 0)';
    },
    Member: function(env, ctx, tctx, parent) {
        var baseType = this.base.getType(ctx);
        if (baseType._type === 'module') {
            return baseType.memberMapping[this.child];
        }

        if (baseType._type === '_stdlib') {
            var stdlibName = baseType.name + '.' + this.child;
            if (stdlibName in env.__stdlibRequested) {
                return env.__stdlibRequested[stdlibName];
            }
            var stdlibAssignedName = env.namer();
            env.__globalPrefix += 'var ' + stdlibAssignedName + ' = stdlib.' + stdlibName + ';\n';
            env.__stdlibRequested[stdlibName] = stdlibAssignedName;
            return stdlibAssignedName;
        }

        if (baseType._type === '_foreign') {
            env.foreigns.push(this.child);
            var foreignName = 'foreign.' + this.child;
            if (this.child in env.__foreignRequested) {
                return env.__foreignRequested[this.child];
            }

            var foreignAssignedName = env.namer();
            env.__globalPrefix += 'var ' + foreignAssignedName + ' = foreign.' + this.child + ';\n';
            env.__foreignRequested[stdlibName] = foreignAssignedName;
            return foreignAssignedName;
        }

        if (baseType._type === '_foreign_curry') {
            return typeAnnotation(_node(this.base, env, ctx, tctx), this.getType(ctx));
        }

        var base = '(' + typeAnnotation(_node(this.base, env, ctx, tctx), this.base.getType(ctx)) + ')';

        if ((baseType._type === 'string' || baseType._type === 'array') && this.child === 'length') {
            return '(ptrheap[' + base + ' + 8 >> 2]|0)';
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            var objectMethodFunc = ctx.lookupFunctionByName(baseType.getMethod(this.child));
            var objectMethodFuncIndex = env.registerFunc(objectMethodFunc);
            return '((getboundmethod(' + objectMethodFuncIndex + ', ' + typeAnnotation(_node(this.base, env, ctx, tctx), this.base.getType(ctx)) + ')|0) | 0)';
        }

        var layout = baseType.getLayout();
        var childType = this.getType(ctx);
        var typedArr = 'ptrheap';
        if (childType.typeName === 'float') typedArr = 'floatheap';
        if (childType.typeName === 'sfloat') typedArr = 'sfloatheap';
        else if (childType.typeName === 'byte') typedArr = 'memheap';
        else if (childType.typeName === 'bool') typedArr = 'memheap';
        else if (childType.typeName === 'int') typedArr = 'intheap';

        var lookup = typedArr + '[(' + base + ' + (' + (layout[this.child] + 8) + '))' + HEAP_MODIFIERS[typedArr] + ']';
        if (parent !== 'Assignment' && parent !== 'Return') {
            lookup = typeAnnotation(lookup, childType);
        }
        return lookup;
    },
    Assignment: function(env, ctx, tctx) {
        var baseContent = typeAnnotation(_node(this.value, env, ctx, tctx, 'Assignment'), this.value.getType(ctx));

        var valueType = this.value.getType(ctx);
        if (valueType._type !== 'primitive') {
            baseContent = '(gcref((' + baseContent + ')|0)|0)';
        }
        tctx.write(_node(this.base, env, ctx, tctx, 'Assignment') + ' = ' + baseContent + ';');
    },
    Declaration: function(env, ctx, tctx) {
        var type = this.value.getType(ctx);
        var output = 'var ' + this.__assignedName + ' = ';

        if (this.value.type === 'Literal') {
            output += (this.value.value || '0').toString() + ';';
            tctx.write(output);
            return;
        }

        var def = (type && type.typeName === 'float') ? '0.0' : '0';
        output += def + ';\n';

        tctx.write(output);
        tctx.write(this.__assignedName + ' = ' + _node(this.value, env, ctx, tctx) + ';');
    },
    ConstDeclaration: function() {
        return NODES.Declaration.apply(this, arguments);
    },
    Return: function(env, ctx, tctx) {
        tctx.write(getFunctionDerefs(ctx, this.value));

        if (!this.value) {
            if (ctx.scope.__objectSpecial === 'constructor') {
                tctx.write('return ' + ctx.scope.params[0].__assignedName + ';');
                return;
            }
            tctx.write('return;');
            return;
        }

        tctx.write('return ' + typeAnnotation(_node(this.value, env, ctx, tctx, 'Return'), this.value.getType(ctx)) + ';');
    },
    Export: function() {},
    Import: function() {},
    For: function(env, ctx, tctx) {
        // FIXME: Make this valid asm
        tctx.write(
            'for (' +
            _node(this.assignment, env, ctx, tctx) +
            _node(this.condition, env, ctx, tctx) + ';' +
            trimSemicolon(this.iteration ? _node(this.iteration, env, ctx, tctx) : '') +
            ') {'
        );
        tctx.push();
        this.body.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
        tctx.write('}');
    },
    DoWhile: function(env, ctx, tctx) {
        // FIXME: Make this valid asm
        tctx.write(
            'do {'
        );
        tctx.push();
        this.body.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
        tctx.write('} while (' + _node(this.condition, env, ctx, tctx) + ');');
    },
    While: function(env, ctx, tctx) {
        // FIXME: Make this valid asm
        tctx.write('while (' + _node(this.condition, env, ctx, tctx) + ') {');
        tctx.push();
        this.body.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
        tctx.write('}');
    },
    Switch: function(env, ctx, tctx) {
        tctx.write('switch (' + _node(this.condition, env, ctx, tctx) + ') {');
        tctx.push();
        this.cases.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
        tctx.write('}');
    },
    Case: function(env, ctx, tctx) {
        tctx.write('case ' + _node(this.value, env, ctx, tctx) + ':');
        tctx.push();
        this.body.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
    },
    If: function(env, ctx, tctx) {
        tctx.write('if (' + _node(this.condition, env, ctx, tctx) + ') {');
        tctx.push();
        this.consequent.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });
        tctx.pop();
        if (this.alternate) {
            tctx.write('} else {');
            tctx.push();
            this.alternate.forEach(function(x) {
                _node(x, env, ctx, tctx);
            });
            tctx.pop();
        }
        tctx.write('}');
    },
    Function: function(env, _, tctx, parent) {
        var ctx = this.__context;

        tctx.write(
            'function ' + this.__assignedName + '(' +
            this.params.map(function(param) {
                return _node(param, env, ctx, tctx);
            }).join(',') +
            ') {'
        );
        if (this.name) {
            tctx.write('/* ' + this.name + ' */');
        }

        tctx.push();

        // asm.js parameter annotations
        if (this.params.length) {
            this.params.forEach(function(param) {
                var paramType = param.getType(ctx);
                tctx.write(param.__assignedName + ' = ' + typeAnnotation(param.__assignedName, paramType) + ';');
            });
        }

        this.body.forEach(function(x) {
            _node(x, env, ctx, tctx);
        });

        var returnType = this.getType(ctx).getReturnType();
        var hasReturnStatement = this.body.length && this.body[this.body.length - 1].type === 'Return';
        if (returnType && !hasReturnStatement) {
            tctx.write(getFunctionDerefs(ctx));
            if (returnType.typeName === 'float' ||
                returnType.typeName === 'sfloat') {
                tctx.write('return 0.0;');
            } else {
                tctx.write('return 0;');
            }

        } else if (!returnType && this.__objectSpecial === 'constructor') {
            tctx.write(getFunctionDerefs(ctx));
            // Constructors always are "void", but the implementation always
            // returns the pointer to the initialized object.
            tctx.write('return ' + this.params[0].__assignedName + ' | 0;');

        } else if (!hasReturnStatement) {
            tctx.write(getFunctionDerefs(ctx));
        }


        tctx.pop();
        tctx.write('}');
    },
    OperatorStatement: function(env, ctx, tctx) {
        var ctx = this.__context;

        tctx.write(
            'function ' + this.__assignedName + '(' +
            _node(this.left, env, ctx, tctx) + ', ' +
            _node(this.right, env, ctx, tctx) +
            ') {'
        );
        tctx.push();

        var leftType = this.left.getType(ctx);
        tctx.write(this.left.__assignedName + ' = ' + typeAnnotation(this.left.__assignedName, leftType) + ';');
        var rightType = this.right.getType(ctx);
        tctx.write(this.right.__assignedName + ' = ' + typeAnnotation(this.right.__assignedName, rightType) + ';');

        this.body.forEach(function(stmt) {
            _node(stmt, env, ctx, tctx);
        });

        tctx.write(getFunctionDerefs(ctx));

        var returnType = this.getType(ctx).getReturnType();
        if (returnType && this.body[this.body.length - 1].type !== 'Return') {
            if (returnType.typeName === 'float' ||
                returnType.typeName === 'sfloat') {
                tctx.write('return 0.0;');
            } else {
                tctx.write('return 0;');
            }
        }

        tctx.pop();
        tctx.write('}');

    },
    Type: function() {return '';},
    TypedIdentifier: function(env, ctx, tctx) {
        return this.__assignedName;
    },
    Literal: function(env, ctx, tctx) {
        if (this.litType === 'str') {
            return '(' +  env.getStrLiteralIdentifier(this.value) + '|0)';
        }

        if (this.value === true) return '1';
        if (this.value === false) return '0';
        if (this.value === null) return '0';

        var output = this.value.toString();
        var type = this.getType(ctx);

        var isSfloat = type.typeName === 'sfloat';

        if ((type.typeName === 'float' || isSfloat) && output.indexOf('.') === -1) {
            output += '.0';
        }

        if (isSfloat) {
            output = 'fround(' + output + ')';
        }

        return output
    },
    Symbol: function() {
        return this.__refName;
    },
    New: function(env, ctx, tctx) {
        var type = this.getType(ctx);
        if (typeof type === 'string') debugger;
        type = this.getType(ctx);
        var size;
        if (type._type === 'array') {

            if (!env.__hasNewArray) {
                env.__globalPrefix += 'function makeArray(length, elemSize) {\n';
                env.__globalPrefix += '    length = length | 0;\n';
                env.__globalPrefix += '    elemSize = elemSize | 0;\n';
                env.__globalPrefix += '    var ptr = 0;\n';
                env.__globalPrefix += '    ptr = gcref(calloc((length * elemSize | 0) + 16 | 0) | 0) | 0;\n';
                env.__globalPrefix += '    ptrheap[ptr + 8 >> 2] = length | 0;\n';
                env.__globalPrefix += '    ptrheap[ptr + 12 >> 2] = length | 0;\n'; // TODO: figure this out
                env.__globalPrefix += '    return ptr | 0;\n';
                env.__globalPrefix += '}\n';

                env.__hasNewArray = true;
            }

            // 16 because it's 8 bytes of overhead for normal object shape plus
            // an extra eight bytes to store the length. We use 8 bytes instead
            // of 4 (it's a 32-bit unsigned integer) because the start of the
            // array body needs to be at an 8-byte multiple.
            var innerTypeSize = type.contentsType._type === 'primitive' ? type.contentsType.getSize() : 4;
            return '(makeArray(' + typeAnnotation('(' + _node(this.params[0], env, ctx, tctx) + ')', this.params[0].getType(ctx)) + ', ' + innerTypeSize + ')|0)';
        } else {
            size = type.getSize() + 8;
        }
        var output = '(gcref(calloc(' + size + ')|0)|0)';
        if (type instanceof types.Struct && type.objConstructor) {
            output = '(' + type.objConstructor + '(' + output + (this.params.length ? ', ' + this.params.map(function(param) {
                return typeAnnotation(_node(param, env, ctx, tctx), param.getType(ctx));
            }).join(', ') : '') + ')|0)';
        }

        return output;
    },

    Break: function(env, ctx, tctx) {
        tctx.write('break;');
    },
    Continue: function(env, ctx, tctx) {
        tctx.write('continue;');
    },

    ObjectDeclaration: function(env, ctx, tctx) {
        if (this.objConstructor) {
            _node(this.objConstructor, env, ctx, tctx);
        }

        this.methods.forEach(function(method) {
            _node(method, env, ctx, tctx);
        });
    },
    ObjectMember: function() {},
    ObjectMethod: function(env, ctx, tctx) {
        _node(this.base, env, ctx, tctx);
    },
    ObjectConstructor: function(env, ctx, tctx) {
        _node(this.base, env, ctx, tctx);
    },

    TypeCast: function(env, ctx, tctx) {
        var baseType = this.left.getType(ctx);
        var targetType = this.rightType.getType(ctx);

        var base = _node(this.left, env, ctx, tctx);
        if (baseType.equals(targetType)) return base;

        // base = typeAnnotation(base, baseType);

        switch (baseType.typeName) {
            case 'int':
                switch (targetType.typeName) {
                    case 'uint': return '(+int2uint(' + base + '))';
                    case 'sfloat': return typeAnnotation(typeAnnotation(base, baseType), types.publicTypes.sfloat);
                    case 'float': return typeAnnotation(typeAnnotation(base, baseType), types.publicTypes.float);
                    case 'byte': return base;
                    case 'bool': return '(' + base + ' != 0)';
                }
            case 'uint':
                switch (targetType.typeName) {
                    case 'int': return '(uint2int(' + base + ')|0)';
                    case 'float': return typeAnnotation(base, types.publicTypes.float);
                    case 'byte': return base;
                    case 'bool': return '(' + base + ' != 0)';
                }
            case 'sfloat':
                switch (targetType.typeName) {
                    case 'int': return typeAnnotation('(~~(' + base + '))', types.publicTypes.int);
                    case 'float': return typeAnnotation(base, targetType);
                    case 'byte':
                    case 'uint': return '(float2uint(+' + base + ')|0)';
                    case 'bool': return '(' + base + ' != 0.0)';
                }
            case 'float':
                switch (targetType.typeName) {
                    case 'int': return typeAnnotation('(~~(' + base + '))', types.publicTypes.int);
                    case 'uint': return '(+float2uint(' + base + '))';
                    case 'byte': return typeAnnotation(base, types.publicTypes.byte);
                    case 'bool': return '(' + base + ' != 0.0)';
                    case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
                }
            case 'byte':
                switch (targetType.typeName) {
                    case 'int': return base;
                    case 'uint': return typeAnnotation(base, types.publicTypes.uint);
                    case 'float': return typeAnnotation(base, types.publicTypes.float);
                    case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
                    case 'bool': return '(' + base + ' != 0)';
                }
            case 'bool':
                switch (targetType.typeName) {
                    case 'int': return typeAnnotation(base, types.publicTypes.int);
                    case 'uint': return typeAnnotation(base, types.publicTypes.uint);
                    case 'float': return typeAnnotation(base, types.publicTypes.float);
                    case 'sfloat': return typeAnnotation(base, types.publicTypes.sfloat);
                    case 'byte': return typeAnnotation(base, types.publicTypes.byte);
                }
        }

    },

    Subscript: function(env, ctx, tctx, parent) {
        var baseType = this.base.getType(ctx);
        if (baseType._type !== 'array' && baseType._type !== 'tuple') {
            throw new Error('Cannot subscript non-arrays in asmjs');
        }

        var childType;
        var typedArr;

        if (baseType._type === 'tuple') {
            childType = baseType.contentsTypeArr[this.subscript.value];
            typedArr = heapName(childType);
            return typeAnnotation(
                typedArr + '[' + _node(this.base, env, ctx, tctx) + ' + ' +
                (baseType.getLayoutIndex(this.subscript.value) + 8) +
                HEAP_MODIFIERS[typedArr] + ']',
                childType
            );
        }

        childType = baseType.contentsType;
        typedArr = heapName(childType);

        var elementSize = childType.typeName === 'primitive' ? childType.getSize() : '4';
        var lookup = typedArr + '[((' +
            _node(this.base, env, ctx, tctx) + ') + (' +
            // +8 for memory overhead, +8 for the array length
            '((' + _node(this.subscript, env, ctx, tctx) + ') * ' + elementSize + ') | 0) + 16)' +
            HEAP_MODIFIERS[typedArr] + ']';
        if (parent !== 'Assignment' && parent !== 'Return') {
            lookup = typeAnnotation(lookup, childType);
        }
        return lookup;
    },

    TupleLiteral: function(env, ctx, tctx) {
        var type = this.getType(ctx);
        env.registerType(null, type, ctx);
        return '(makeTuple$' + type.flatTypeName() + '(' +
            this.content.map(function(c, i) {
                return typeAnnotation(_node(c, env, ctx, tctx), type.contentsTypeArr[i]);
            }).join(',') +
            ')|0)';
    },

};

module.exports = function translate(ctx) {
    var tctx = new TranslationContext(ctx.env, ctx);
    _node(ctx.scope, ctx.env, ctx, tctx);
    return tctx.toString();
};

module.exports.typeAnnotation = typeAnnotation;
module.exports.heapName = heapName;
module.exports.HEAP_MODIFIERS = HEAP_MODIFIERS;
