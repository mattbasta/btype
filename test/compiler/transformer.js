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
});
