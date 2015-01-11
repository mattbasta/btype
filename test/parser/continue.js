var assert = require('assert');

var lexer = require('../../src/lexer');
var parser = require('../../src/parser');

var node = parser.node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;


describe('`continue` parser', function() {
    it('should be valid within `for` loops', function() {
        compareTree(
            'for (x = 0; x < 10; x = x + 1;) {continue;}',
            _root([
                node(
                    'For',
                    0,
                    43,
                    {
                        assignment: node(
                            'Assignment',
                            5,
                            11,
                            {
                                base: _i('x'),
                                value: _int(0)
                            }
                        ),
                        condition: node(
                            'RelativeBinop',
                            11,
                            18,
                            {
                                operator: '<',
                                left: _i('x'),
                                right: _int(10)
                            }
                        ),
                        iteration: node(
                            'Assignment',
                            19,
                            30,
                            {
                                base: _i('x'),
                                value: node(
                                    'Binop',
                                    23,
                                    29,
                                    {
                                        operator: '+',
                                        left: _i('x'),
                                        right: _int(1)
                                    }
                                )
                            }
                        ),
                        loop: [node('Continue', 33, 41, {})],
                    }
                )
            ])
        );
    });
    it('should be valid within `while` loops', function() {
        compareTree(
            'while (x) {continue;}',
            _root([
                node(
                    'While',
                    0,
                    21,
                    {
                        condition: _i('x'),
                        loop: [node('Continue', 11, 19, {})],
                    }
                )
            ])
        );
    });
    it('should be valid within `do/while` loops', function() {
        compareTree(
            'do {continue;} while (x);',
            _root([
                node(
                    'DoWhile',
                    0,
                    25,
                    {
                        condition: _i('x'),
                        loop: [node('Continue', 4, 12, {})],
                    }
                )
            ])
        );
    });

    it('should be invalid outside of loops', function() {
        assert.throws(function() {
            parser(lexer('continue;'));
        });
    });

});
