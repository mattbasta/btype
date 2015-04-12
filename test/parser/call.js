var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;


describe('Call parser', function() {
    it('should parse call statements', function() {
        compareTree(
            'foo();',
            _root([
                node(
                    'CallStatement',
                    0,
                    6,
                    {
                        base: node(
                            'CallRaw',
                            0,
                            5,
                            {
                                callee: _i('foo'),
                                params: []
                            }
                        ),
                    }
                )
            ])
        );
    });
    it('should parse call expressions', function() {
        compareTree(
            'x = foo();',
            _root([
                node(
                    'Assignment',
                    0,
                    10,
                    {
                        base: _i('x'),
                        value: node(
                            'CallRaw',
                            4,
                            9,
                            {
                                callee: _i('foo'),
                                params: []
                            }
                        )
                    }
                )
            ])
        );
    });
    it('should parse calls with parameters', function() {
        compareTree(
            'foo(x, y, bar());',
            _root([
                node(
                    'CallStatement',
                    0,
                    17,
                    {
                        base: node(
                            'CallRaw',
                            0,
                            16,
                            {
                                callee: _i('foo'),
                                params: [
                                    _i('x'),
                                    _i('y'),
                                    node(
                                        'CallRaw',
                                        10,
                                        15,
                                        {
                                            callee: _i('bar'),
                                            params: []
                                        }
                                    )
                                ]
                            }
                        ),
                    }
                )
            ])
        );
    });
    it('should parse chained calls', function() {
        compareTree(
            'foo()();',
            _root([
                node(
                    'CallStatement',
                    0,
                    8,
                    {
                        base: node(
                            'CallRaw',
                            0,
                            7,
                            {
                                callee: node(
                                    'CallRaw',
                                    0,
                                    5,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                                params: []
                            }
                        ),
                    }
                )
            ])
        );
    });
});
