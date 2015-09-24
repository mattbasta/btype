
var assert = require('assert');

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _int = require('./_utils')._int;
var _root = require('./_utils')._root;
var node = require('./_utils').node;


describe('Tuple literal parsing', function() {

    it('should work with basic tuples', function() {
        compareTree(
            'x = [:1, 2];',
            _root([
                node(
                    'Assignment',
                    0,
                    12,
                    {
                        base: _i('x'),
                        value: node(
                            'TupleLiteral',
                            4,
                            11,
                            {
                                elements: [
                                    _int(1),
                                    _int(2),
                                ]
                            }
                        )
                    }
                )
            ])
        );
    });
});
