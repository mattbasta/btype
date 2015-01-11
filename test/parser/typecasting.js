var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _float = require('./_utils')._float;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;


describe('Typecast parser', function() {
    it('should parse basic typecasts', function() {
        compareTree(
            'int:x = 2.5 as int;',
            _root([
                node(
                    'Declaration',
                    0,
                    19,
                    {
                        identifier: 'x',
                        declType: _type('int'),
                        value: node(
                            'TypeCast',
                            7,
                            18,
                            {
                                left: _float('2.5'),
                                rightType: _type('int'),
                            }
                        ),
                    }
                )
            ])
        );
    });

    it('should fit in with other operators', function() {
        compareTree(
            'int:x = 2.5 as int + 1;',
            _root([
                node(
                    'Declaration',
                    0,
                    23,
                    {
                        identifier: 'x',
                        declType: _type('int'),
                        value: node(
                            'Binop',
                            7,
                            22,
                            {
                                left: node(
                                    'TypeCast',
                                    7,
                                    18,
                                    {
                                        left: _float('2.5'),
                                        rightType: _type('int'),
                                    }
                                ),
                                operator: '+',
                                right: _int(1),
                            }
                        ),
                    }
                )
            ])
        );
    });

});
