
var assert = require('assert');

var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var node = require('./_utils').node;


describe('Import parser', function() {
    it('should parse import statements', function() {
        compareTree(
            'import foo;',
            _root([
                node(
                    'Import',
                    0,
                    11,
                    {
                        base: 'foo',
                        member: null,
                        alias: null,
                    }
                )
            ])
        );
    });
    it('should parse import statements with a member', function() {
        compareTree(
            'import foo.bar;',
            _root([
                node(
                    'Import',
                    0,
                    15,
                    {
                        base: 'foo',
                        member: 'bar',
                        alias: null,
                    }
                )
            ])
        );
    });
    it('should parse import statements with an alias', function() {
        compareTree(
            'import foo as bar;',
            _root([
                node(
                    'Import',
                    0,
                    18,
                    {
                        base: 'foo',
                        member: null,
                        alias: 'bar',
                    }
                )
            ])
        );
    });
    it('should parse import statements with a member and an alias', function() {
        compareTree(
            'import foo.bar as zap;',
            _root([
                node(
                    'Import',
                    0,
                    22,
                    {
                        base: 'foo',
                        member: 'bar',
                        alias: 'zap',
                    }
                )
            ])
        );
    });

    it('should not accept invalid expressions', function() {
        assert.throws(function() {
            parser(lexer('import x + y;'));
        });
    });

    it('should not accept complex imports', function() {
        assert.throws(function() {
            parser(lexer('import foo().x;'));
        });
    });
});
