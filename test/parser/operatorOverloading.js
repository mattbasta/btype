var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var _type = require('./_utils')._type;
var _typed = require('./_utils')._typed;


describe('operator overload declarations', function() {
    it('should parse fine', function() {
        compareTree(
            'operator (int:x * int:y) int {return x - y;}',
            _root([
                node(
                    'OperatorStatement',
                    0,
                    44,
                    {
                        left: _typed('x', _type('int')),
                        right: _typed('x', _type('int')),
                        returnType: _type('int'),
                        operator: '*',
                        body: [node(
                            'Return',
                            30,
                            43,
                            {
                                value: node(
                                    'Binop',
                                    36,
                                    42,
                                    {
                                        left: _i('x'),
                                        right: _i('y'),
                                        operator: '-',
                                    }
                                ),
                            }
                        )],
                    }
                )
            ])
        );
    });
    it('should parse fine for double-character operators', function() {
        compareTree(
            'operator (int:x << int:y) int {return x - y;}',
            _root([
                node(
                    'OperatorStatement',
                    0,
                    45,
                    {
                        left: _typed('x', _type('int')),
                        right: _typed('x', _type('int')),
                        returnType: _type('int'),
                        operator: '<<',
                        body: [node(
                            'Return',
                            31,
                            44,
                            {
                                value: node(
                                    'Binop',
                                    37,
                                    43,
                                    {
                                        left: _i('x'),
                                        right: _i('y'),
                                        operator: '-',
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
