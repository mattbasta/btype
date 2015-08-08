'use strict';
require('babel/register');


var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var node = require('./_utils').node;


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
