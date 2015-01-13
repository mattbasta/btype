var node = require('../../src/parser').node;

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;


describe('Export parser', function() {
    it('should parse export statements', function() {
        compareTree(
            'export foo;',
            _root([
                node(
                    'Export',
                    0,
                    11,
                    {value: 'foo'}
                )
            ])
        );
    });

});
