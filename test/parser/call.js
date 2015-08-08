'use strict';
require('babel/register');


var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var node = require('./_utils').node;


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
                        call: node(
                            'Call',
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
                            'Call',
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
                        call: node(
                            'Call',
                            0,
                            16,
                            {
                                callee: _i('foo'),
                                params: [
                                    _i('x'),
                                    _i('y'),
                                    node(
                                        'Call',
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
                        call: node(
                            'Call',
                            0,
                            7,
                            {
                                callee: node(
                                    'Call',
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
