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

    describe('class 3: complex transformations', function() {
        it('should perform complex transformations', function() {
            // None of these functions are acessed in a first-class way.
            var ctx = getCtx([
                'func func<null>:outer() {',
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
            assert.equal(ctx.functions[0].body[1].type, 'Assignment', 'The second should be an assignment');
            assert.equal(ctx.functions[0].body[2].type, 'Return', 'The third should be the return');

            assert.equal(Object.keys(ctx.functions[0].__context.vars).length, 1, 'There should only be one declared variable');
            assert.equal(ctx.functions[0].__context.vars.$ctx.name, 'funcctx', 'And it should be a funcctx');

            // Test that the inner function was updated properly:
            assert.equal(ctx.functions[1].body[0].type, 'Assignment', 'Sanity should dictate that the assignment did not change');
            assert.equal(ctx.functions[1].body[0].base.type, 'Member', 'The assignment should now be to a member expression');
            assert.equal(ctx.functions[1].body[0].base.child, 'i', 'The member expression should be to an element "i"');
            assert.equal(ctx.functions[1].body[0].base.base.type, 'Symbol', 'The member expression should be based on a symbol');
            //assert.equal(ctx.functions[1].params.length, 2, 'A new parameter should have been added');
            // TODO: Test that the new parameter has the right type

            // Test that calls to the inner function were updated appropriately:

        });
    });
});
