var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;


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
                    }
                )
            ])
        );
    });

    it('should parse attributes', function() {
        compareTree(
            'object foo {with x; with y;}',
            _root([
                node(
                    'ObjectDeclaration',
                    0,
                    28,
                    {
                        name: 'foo',
                        attributes: ['x', 'y'],
                        members: [],
                        methods: [],
                        objConstructor: null,
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
                            12,
                            18,
                            {
                                memberType: _typed('x', _type('int')),
                                name: 'x',
                                value: null,
                            }
                        )],
                        methods: [],
                        objConstructor: null,
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
                            12,
                            45,
                            {
                                name: 'foo',
                                base: node(
                                    'Function',
                                    12,
                                    45,
                                    {
                                        returnType: _type('int'),
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
                                        __objectSpecial: 'method',
                                    }
                                ),
                            }
                        )],
                        members: [],
                        objConstructor: null,
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
                            12,
                            57,
                            {
                                name: 'foo',
                                base: node(
                                    'Function',
                                    12,
                                    57,
                                    {
                                        returnType: _type('int'),
                                        name: 'foo',
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
                                        __objectSpecial: 'method',
                                    }
                                ),
                            }
                        )],
                        members: [],
                        objConstructor: null,
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
                            12,
                            30,
                            {
                                base: node(
                                    'Function',
                                    12,
                                    30,
                                    {
                                        returnType: null,
                                        name: 'new',
                                        params: [
                                            _typed('self', _type('foo')),
                                            _typed('bar', _type('float')),
                                        ],
                                        body: [],
                                        __objectSpecial: 'constructor',
                                    }
                                ),
                            }
                        ),
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
                            12,
                            42,
                            {
                                base: node(
                                    'Function',
                                    12,
                                    42,
                                    {
                                        returnType: null,
                                        name: 'new',
                                        params: [
                                            _typed('this', _type('foo')),
                                            _typed('bar', _type('float')),
                                        ],
                                        body: [],
                                        __objectSpecial: 'constructor',
                                    }
                                ),
                            }
                        ),
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
                            12,
                            45,
                            {
                                name: 'foo',
                                base: node(
                                    'Function',
                                    12,
                                    45,
                                    {
                                        returnType: _type('int'),
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
                                        __objectSpecial: 'method',
                                    }
                                ),
                            }
                        )],
                        members: [node(
                            'ObjectMember',
                            45,
                            54,
                            {
                                value: null,
                                name: 'zap',
                                memberType: _typed('x', _type('int')),
                            }
                        )],
                        objConstructor: null,
                    }
                )
            ])
        );
    });

});
