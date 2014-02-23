var assert = require('assert');

var lexer = require('../src/lexer');
var parser = require('../src/parser');

var node = parser.node;

function compareTree(script, tree) {
    var parsed = parser(lexer(script));
    console.log(parsed.body[0]);
    console.log(tree.body[0]);
    function compare(left, right, base, key) {
        if (!!left !== !!right) {
            assert.fail(left, right, 'Mismatched key "' + key + '" at ' + base + ': ' + left + ', ' + right);
        }
        if (left instanceof lexer.token) {
            assert.equal(left.text, right.text, 'Expected token "' + key + '" text to be equal in both trees at ' + base);
            assert.equal(left.type, right.type, 'Expected token "' + key + '" type to be equal in both trees at ' + base);
        } else if (left instanceof Array) {
            if (!arrEq(left, right, base + key)) {
                return false;
            }
        } else if (left instanceof Object) {
            if (!objEq(left, right, base + key)) {
                return false;
            }
        } else {
            assert.equal(left, right, 'Expected key "' + key + '" to be equal in both trees at ' + base + ': ' + left + ', ' + right);
        }
        return true;
    }
    function arrEq(left, right, base) {
        assert.equal(left.length, right.length, 'Arrays expected to be the same length at ' + base);
        for (var i = 0; i < left.length; i++) {
            if (!compare(left[i], right[i], base, '[' + i + ']')) return false;
        }
        return true;
    }
    function objEq(left, right, base) {
        base = base || '';
        var keys = {};  // A set of string key names
        var key;
        for(key in left) {
            keys[key] = true;
            if (!(key in right)) {
                assert.fail('Key "' + key + '" was found in generated parse tree but not in expected parse tree at ' + base);
            }
            compare(left[key], right[key], base, '.' + key);
        }
        for(key in right) {
            if (!(key in keys)) {
                assert.fail('Key "' + key + '" was found in expected parse tree but not in generated parse tree at ' + base);
            }
        }
        return true;
    }
    assert(compare(parsed, tree, '', ''));
}

function _root(body) {
    return node('Root', null, null, {body: body});
}

function _i(text) {
    return new lexer.token(text, 'identifier', 0, 0);
}

describe('Parser', function() {
    it('should parse blank scripts', function() {
        compareTree('', _root([]));
    });
    describe('functions', function() {
        it('should parse empty named functions', function() {
            compareTree(
                'func retType:foo() {}',
                _root([
                    node(
                        'Function',
                        0,
                        21  ,
                        {
                            returnType: _i('retType'),
                            name: _i('foo'),
                            params: [],
                            body: []
                        }
                    )
                ])
            );
        });
        it('should parse empty unnamed functions', function() {
            compareTree(
                'func retType() {}',
                _root([
                    node(
                        'Function',
                        0,
                        17,
                        {
                            returnType: _i('retType'),
                            name: null,
                            params: [],
                            body: []
                        }
                    )
                ])
            );
        });

        it('should parse unnamed functions with params', function() {
            compareTree(
                'func retType(int:x, str:y) {}',
                _root([
                    node(
                        'Function',
                        0,
                        29,
                        {
                            returnType: _i('retType'),
                            name: null,
                            params: [
                                {type: _i('int'), name: _i('x')},
                                {type: _i('str'), name: _i('y')}
                            ],
                            body: []
                        }
                    )
                ])
            );
        });

        it('should parse nested functions', function() {
            compareTree(
                'func int:foo(int:x, str:y) {func str(bool:z){}}',
                _root([
                    node(
                        'Function',
                        0,
                        47,
                        {
                            returnType: _i('int'),
                            name: _i('foo'),
                            params: [
                                {type: _i('int'), name: _i('x')},
                                {type: _i('str'), name: _i('y')}
                            ],
                            body: [
                                node(
                                    'Function',
                                    28,
                                    46,
                                    {
                                        returnType: _i('str'),
                                        name: null,
                                        params: [
                                            {type: _i('bool'), name: _i('z')}
                                        ],
                                        body: []
                                    }
                                )
                            ]
                        }
                    )
                ])
            );
        });
    });

    describe('assignments and declarations', function() {
        it('should parse basic assignments', function() {
            compareTree(
                'x = y;',
                _root([
                    node(
                        'Assignment',
                        0,
                        6,
                        {
                            base: _i('x'),
                            value: _i('y')
                        }
                    )
                ])
            );
        });
        it('should parse chained assignments', function() {
            compareTree(
                'x = y = z;',
                _root([
                    node(
                        'Assignment',
                        0,
                        10,
                        {
                            base: _i('x'),
                            value: node(
                                'Assignment',
                                3,
                                9,
                                {
                                    base: _i('y'),
                                    value: _i('z')
                                }
                            )
                        }
                    )
                ])
            );
        });
        it('should parse basic declarations', function() {
            compareTree(
                'var x = y;',
                _root([
                    node(
                        'Declaration',
                        0,
                        10,
                        {
                            type: null,
                            identifier: _i('x'),
                            value: _i('y')
                        }
                    )
                ])
            );
        });
        it('should parse typed declarations', function() {
            compareTree(
                'int:x = y;',
                _root([
                    node(
                        'Declaration',
                        0,
                        10,
                        {
                            type: _i('int'),
                            identifier: _i('x'),
                            value: _i('y')
                        }
                    )
                ])
            );
        });
    });
});
