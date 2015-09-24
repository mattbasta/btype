
var compareTree = require('./_utils').compareTree;
var _float = require('./_utils')._float;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;
var node = require('./_utils').node;


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
                        type: _type('int'),
                        name: 'x',
                        value: node(
                            'TypeCast',
                            8,
                            18,
                            {
                                base: _float('2.5'),
                                target: _type('int'),
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
                        type: _type('int'),
                        name: 'x',
                        value: node(
                            'Binop',
                            8,
                            22,
                            {
                                left: node(
                                    'TypeCast',
                                    8,
                                    18,
                                    {
                                        base: _float('2.5'),
                                        target: _type('int'),
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
