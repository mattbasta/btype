var assert = require('assert');

var context = require('../../src/compiler/context');
var lexer = require('../../src/lexer');
var parser = require('../../src/parser');


function parse(script) {
    if (script instanceof Array) script = script.join('\n');
    return parser(lexer(script));
}

function env() {
    return {
        namer: function() {return 'named';}
    };
}


describe('context', function() {
    describe('imports', function() {
        it('should import from the environment', function(done) {
            var env = {
                import: function(name) {
                    assert.equal(name, 'foo', '`foo` should be imported.');
                    done();
                }
            };
            context(env, parse([
                'import foo;'
            ]));
        });
    });

    describe('functions', function() {
        it('should list each function in the global scope', function() {
            var ctx = context(env(), parse([
                'func int:test() {',
                '    return 0;',
                '}',
                'func int:foo() {',
                '    return 1;',
                '}'
            ]));

            assert.equal(ctx.functions.length, 2, 'There should be two functions in the global context');
            assert.equal(ctx.functions[0].name, 'test', 'The first function should be "test"');
            assert.equal(ctx.functions[0], ctx.functionDeclarations.test, 'The first function should be listed in the function declarations');
            assert.equal(ctx.functions[1].name, 'foo', 'The second function should be "foo"');
            assert.equal(ctx.functions[1], ctx.functionDeclarations.foo, 'The second function should be listed in the function declarations');
        });

        it('should list nested functions', function() {
            var ctx = context(env(), parse([
                'func int:test() {',
                '    func int:foo() {',
                '        return 1;',
                '    }',
                '    return foo();',
                '}'
            ]));

            assert.equal(ctx.functions.length, 1, 'There should be two functions in the global context');
            assert.equal(ctx.functions[0].name, 'test', 'The first function should be "test"');
            assert.equal(ctx.functions[0].__context.functions.length, 1, 'There should be one nested function');
            assert.equal(ctx.functions[0].__context.functions[0].name, 'foo', 'The nested function should have the name "foo"');
        });

        it('should resolve the correct type', function() {
            var ctx = context(env(), parse([
                'func int:test() {',
                '    return 0;',
                '}'
            ]));

            var type = ctx.functions[0].getType(ctx);
            assert.equal(type.name, 'func', 'The base type should be "func"');
            assert.equal(type.traits.length, 1, 'There should only be at one trait, the return type');
            assert.equal(type.traits[0].name, 'int', 'The return type should be "int"');
        });

        it('should resolve the correct type with parameters', function() {
            var ctx = context(env(), parse([
                'func int:test(str:foo, func<null, int>:callback) {',
                '    callback(123);',
                '    return 0;',
                '}'
            ]));

            var type = ctx.functions[0].getType(ctx);
            assert.equal(type.name, 'func', 'The base type should be "func"');
            assert.equal(type.traits.length, 3, 'There should be three traits: return type and two params');
            assert.equal(type.traits[0].name, 'int', 'The return type should be "int"');
            assert.equal(type.traits[1].name, 'str', 'The first param should be "int"');
            assert.equal(type.traits[2].name, 'func', 'The second param should be "func"');
            assert.equal(type.traits[2].traits.length, 2, 'There should be two traits for the second param');
            assert.equal(type.traits[2].traits[0].name, 'null', 'The return type of the second param should be void');
            assert.equal(type.traits[2].traits[1].name, 'int', 'The first param of the second param is "int"');
        });
    });


});
