var assert = require('assert');

var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;


describe('Binary operator parser', function() {
    it('should parse binops around literals', function() {
        compareTree(
            'x = 3 + 4;',
            _root([
                node(
                    'Assignment',
                    0,
                    10,
                    {
                        base: _i('x'),
                        value: node(
                            'Binop',
                            3,
                            9,
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

    it('should parse nested binops', function() {
        compareTree(
            'x = 3 + 4 + 5;',
            _root([
                node(
                    'Assignment',
                    0,
                    14,
                    {
                        base: _i('x'),
                        value: node(
                            'Binop',
                            3,
                            13,
                            {
                                left: node(
                                    'Binop',
                                    3,
                                    9,
                                    {
                                        left: _int(3),
                                        right: _int(4),
                                        operator: '+'
                                    }
                                ),
                                right: _int(5),
                                operator: '+'
                            }
                        )
                    }
                )
            ])
        );
    });
    it('should parse nested binops with inverted precedence', function() {
        compareTree(
            'x = 3 * 4 + 5;',
            _root([
                node(
                    'Assignment',
                    0,
                    14,
                    {
                        base: _i('x'),
                        value: node(
                            'Binop',
                            3,
                            13,
                            {
                                left: node(
                                    'Binop',
                                    3,
                                    9,
                                    {
                                        left: _int(3),
                                        right: _int(4),
                                        operator: '*'
                                    }
                                ),
                                right: _int(5),
                                operator: '+'
                            }
                        )
                    }
                )
            ])
        );
    });
    it('should parse complex binary operations', function() {
        compareTree(
            'x = 3 * 4 <= 20 or 5 % 2 * 2 == 2 and true;',
            _root([
                node(
                    'Assignment',
                    0,
                    43,
                    {
                        base: _i('x'),
                        value: node(
                            'LogicalBinop',
                            3,
                            42,
                            {
                                left: node(
                                    'RelativeBinop',
                                    3,
                                    15,
                                    {
                                        left: node(
                                            'Binop',
                                            3,
                                            9,
                                            {
                                                left: _int(3),
                                                right: _int(4),
                                                operator: '*'
                                            }
                                        ),
                                        right: _int(20),
                                        operator: '<='
                                    }
                                ),
                                right: node(
                                    'LogicalBinop',
                                    18,
                                    42,
                                    {
                                        left: node(
                                            'EqualityBinop',
                                            18,
                                            33,
                                            {
                                                left: node(
                                                    'Binop',
                                                    18,
                                                    28,
                                                    {
                                                        left: node(
                                                            'Binop',
                                                            18,
                                                            24,
                                                            {
                                                                left: _int(5),
                                                                right: _int(2),
                                                                operator: '%'
                                                            }
                                                        ),
                                                        right: _int(2),
                                                        operator: '*'
                                                    }
                                                ),
                                                right: _int(2),
                                                operator: '=='
                                            }
                                        ),
                                        right: node(
                                            'Literal',
                                            38,
                                            42,
                                            {
                                                value: true,
                                                litType: 'bool'
                                            }
                                        ),
                                        operator: 'and'
                                    }
                                ),
                                operator: 'or'
                            }
                        )
                    }
                )
            ])
        );
    });

    it('should fail when the file ends mid-expression', function() {
        assert.throws(function() {
            parser(lexer('x = 1 +'));
        });
    });
});
