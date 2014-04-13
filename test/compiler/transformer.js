var assert = require('assert');

var context = require('../../src/compiler/context');
var lexer = require('../../src/lexer');
var parser = require('../../src/parser');
var transformer = require('../../src/compiler/transformer');


function getCtx(script, environment) {
    if (script instanceof Array) script = script.join('\n');
    return context(environment || env(), parser(lexer(script)));
}

function env() {
    return {
        namer: function() {return 'named';}
    };
}

describe('transformer', function() {
    describe('markFirstClassFunctions', function() {
        it('should not mark any functions by default', function() {
            // None of these functions are acessed in a first-class way.
            var ctx = getCtx([
                'func foo() {}',
                'func bar() {',
                '    func inner() {}',
                '}'
            ]);

            transformer.markFirstClassFunctions(ctx);

            assert.ok(!ctx.functions[0].__firstClass);
            assert.ok(!ctx.functions[1].__firstClass);
            assert.ok(!ctx.functions[1].__context.functions[0].__firstClass);

        });
        it('should not mark any functions that are called', function() {
            var ctx = getCtx([
                'func foo() {}',
                'foo();'
            ]);

            transformer.markFirstClassFunctions(ctx);

            assert.ok(!ctx.functions[0].__firstClass);

        });
        it('should mark any functions that are called indirectly', function() {
            var ctx = getCtx([
                'func<null>:foo = null;',
                'func bar() {}',
                '(foo or bar)();'
            ]);

            transformer.markFirstClassFunctions(ctx);

            assert.ok(ctx.functions[0].__firstClass);

        });

        it('should mark functions assigned to variables', function() {
            var ctx = getCtx([
                'func foo() {}',
                'var fooInAVar = foo;',
                'func bar() {',
                '    func inner() {}',
                '}'
            ]);

            transformer.markFirstClassFunctions(ctx);

            assert.ok(ctx.functions[0].__firstClass);
            assert.ok(!ctx.functions[1].__firstClass);
            assert.ok(!ctx.functions[1].__context.functions[0].__firstClass);

        });

        it('should ignore references to non-functions', function() {
            var ctx = getCtx([
                'int:foo = 0;',
                'foo = foo + 1;'
            ]);

            transformer.markFirstClassFunctions(ctx);

            assert.ok(!ctx.scope.body[0].__firstClass);

        });
    });

    describe('willFunctionNeedContext', function() {
        it('should not mark any functions by default', function() {
            var ctx = getCtx([
                'var x = 0;',
                'func foo() {x = x + 1;}',
                'func bar() {',
                '    func inner() {x = x + 1;}',
                '}'
            ]);

            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[0].__context));
            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[1].__context));
            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[1].__context.functions[0].__context));
        });
        it('should not mark any functions that only read lexical scope', function() {
            var ctx = getCtx([
                'func bar() {',
                '    var x = 0;',
                '    func int:inner() {return x;}',
                '}'
            ]);

            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[0].__context));
            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[0].__context.functions[0].__context));
        });
        it('should mark functions that have their scope written to lexically', function() {
            var ctx = getCtx([
                'func bar() {',
                '    var x = 0;',
                '    func inner() {x = x + 1;}',
                '}'
            ]);

            assert.ok(transformer.willFunctionNeedContext(ctx.functions[0].__context));
            assert.ok(!transformer.willFunctionNeedContext(ctx.functions[0].__context.functions[0].__context));
        });
    });

    describe('getFunctionContext', function() {
        var x = 0;
        var env = {
            namer: function() {
                return 'foo' + ++x;
            }
        };

        it('should retrieve a basic funcctx', function() {
            var ctx = getCtx([
                'func bar() {',
                '    var x = 0;',
                '    func inner() {x = x + 1;}',
                '}'
            ]);

            var fc = transformer.getFunctionContext(ctx.functions[0].__context);
            assert.equal(fc.__mappingOrder.length, 1, 'Should only have a single item in the context');
            assert.equal(fc.__mapping.x.name, 'int', 'Mapping should preserve types');
            assert.ok(fc.__assignedName, 'Mapping should have an assigned name');
            assert.ok(fc.declType.fullSize() > 0, 'Generated funcctx type should have a size greater than zero');
        });
        it('should retrieve a funcctx that does not include irrelevant variables', function() {
            var ctx = getCtx([
                'func bar() {',
                '    var x = 0;',
                '    var y = 0;',
                '    func int:inner() {x = x + 1; return y;}',
                '}'
            ], env);

            var fc = transformer.getFunctionContext(ctx.functions[0].__context);
            assert.equal(fc.__mappingOrder.length, 1, 'Should only have a single item in the context');
            assert.ok(fc.__mapping.x, 'Mapping should only have the correct member');
            assert.equal(Object.keys(fc.declType.members).length, 1, 'Generated funcctx type should have the correct number of members');
        });
        it('should retrieve a funcctx that includes variables that span contexts', function() {
            var ctx = getCtx([
                'func bar() {',
                '    var x = 0;',
                '    var y = 0;',
                '    func int:inner1() {x = x + 1;}',
                '    func int:inner2() {y = y + 1;}',
                '}'
            ], env);

            var fc = transformer.getFunctionContext(ctx.functions[0].__context);
            assert.equal(fc.__mappingOrder.length, 2, 'Should only have a single item in the context');
            assert.equal(Object.keys(fc.declType.members).length, 2, 'Generated funcctx type should have the correct number of members');
        });
    });

    describe('class 1: side-effect free transformations', function() {
        it('should uplift functions with no other changes', function() {
            // None of these functions are acessed in a first-class way.
            var ctx = getCtx([
                'func outer() {',
                '    func inner() {}',
                '}'
            ]);

            transformer(ctx);

            assert.equal(ctx.functions.length, 2, 'There should be two functions in the global scope');
            assert.equal(ctx.functions[0].name, 'outer');
            assert.equal(ctx.functions[1].name, 'inner');

            assert.equal(ctx.functions[0].__context.functions.length, 0, 'The outer function should have no nested functions');
            assert.equal(ctx.functions[1].__context.functions.length, 0, 'The inner function should have no nested functions');

        });
        it('should update references to uplifted functions', function() {
            // None of these functions are acessed in a first-class way.
            var ctx = getCtx([
                'func outer() {',
                '    func inner() {}',
                '    inner();',
                '}'
            ]);

            transformer(ctx);

            assert.equal(ctx.functions.length, 2, 'There should be two functions in the global scope');

            assert.equal(ctx.functions[0].__context.functions.length, 0, 'The outer function should have no nested functions');
            assert.equal(ctx.functions[1].__context.functions.length, 0, 'The inner function should have no nested functions');

            assert.equal(ctx.functions[0].body[0].callee.__refContext, ctx,
                         'The reference context of the call to `inner` should have been changed to the root context');

        });
    });

    describe('class 2: read-only transformations', function() {
        it('should perform transformations on read-only functions', function() {
            var ctx = getCtx([
                'func int:outer() {',
                '    var i = 0;',
                '    func int:inner() {',
                '        return i;',
                '    }',
                '    return inner();',
                '}'
            ]);

            transformer(ctx);

            // Test that everything was flattened:

            assert.equal(ctx.functions.length, 2, 'There should be two functions in the global scope');
            assert.equal(ctx.functions[0].name, 'outer');
            assert.equal(ctx.functions[1].name, 'inner');

            assert.equal(ctx.functions[0].__context.functions.length, 0, 'The outer function should have no nested functions');
            assert.equal(ctx.functions[1].__context.functions.length, 0, 'The inner function should have no nested functions');

            assert.equal(ctx.functions[0].params.length, 0, 'No params should have been added to the outer function');
            assert.equal(ctx.functions[1].params.length, 1, 'One param should have been added to the inner function');
            assert.equal(ctx.functions[1].params[0].idType.name, 'int', 'The inner function should have an integer param');
            assert.equal(ctx.functions[1].params[0].name, '$$i', 'The inner function should have an integer param');
            assert.equal(ctx.functions[1].body.length, 1, 'The inner function should have only one statement');
            assert.equal(ctx.functions[1].body[0].type, 'Return', 'The statement should be a return statement');
            assert.equal(ctx.functions[1].body[0].value.type, 'Symbol', 'The return should be pointing to a symbol');
            assert.equal(ctx.functions[1].body[0].value.name, ctx.functions[1].params[0].name, 'The symbol should reference the param');

            // Test that calls to the inner function were updated appropriately:
            assert.equal(ctx.functions[0].body.length, 2, 'The outer function should have the declaration and the return');
            assert.equal(ctx.functions[0].body[1].type, 'Return', 'The second node should be a return statement');
            assert.equal(ctx.functions[0].body[1].value.type, 'Call', 'The return should return a call');
            assert.equal(ctx.functions[0].body[1].value.params.length, 1, 'The call should have a single param');
            assert.equal(ctx.functions[0].body[1].value.params[0].type, 'Symbol', 'The call should pass a symbol');
            assert.equal(ctx.functions[0].body[1].value.params[0].name, '$$i', 'The symbol should reference the declaration');

        });
        it('should transform all references to transformed functions', function() {
            var ctx = getCtx([
                'func int:outer() {',
                '    var i = 0;',
                '    func int:caller() {',
                '        return inner();',
                '    }',
                '    func int:inner() {',
                '        return i;',
                '    }',
                '    return caller();',
                '}'
            ]);

            transformer(ctx);

            assert.equal(ctx.functions.length, 3, 'There should be three functions in the global scope');
            assert.equal(ctx.functions[0].name, 'outer');
            assert.equal(ctx.functions[1].name, 'caller');
            assert.equal(ctx.functions[2].name, 'inner');

            assert.equal(ctx.functions[1].body.length, 1, 'Caller function should have only a return statement');
            assert.equal(ctx.functions[1].body[0].type, 'Return', 'Only statement should be return');
            assert.equal(ctx.functions[1].body[0].value.type, 'Call', 'Should return a call');
            assert.equal(ctx.functions[1].body[0].value.callee.name, 'inner', 'Should be calling `inner`');
            assert.equal(ctx.functions[1].body[0].value.params.length, 1, 'Should be calling `inner` with one param');
            assert.equal(ctx.functions[1].body[0].value.params[0].name, '$$i', 'Should be calling `inner` with `i`');
            assert.equal(ctx.functions[1].params.length, 1, 'Caller function should have been updated with `i` as param');
            assert.equal(ctx.functions[1].params[0].name, '$$$$i', 'Caller function should have been updated with `i` as param');

        });
    });

    describe('class 3: complex transformations', function() {
        it('should perform complex transformations', function() {
            var ctx = getCtx([
                'func func<null, int>:outer() {',
                '    var i = 0;',
                '    func inner(int:j) {',
                '        i = i + j;',
                '    }',
                '    return inner;',
                '}'
            ]);

            transformer(ctx);

            // Test that everything was flattened:

            assert.equal(ctx.functions.length, 2, 'There should be two functions in the global scope');
            assert.equal(ctx.functions[0].name, 'outer');
            assert.equal(ctx.functions[1].name, 'inner');

            assert.equal(ctx.functions[0].__context.functions.length, 0, 'The outer function should have no nested functions');
            assert.equal(ctx.functions[1].__context.functions.length, 0, 'The inner function should have no nested functions');

            // Test that the funcctx was created in the outer function:
            assert.equal(ctx.functions[0].body.length, 3, 'There should be three items in the body');
            assert.equal(ctx.functions[0].body[0].type, 'Declaration', 'The first should be a declaration');
            assert.equal(ctx.functions[0].body[0].value.type, 'New', 'The declaration should create the context');
            assert.equal(ctx.functions[0].body[0].value.newType.name, 'funcctx', 'The new object should be a funcctx');
            assert.equal(ctx.functions[0].body[0].value.newType.traits.length, 1, 'The funcctx should have one trait');
            assert.equal(ctx.functions[0].body[0].value.newType.traits[0].name, 'int', 'The trait should be an int');
            assert.equal(ctx.functions[0].body[0].value.newType.members.i.type.name, 'int', 'The trait should be an int');
            assert.equal(ctx.functions[0].body[1].type, 'Assignment', 'The second should be an assignment');
            assert.equal(ctx.functions[0].body[2].type, 'Return', 'The third should be the return');

            assert.equal(Object.keys(ctx.functions[0].__context.vars).length, 1, 'There should only be one declared variable');
            assert.equal(ctx.functions[0].__context.vars.$ctx.name, 'funcctx', 'And it should be a funcctx');

            // Test that the inner function was updated properly:
            assert.equal(ctx.functions[1].body[0].type, 'Assignment', 'Sanity should dictate that the assignment did not change');
            assert.equal(ctx.functions[1].body[0].base.type, 'Member', 'The assignment should now be to a member expression');
            assert.equal(ctx.functions[1].body[0].base.child, 'i', 'The member expression should be to an element "i"');
            assert.equal(ctx.functions[1].body[0].base.base.type, 'Symbol', 'The member expression should be based on a symbol');
            var symname = ctx.functions[1].body[0].base.base.name;

            assert.equal(ctx.functions[1].params.length, 2, 'A new parameter should have been added');
            assert.equal(ctx.functions[1].params[0].idType.name, 'int', 'The first param should have remained an int');
            assert.equal(ctx.functions[1].params[1].idType.name, 'funcctx', 'The second param should now be a funcctx');
            assert.equal(ctx.functions[1].params[1].name, symname, 'The second param should be what is referenced in the body');

        });

        // TODO: Test that first class function references are converted to `func` objects.
    });
});
