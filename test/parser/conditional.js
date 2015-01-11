var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;


describe('Conditional parser', function() {
    it('should parse simple blocks', function() {
        compareTree(
            'if(x) {foo();}',
            _root([
                node(
                    'If',
                    0,
                    14,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            7,
                            13,
                            {
                                base: node(
                                    'CallRaw',
                                    7,
                                    13,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: null
                    }
                )
            ])
        );
    });
    it('should parse single statements without braces', function() {
        compareTree(
            'if(x) foo();',
            _root([
                node(
                    'If',
                    0,
                    12,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            5,
                            12,
                            {
                                base: node(
                                    'CallRaw',
                                    5,
                                    12,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: null
                    }
                )
            ])
        );
    });
    it('should parse simple alternates', function() {
        compareTree(
            'if(x) {foo();} else {bar();}',
            _root([
                node(
                    'If',
                    0,
                    28,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            7,
                            13,
                            {
                                base: node(
                                    'CallRaw',
                                    7,
                                    13,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: [node(
                            'CallStatement',
                            21,
                            27,
                            {
                                base: node(
                                    'CallRaw',
                                    21,
                                    27,
                                    {
                                        callee: _i('bar'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                    }
                )
            ])
        );
    });
    it('should parse simple alternates without braces', function() {
        compareTree(
            'if(x) foo(); else bar();',
            _root([
                node(
                    'If',
                    0,
                    24,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            5,
                            12,
                            {
                                base: node(
                                    'CallRaw',
                                    5,
                                    12,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: [node(
                            'CallStatement',
                            17,
                            24,
                            {
                                base: node(
                                    'CallRaw',
                                    17,
                                    24,
                                    {
                                        callee: _i('bar'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                    }
                )
            ])
        );
    });
    it('should parse simple alternates without braces', function() {
        compareTree(
            'if(x) foo(); else if (y)bar();',
            _root([
                node(
                    'If',
                    0,
                    30,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            5,
                            12,
                            {
                                base: node(
                                    'CallRaw',
                                    5,
                                    12,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: [node(
                            'If',
                            17,
                            30,
                            {
                                condition: _i('y'),
                                consequent: [node(
                                    'CallStatement',
                                    24,
                                    30,
                                    {
                                        base: node(
                                            'CallRaw',
                                            24,
                                            30,
                                            {
                                                callee: _i('bar'),
                                                params: []
                                            }
                                        ),
                                    }
                                )],
                                alternate: null,
                            }
                        )]
                    }
                )
            ])
        );
    });
});
