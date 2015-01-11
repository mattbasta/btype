var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;


describe('Function parser', function() {
    it('should parse empty named functions', function() {
        compareTree(
            'func retType:foo() {}',
            _root([
                node(
                    'Function',
                    0,
                    21,
                    {
                        returnType: _type('retType'),
                        name: 'foo',
                        params: [],
                        body: []
                    }
                )
            ])
        );
    });
    it('should parse empty named functions without param lists', function() {
        compareTree(
            'func retType:foo {}',
            _root([
                node(
                    'Function',
                    0,
                    19,
                    {
                        returnType: _type('retType'),
                        name: 'foo',
                        params: [],
                        body: []
                    }
                )
            ])
        );
    });
    it('should parse empty void functions', function() {
        compareTree(
            'func nameNotRetType() {}',
            _root([
                node(
                    'Function',
                    0,
                    24,
                    {
                        returnType: null,
                        name: 'nameNotRetType',
                        params: [],
                        body: []
                    }
                )
            ])
        );
    });

    it('should parse unnamed functions with params', function() {
        compareTree(
            'func funName(int:x, str:y) {}',
            _root([
                node(
                    'Function',
                    0,
                    29,
                    {
                        returnType: null,
                        name: 'funName',
                        params: [
                            _typed('x', _type('int')),
                            _typed('y', _type('str'))
                        ],
                        body: []
                    }
                )
            ])
        );
    });

    it('should parse types with non-identifier tokens', function() {
        compareTree(
            // Neither null and func are identifiers
            'func funName(func<null, int>:x) {}',
            _root([
                node(
                    'Function',
                    0,
                    34,
                    {
                        returnType: null,
                        name: 'funName',
                        params: [
                            _typed(
                                'x',
                                _type(
                                    'func',
                                    [
                                        null,
                                        _type('int')
                                    ]
                                )
                            )
                        ],
                        body: []
                    }
                )
            ])
        );
        compareTree(
            // Neither null and func are identifiers
            'func<null>:x = null;',
            _root([
                node(
                    'Declaration',
                    0,
                    20,
                    {
                        declType: _type('func', [null]),
                        identifier: 'x',
                        value: node(
                            'Literal',
                            14,
                            18,
                            {
                                litType: 'null',
                                value: null
                            }
                        )
                    }
                )
            ])
        );
    });

    it('should parse nested functions', function() {
        compareTree(
            'func int:foo(int:x, str:y) {func bar(bool:z){}}',
            _root([
                node(
                    'Function',
                    0,
                    47,
                    {
                        returnType: _type('int'),
                        name: 'foo',
                        params: [
                            _typed('x', _type('int')),
                            _typed('y', _type('str'))
                        ],
                        body: [
                            node(
                                'Function',
                                28,
                                46,
                                {
                                    returnType: null,
                                    name: 'bar',
                                    params: [
                                        _typed('z', _type('bool'))
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
    it('should parse return statements', function() {
        compareTree(
            'func int:foo() {return 3;}',
            _root([
                node(
                    'Function',
                    0,
                    26,
                    {
                        returnType: _type('int'),
                        name: 'foo',
                        params: [],
                        body: [
                            node(
                                'Return',
                                16,
                                25,
                                {value: _int(3)}
                            )
                        ]
                    }
                )
            ])
        );
    });
    it('should parse bare return statements', function() {
        compareTree(
            'func int:foo() {return;}',
            _root([
                node(
                    'Function',
                    0,
                    24,
                    {
                        returnType: _type('int'),
                        name: 'foo',
                        params: [],
                        body: [
                            node(
                                'Return',
                                16,
                                23,
                                {value: null}
                            )
                        ]
                    }
                )
            ])
        );
    });
    it('should parse function expressions', function() {
        compareTree(
            'var foo = func int() {return 1;};',
            _root([
                node(
                    'Declaration',
                    0,
                    33,
                    {
                        declType: null,
                        identifier: 'foo',
                        value: node(
                            'Function',
                            9,
                            32,
                            {
                                returnType: _type('int'),
                                name: null,
                                params: [],
                                body: [
                                    node(
                                        'Return',
                                        22,
                                        31,
                                        {value: _int(1)}
                                    )
                                ]
                            }
                        ),
                    }
                )
            ])
        );
    });
    it('should parse function expressions with no parameter list', function() {
        compareTree(
            'var foo = func int {return 1;};',
            _root([
                node(
                    'Declaration',
                    0,
                    31,
                    {
                        declType: null,
                        identifier: 'foo',
                        value: node(
                            'Function',
                            9,
                            30,
                            {
                                returnType: _type('int'),
                                name: null,
                                params: [],
                                body: [
                                    node(
                                        'Return',
                                        20,
                                        29,
                                        {value: _int(1)}
                                    )
                                ]
                            }
                        ),
                    }
                )
            ])
        );
    });
    it('should parse void function expressions', function() {
        compareTree(
            'var foo = func() {return;};',
            _root([
                node(
                    'Declaration',
                    0,
                    27,
                    {
                        declType: null,
                        identifier: 'foo',
                        value: node(
                            'Function',
                            9,
                            26,
                            {
                                returnType: null,
                                name: null,
                                params: [],
                                body: [
                                    node(
                                        'Return',
                                        18,
                                        25,
                                        {value: null}
                                    )
                                ]
                            }
                        ),
                    }
                )
            ])
        );
    });
    it('should parse void function expressions with no parameter list', function() {
        compareTree(
            'var foo = func {return;};',
            _root([
                node(
                    'Declaration',
                    0,
                    25,
                    {
                        declType: null,
                        identifier: 'foo',
                        value: node(
                            'Function',
                            9,
                            24,
                            {
                                returnType: null,
                                name: null,
                                params: [],
                                body: [
                                    node(
                                        'Return',
                                        16,
                                        23,
                                        {value: null}
                                    )
                                ]
                            }
                        ),
                    }
                )
            ])
        );
    });
});
