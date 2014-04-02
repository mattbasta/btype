var assert = require('assert');

var context = require('../../src/compiler/context');
var lexer = require('../../src/lexer');
var parser = require('../../src/parser');
var types = require('../../src/compiler/types');


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
        it('should import from the environment', function() {
            var env = {
                import: function(node) {
                    assert.equal(node.base, 'foo', '`foo` should be imported.');
                    return {
                        getType: function() {return {test: 'bar'};}
                    };
                }
            };
            var ctx = context(env, parse([
                'import foo;'
            ]));
            assert.equal(ctx.vars.foo.test, 'bar', 'Import should have been assigned the proper type');
        });

        it('should import from the environment with an alias', function() {
            var env = {
                import: function(node) {
                    assert.equal(node.base, 'foo', '`foo` should be imported.');
                    return {
                        getType: function() {return {test: 'bar'};}
                    };
                }
            };
            var ctx = context(env, parse([
                'import foo as zip;'
            ]));
            assert.equal(ctx.vars.zip.test, 'bar', 'Import should have been assigned the proper type');
        });
    });

    describe('exports', function() {
        it('should export functions', function() {
            var ctx = context(env(), parse([
                'func int:foo() {}',
                'export foo;'
            ]));

            assert.ok(ctx.exports.foo.name, 'func', '`foo` should have been exported with the correct type');
            assert.ok(ctx.exports.foo.traits.length, 1, '`foo` should have been exported with the correct number of traits');
            assert.ok(ctx.exports.foo.traits[0].name, 'int', '`foo` should have been exported with the correct return type');
            assert.equal(ctx.exportMap.foo, 'named', 'The export should be associated with the assigned name');
        });

        it('should not all exports from nested scopes', function() {
            assert.throws(function() {
                context(env(), parse([
                    'func int:foo() {',
                    '    export foo;',
                    '}'
                ]));
            });
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
            assert.equal(type.traits[2].traits[0], null, 'The return type of the second param should be void');
            assert.equal(type.traits[2].traits[1].name, 'int', 'The first param of the second param is "int"');
        });

        it('should declare the parameters in the internal function context', function() {
            var ctx = context(env(), parse([
                'func int:test(str:foo) {',
                '}'
            ]));

            // Some sanity checking
            var type = ctx.functions[0].getType(ctx);
            assert.equal(type.name, 'func', 'The base type should be "func"');
            assert.equal(type.traits.length, 2, 'There should be two traits: return type and one param');
            assert.equal(type.traits[1].name, 'str', 'The first param should be "str"');

            var vars = ctx.functions[0].__context.vars;
            assert.equal(vars.foo.name, 'str', 'The type of the param declared as a variable in the scope should be "str"');
        });

        it('should declare nested functions as variables in the global scope', function() {
            var ctx = context(env(), parse([
                'func int:test(str:foo) {',
                '}'
            ]));

            assert.equal(ctx.vars.test.name, 'func', '"test" should be declared as a variable in the global scope');
        });

        it('should declare nested functions as variables in function contexts', function() {
            var ctx = context(env(), parse([
                'func int:test(str:foo) {',
                '    func int:bar(str:foo) {',
                '    }',
                '}'
            ]));

            assert.equal(ctx.functions[0].__context.vars.bar.name, 'func', '"bar" should be declared as a variable in the function context');
            assert.ok(ctx.hasVar('test'), '"test" is declared in the global context');
            assert.ok(ctx.functions[0].__context.hasVar('bar'), '"bar" is declared in the inner function context');
        });

        it('should be able to access declarations that are declared after themselves', function() {
            assert.doesNotThrow(function() {
                context(env(), parse([
                    'func int:test() {',
                    '    func int:bar() {',
                    '        return x;',
                    '    }',
                    '    int:x = 0;',
                    '    return bar();',
                    '}'
                ]));
            });
        });

        it('should be able to access other functions that are declared after themselves', function() {
            assert.doesNotThrow(function() {
                context(env(), parse([
                    'func int:test() {',
                    '    func int:foo() {',
                    '        return bar();',
                    '    }',
                    '    func int:bar() {',
                    '        return 123;',
                    '    }',
                    '    return foo();',
                    '}'
                ]));
            });

            // Check the reverse as well.
            assert.doesNotThrow(function() {
                context(env(), parse([
                    'func int:test() {',
                    '    func int:foo() {',
                    '        return 123;',
                    '    }',
                    '    func int:bar() {',
                    '        return foo();',
                    '    }',
                    '    return bar();',
                    '}'
                ]));
            });
        });

        it('should be inaccessible by expressions that are lexically before themselves', function() {
            // Note that this behavior differs from JavaScript.

            assert.throws(function() {
                context(env(), parse([
                    'func int:test() {',
                    '    return bar();',
                    '    func int:bar() {',
                    '        return 1;',
                    '    }',
                    '}'
                ]));
            });
        });
    });

    describe('variable redefinition prevention', function() {
        it('should prevent variables from being redeclared', function() {
            assert.throws(function() {
                context(env(), parse([
                    'var x = 1;',
                    'var x = 2;'
                ]));
            });
        });

        it('should prevent conflicts between declarations and functions', function() {
            assert.throws(function() {
                context(env(), parse([
                    'var x = 1;',
                    'func int:x() {}'
                ]));
            });

            assert.throws(function() {
                context(env(), parse([
                    'func int:x() {}',
                    'var x = 1;'
                ]));
            });
        });

        it('should not prevent shadowing', function() {
            assert.doesNotThrow(function() {
                context(env(), parse([
                    'var x = 1;',
                    'func int:foobar() {',
                    '    var x = 2;',
                    '}'
                ]));
            });
        });

        it('should prevent overriding parameters', function() {
            assert.throws(function() {
                context(env(), parse([
                    'func int:foobar(int:x) {',
                    '    var x = 2;',
                    '}'
                ]));
            });

            assert.throws(function() {
                context(env(), parse([
                    'func int:foobar(int:x) {',
                    '    func int:x() {}',
                    '}'
                ]));
            });
        });
    });

    describe('variable lookup', function() {
        it('should return the context that a variable is defined in', function() {
            var ctx = context(env(), parse([
                'var test1 = 0;',
                'func int:foo(int:test2) {',
                '    var test3 = 0;',
                '    func int:bar() {',
                '        var test4 = 0;',
                '        return test4;',
                '    }',
                '}'
            ]));

            var fooctx = ctx.functions[0].__context;
            var barctx = fooctx.functions[0].__context;

            assert.ok(barctx.hasVar('test4'), 'Sanity test that "bar" recognizes "test4"');
            assert.ok(!barctx.hasVar('test3'), 'Sanity test that "bar" does not recognize "test3"');
            assert.ok(!barctx.hasVar('test2'), 'Sanity test that "bar" does not recognize "test2"');
            assert.ok(!barctx.hasVar('test1'), 'Sanity test that "bar" does not recognize "test1"');

            assert.ok(!fooctx.hasVar('test4'), 'Sanity test that "foo" does not recognize "test4"');
            assert.ok(fooctx.hasVar('test3'), 'Sanity test that "foo" recognizes "test3"');
            assert.ok(fooctx.hasVar('test2'), 'Sanity test that "foo" recognizes "test2"');
            assert.ok(!fooctx.hasVar('test1'), 'Sanity test that "foo" does not recognize "test1"');

            assert.ok(!ctx.hasVar('test4'), 'Sanity test that "ctx" does not recognize "test4"');
            assert.ok(!ctx.hasVar('test3'), 'Sanity test that "ctx" does not recognize "test3"');
            assert.ok(!ctx.hasVar('test2'), 'Sanity test that "ctx" does not recognize "test2"');
            assert.ok(ctx.hasVar('test1'), 'Sanity test that "ctx" recognizes "test1"');

            assert.equal(barctx.lookupVar('test4'), barctx, 'Looking up "test4" in barctx should return itself');
            assert.equal(barctx.lookupVar('test3'), fooctx, 'Looking up "test3" in barctx should return its parent, "fooctx"');
            assert.equal(barctx.lookupVar('test2'), fooctx, 'Looking up "test2" in barctx should return its parent, "fooctx"');
            assert.equal(barctx.lookupVar('test1'), ctx, 'Looking up "test1" in barctx should return the global context');
            assert.equal(fooctx.lookupVar('test3'), fooctx, 'Looking up "test3" in fooctx should return itself');
            assert.equal(fooctx.lookupVar('test2'), fooctx, 'Looking up "test2" in fooctx should return itself');
            assert.equal(fooctx.lookupVar('test1'), ctx, 'Looking up "test1" in fooctx should return the global context');
            assert.equal(ctx.lookupVar('test1'), ctx, 'Looking up "test1" in ctx should return itself');

            assert.throws(function() {
                ctx.lookupVar('test3');
            }, 'Global scope cannot lookup variables declared in child functions');

            assert.throws(function() {
                ctx.lookupVar('test2');
            }, 'Global scope cannot lookup parameters in child functions');

            assert.throws(function() {
                ctx.lookupVar('bar');
            }, 'Global scope cannot lookup nested functions');
        });
    });

    describe('name assignment', function() {
        it('should store mapped names', function() {
            var ctx = context(env(), parse([
                'var test1 = 0;',
                'func int:foo(int:test2) {',
                '}'
            ]));

            assert.ok('test1' in ctx.nameMap, '"test1" is assigned a name');
            assert.equal(ctx.nameMap.test1, 'named', 'Test that a name was assigned to "test1"');
            assert.ok('foo' in ctx.nameMap, '"foo" is assigned a name');
            assert.equal(ctx.nameMap.foo, 'named', 'Test that a name was assigned to "foo"');

            var fooctx = ctx.functions[0].__context;
            assert.ok('test2' in fooctx.nameMap, '"test2" is assigned a name');
            assert.equal(fooctx.nameMap.test2, 'named', 'Test that a name was assigned to "test2"');

        });
    });

    describe('scope analysis', function() {
        function prep(code) {
            return context(env(), parse(code)).functions[0].__context;
        }

        it('should not mark functions as accessing scopes by default', function() {
            var ctx = prep([
                'var globalVar = 0;',
                'func int:foo(int:bar) {',
                '    return 0;',
                '}'
            ]);

            assert.ok(!ctx.accessesGlobalScope, 'The function does not access the global scope');
        });

        it('should mark functions when they access global scope', function() {
            var ctx = prep([
                'var globalVar = 0;',
                'func int:foo(int:bar) {',
                '    return globalVar;',
                '}'
            ]);

            assert.ok(ctx.accessesGlobalScope, 'The function accesses the global scope');
        });

        it('should mark functions when they access lexical scope', function() {
            var ctx = prep([
                'var globalVar = 0;',
                'func int:foo(int:param1) {',
                '    func int:bar(int:param2) {',
                '        return param1 + param2;',
                '    }',
                '    return bar(globalVar);',
                '}'
            ]);
            var innerctx = ctx.functions[0].__context;

            assert.ok(innerctx.accessesLexicalScope, 'The inner function accesses the lexical scope');
            assert.ok(!innerctx.accessesGlobalScope, 'The inner function does not access the global scope');

            assert.ok(!ctx.accessesLexicalScope, 'The function does not access the lexical scope');
            assert.ok(ctx.accessesGlobalScope, 'The function accesses the global scope');
        });

        it('should store contexts for lexical scope lookups', function() {
            var ctx = prep([
                'func int:foo(int:param1) {',
                '    func int:bar(int:param2) {',
                '        return param1 + param2;',
                '    }',
                '    return bar(123);',
                '}'
            ]);
            var innerctx = ctx.functions[0].__context;

            assert.equal(innerctx.lexicalLookups.param1, ctx, 'The referenced context for "param1" in the inner function is the outer function');
        });
    });

    describe('side effect analysis', function() {
        function prep(code) {
            return context(env(), parse(code)).functions[0].__context;
        }

        it('should not mark functions as having side effects by default', function() {
            var ctx = prep([
                'func int:foo(int:bar) {',
                '    return bar;',
                '}'
            ]);

            assert.ok(ctx.sideEffectFree, 'The function should be side effect-free if it has no side effects');
            assert.ok(ctx.lexicalSideEffectFree, 'The function should be lexically side effect-free if it has no side effects');
        });

        it('should not mark functions as having side effects for read-only access', function() {
            var ctx = prep([
                'var global = 0;',
                'func int:foo() {',
                '    return global;',
                '}'
            ]);

            assert.ok(ctx.sideEffectFree, 'The function has no side effects');
            assert.ok(ctx.lexicalSideEffectFree, 'The function has no lexical side effects');
        });

        it('should mark funcions that have side effects', function() {
            var ctx = prep([
                'var global = 0;',
                'func int:foo(int:bar) {',
                '    global = global + 1;',
                '    return bar;',
                '}'
            ]);

            assert.ok(!ctx.sideEffectFree, 'The function should not be side effect-free if it has side effects');
            assert.ok(ctx.lexicalSideEffectFree, 'The function should be lexically side effect-free since it is not nested');
        });

        it('should mark functions that have lexical side effects as such', function() {
            var ctx = prep([
                'func int:outer() {',
                '    var local = 1;',
                '    func int:inner() {',
                '        local = local + 1;',
                '    }',
                '    return local;',
                '}'
            ]).functions[0].__context;

            assert.ok(!ctx.sideEffectFree, 'The function should not be side effect-free if it has side effects');
            assert.ok(!ctx.lexicalSideEffectFree, 'The function should not be lexically side effect-free since it modifies "local"');
        });
    });
});