'use strict';
require('babel/register');


var assert = require('assert');

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var node = require('./_utils').node;


describe('Assignments and declaration parser', function() {
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
                            4,
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
                        name: 'x',
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
                        type: _type('int'),
                        name: 'x',
                        value: _i('y')
                    }
                )
            ])
        );
    });
    it('should parse complex typed declarations', function() {
        compareTree(
            'func<null>:x = y;',
            _root([
                node(
                    'Declaration',
                    0,
                    17,
                    {
                        type: _type('func', [null]),
                        name: 'x',
                        value: _i('y')
                    }
                )
            ])
        );
    });


    it('should parse basic constant declarations', function() {
        compareTree(
            'const x = y;',
            _root([
                node(
                    'ConstDeclaration',
                    0,
                    12,
                    {
                        type: null,
                        name: 'x',
                        value: _i('y')
                    }
                )
            ])
        );
    });

    it('should not accept assignments to call expressions', function() {
        assert.throws(function() {
            parser(lexer('foo() = bar;'));
        });
    });
});
