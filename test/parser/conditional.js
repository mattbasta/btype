
var compareTree = require('./_utils').compareTree;
var _i = require('./_utils')._i;
var _root = require('./_utils')._root;
var node = require('./_utils').node;


describe('Conditional parser', function() {
    it('should parse simple blocks', function() {
        compareTree(
            'if(x) {foo();}',
            _root([
                node(
                    'If',
                    0,
                    14,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            7,
                            13,
                            {
                                call: node(
                                    'Call',
                                    7,
                                    12,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: null
                    }
                )
            ])
        );
    });
    it('should parse simple alternates', function() {
        compareTree(
            'if(x) {foo();} else {bar();}',
            _root([
                node(
                    'If',
                    0,
                    28,
                    {
                        condition: _i('x'),
                        consequent: [node(
                            'CallStatement',
                            7,
                            13,
                            {
                                call: node(
                                    'Call',
                                    7,
                                    12,
                                    {
                                        callee: _i('foo'),
                                        params: []
                                    }
                                ),
                            }
                        )],
                        alternate: [node(
                            'CallStatement',
                            21,
                            27,
                            {
                                call: node(
                                    'Call',
                                    21,
                                    26,
                                    {
                                        callee: _i('bar'),
                                        params: []
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
