'use strict';
require('babel/register')({stage: 0});


var assert = require('assert');

var compareTree = require('./_utils').compareTree;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;
var parse = require('./_utils').parse;
var node = require('./_utils').node;


describe('Object declaration parser', function() {
    it('should parse when empty', function() {
        compareTree(
            'object foo {}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    13,
                    {
                        name: 'foo',
                        members: [],
                        attributes: [],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse attributes', function() {
        compareTree(
            'object foo<x, y> {}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    19,
                    {
                        name: 'foo',
                        attributes: ['x', 'y'],
                        members: [],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when members are present', function() {
        compareTree(
            'object foo {\nint:x;\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    21,
                    {
                        name: 'foo',
                        attributes: [],
                        members: [node(
                            'ObjectMember',
                            13,
                            18,
                            {
                                type: _typed('x', _type('int')),
                                name: 'x',
                                value: null,
                                isPrivate: false,
                                isFinal: false,
                            }
                        )],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when private members are present', function() {
        compareTree(
            'object foo {\nprivate int:x;\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    29,
                    {
                        name: 'foo',
                        attributes: [],
                        members: [node(
                            'ObjectMember',
                            13,
                            26,
                            {
                                type: _typed('x', _type('int')),
                                name: 'x',
                                value: null,
                                isPrivate: true,
                                isFinal: false,
                            }
                        )],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when final members are present', function() {
        compareTree(
            'object foo {\nfinal int:x;\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    27,
                    {
                        name: 'foo',
                        attributes: [],
                        members: [node(
                            'ObjectMember',
                            13,
                            24,
                            {
                                type: _typed('x', _type('int')),
                                name: 'x',
                                value: null,
                                isPrivate: false,
                                isFinal: true,
                            }
                        )],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when private final members are present', function() {
        compareTree(
            'object foo {\nprivate final int:x;\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    35,
                    {
                        name: 'foo',
                        attributes: [],
                        members: [node(
                            'ObjectMember',
                            13,
                            32,
                            {
                                type: _typed('x', _type('int')),
                                name: 'x',
                                value: null,
                                isPrivate: true,
                                isFinal: true,
                            }
                        )],
                        methods: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when methods are present', function() {
        compareTree(
            'object foo {\nint:foo(float:bar) {return 123;}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    47,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            45,
                            {
                                name: 'foo',
                                returnType: _type('int'),
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    33,
                                    44,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                isPrivate: false,
                                isFinal: false,
                            }
                        )],
                        members: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when private methods are present', function() {
        compareTree(
            'object foo {\nprivate int:foo(float:bar) {return 123;}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    55,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            53,
                            {
                                name: 'foo',
                                returnType: _type('int'),
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    41,
                                    52,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                isPrivate: true,
                                isFinal: false,
                            }
                        )],
                        members: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when final methods are present', function() {
        compareTree(
            'object foo {\nfinal int:foo(float:bar) {return 123;}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    53,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            51,
                            {
                                name: 'foo',
                                returnType: _type('int'),
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    39,
                                    50,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                isPrivate: false,
                                isFinal: true,
                            }
                        )],
                        members: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when private final methods are present', function() {
        compareTree(
            'object foo {\nprivate final int:foo(float:bar) {return 123;}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    61,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            59,
                            {
                                name: 'foo',
                                returnType: _type('int'),
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    47,
                                    58,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                isPrivate: true,
                                isFinal: true,
                            }
                        )],
                        members: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when methods are present with optional self syntax', function() {
        compareTree(
            'object foo {\nint:foo([foo:this], float:bar) {return 123;}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    59,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            57,
                            {
                                name: 'foo',
                                returnType: _type('int'),
                                params: [
                                    _typed('this', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    45,
                                    56,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                isPrivate: false,
                                isFinal: false,
                            }
                        )],
                        members: [],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse constructors', function() {
        compareTree(
            'object foo {\nnew(float:bar) {}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    32,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [],
                        members: [],
                        objConstructor: node(
                            'ObjectConstructor',
                            13,
                            30,
                            {
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [],
                                isFinal: false,
                            }
                        ),
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse final constructors', function() {
        compareTree(
            'object foo {\nfinal new(float:bar) {}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    38,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [],
                        members: [],
                        objConstructor: node(
                            'ObjectConstructor',
                            13,
                            36,
                            {
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [],
                                isFinal: true,
                            }
                        ),
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse constructors with optional self syntax', function() {
        compareTree(
            'object foo {\nnew([foo:this], float:bar) {}\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    44,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [],
                        members: [],
                        objConstructor: node(
                            'ObjectConstructor',
                            13,
                            42,
                            {
                                params: [
                                    _typed('this', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [],
                                isFinal: false,
                            }
                        ),
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should parse when methods and members are present', function() {
        compareTree(
            'object foo {\nint:foo(float:bar) {return 123;}\nbool:zap;\n}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    57,
                    {
                        name: 'foo',
                        attributes: [],
                        methods: [node(
                            'ObjectMethod',
                            13,
                            45,
                            {
                                name: 'foo',
                                params: [
                                    _typed('self', _type('foo')),
                                    _typed('bar', _type('float')),
                                ],
                                body: [node(
                                    'Return',
                                    33,
                                    44,
                                    {
                                        value: _int(123),
                                    }
                                )],
                                returnType: _type('int'),
                                isPrivate: false,
                                isFinal: false,
                            }
                        )],
                        members: [node(
                            'ObjectMember',
                            46,
                            54,
                            {
                                value: null,
                                name: 'zap',
                                type: _typed('x', _type('int')),
                                isPrivate: false,
                                isFinal: false,
                            }
                        )],
                        objConstructor: null,
                        operators: [],
                    }
                )
            ])
        );
    });

    it('should disallow private constructors', function() {

        assert.doesNotThrow(function() {
            parse('object Foo {new() {}}');
        });

        assert.throws(function() {
            parse('object Foo {private new() {}}');
        });

    });

});
