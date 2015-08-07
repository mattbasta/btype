'use strict';
require('babel/register');

import assert from 'assert';

import lexer from '../src/lexer';
var parser = require('../src/parser');
var node = require('../src/parser').node;

var compareTree = require('./parser/_utils').compareTree;
var _i = require('./parser/_utils')._i;
var _int = require('./parser/_utils')._int;
var _root = require('./parser/_utils')._root;
var _type = require('./parser/_utils')._type;
var _typed = require('./parser/_utils')._typed;


describe('Parser', function() {
    it('should parse blank scripts', function() {
        compareTree('', _root([]));
    });

    describe('parenthesized expressions', function() {
        it('should parse properly', function() {
            compareTree(
                'x = (3 + 4);',
                _root([
                    node(
                        'Assignment',
                        0,
                        12,
                        {
                            base: _i('x'),
                            value: node(
                                'Binop',
                                5,
                                10,
                                {
                                    left: _int(3),
                                    right: _int(4),
                                    operator: '+'
                                }
                            )
                        }
                    )
                ])
            );
        });
    });

    describe('floats', function() {
        it('should parse properly', function() {
            compareTree(
                'x = 1.23456;',
                _root([
                    node(
                        'Assignment',
                        0,
                        12,
                        {
                            base: _i('x'),
                            value: node(
                                'Literal',
                                5,
                                10,
                                {
                                    litType: 'float',
                                    value: 1.23456
                                }
                            )
                        }
                    )
                ])
            );
        });
        it('should parse negative numbers properly', function() {
            compareTree(
                'x = -1.23456;',
                _root([
                    node(
                        'Assignment',
                        0,
                        13,
                        {
                            base: _i('x'),
                            value: node(
                                'Literal',
                                5,
                                11,
                                {
                                    litType: 'float',
                                    value: -1.23456
                                }
                            )
                        }
                    )
                ])
            );
        });
    });

    describe('null', function() {
        it('should be parsed properly', function() {
            compareTree(
                'x = null;',
                _root([
                    node(
                        'Assignment',
                        0,
                        9,
                        {
                            base: _i('x'),
                            value: node(
                                'Literal',
                                3,
                                7,
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
    });

    describe('`while` loops', function() {
        it('should parse `while` loops', function() {
            compareTree(
                'while(x) {foo();}',
                _root([
                    node(
                        'While',
                        0,
                        17,
                        {
                            condition: _i('x'),
                            body: [node(
                                'CallStatement',
                                10,
                                16,
                                {
                                    base: node(
                                        'CallRaw',
                                        10,
                                        15,
                                        {
                                            callee: _i('foo'),
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
    });

    describe('`do`/`while` loops', function() {
        it('should parse `do`/`while` loops', function() {
            compareTree(
                'do {foo();} while(x);',
                _root([
                    node(
                        'DoWhile',
                        0,
                        21,
                        {
                            condition: _i('x'),
                            body: [node(
                                'CallStatement',
                                4,
                                10,
                                {
                                    base: node(
                                        'CallRaw',
                                        4,
                                        9,
                                        {
                                            callee: _i('foo'),
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
    });

    describe('`for` loops', function() {
        it('should parse for loops', function() {
            compareTree(
                'for x = 0; x < 10; x = x + 1; {foo();}',
                _root([
                    node(
                        'For',
                        0,
                        38,
                        {
                            assignment: node(
                                'Assignment',
                                4,
                                10,
                                {
                                    base: _i('x'),
                                    value: _int(0)
                                }
                            ),
                            condition: node(
                                'RelativeBinop',
                                11,
                                17,
                                {
                                    operator: '<',
                                    left: _i('x'),
                                    right: _int(10)
                                }
                            ),
                            iteration: node(
                                'Assignment',
                                19,
                                29,
                                {
                                    base: _i('x'),
                                    value: node(
                                        'Binop',
                                        23,
                                        28,
                                        {
                                            operator: '+',
                                            left: _i('x'),
                                            right: _int(1)
                                        }
                                    )
                                }
                            ),
                            body: [node(
                                'CallStatement',
                                31,
                                37,
                                {
                                    base: node(
                                        'CallRaw',
                                        31,
                                        36,
                                        {
                                            callee: _i('foo'),
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
        it('should parse for loops without an iteration', function() {
            compareTree(
                'for x = 0; x < 10; {foo();}',
                _root([
                    node(
                        'For',
                        0,
                        27,
                        {
                            assignment: node(
                                'Assignment',
                                4,
                                10,
                                {
                                    base: _i('x'),
                                    value: _int(0)
                                }
                            ),
                            condition: node(
                                'RelativeBinop',
                                11,
                                17,
                                {
                                    operator: '<',
                                    left: _i('x'),
                                    right: _int(10)
                                }
                            ),
                            iteration: null,
                            body: [node(
                                'CallStatement',
                                20,
                                26,
                                {
                                    base: node(
                                        'CallRaw',
                                        20,
                                        25,
                                        {
                                            callee: _i('foo'),
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
    });

    describe('unary operators', function() {
        it('should parse simple operators', function() {
            compareTree(
                'x = !y;',
                _root([
                    node(
                        'Assignment',
                        0,
                        7,
                        {
                            base: _i('x'),
                            value: node(
                                'Unary',
                                4,
                                6,
                                {
                                    base: _i('y'),
                                    operator: '!'
                                }
                            )
                        }
                    )
                ])
            );
        });
        it('should parse chained operators', function() {
            compareTree(
                'x = !!y;',
                _root([
                    node(
                        'Assignment',
                        0,
                        8,
                        {
                            base: _i('x'),
                            value: node(
                                'Unary',
                                4,
                                7,
                                {
                                    base: node(
                                        'Unary',
                                        5,
                                        7,
                                        {
                                            base: _i('y'),
                                            operator: '!'
                                        }
                                    ),
                                    operator: '!'
                                }
                            )
                        }
                    )
                ])
            );
        });
    });

    describe('invalid assertions', function() {

        // Some examples of invalid code
        [
            'func () {}',
            ';',
            'x++;',
            'if (x || y) {}',
            'if (x and and y) {}',
            '// lol this is not a comment',
            // NOTE: Until we have augmented assignment operators, these are invalid.
            'x += 1;',
            'x -= 1;',
        ].forEach(function(str) {
            it('should fail for "' + str + '"', function() {
                var output;

                try {
                    assert.throws(function() {
                        output = parser(lexer(str));
                    });
                } catch (e) {
                    console.error(output.toString());
                    throw e;
                }
            });
        });

    });

});
