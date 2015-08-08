import assert from 'assert';

import * as nodes from '../../src/astNodes';
import lexer from '../../src/lexer';
import token from '../../src/lexer';
var parser = require('../../src/parser');

exports.node = function node(name, start, end, params) {
    var x = new nodes[name + 'Node']();
    x.start = start;
    x.end = end;
    Object.keys(params).forEach(k => {
        x[k] = params[k];
    });
    return x;
};


var parse = exports.parse = function parse(script) {
    return parser(lexer(script));
};

exports.compareTree = function compareTree(script, tree) {
    var parsed = parse(script);
    function compare(left, right, base, key) {
        if (left instanceof token) {
            assert.equal(left.text, right.text, 'Expected token "' + key + '" text to be equal in both trees at ' + base + ': "' + left.text + '" != "' + right.text + '"');
            assert.equal(left.prototype, right.prototype, 'Expected token "' + key + '" type to be equal in both trees at ' + base + ': "' + left + '" != "' + right + '"');
            return true;
        }
        if (!!left !== !!right) {
            assert.fail(left, right, 'Mismatched key "' + key + '" at ' + base + ': ' + left + ', ' + right);
        }
        if (left instanceof Array) {
            if (!arrEq(left, right, base + key)) {
                return false;
            }
        } else if (left instanceof Object) {
            if (!objEq(left, right, base + key)) {
                return false;
            }
        } else {
            assert.equal(left, right, 'Expected key "' + key + '" to be equal in both trees at ' + base + ': ' + left + ', ' + right);
        }
        return true;
    }
    function arrEq(left, right, base) {
        assert.equal(left.length, right.length, 'Arrays expected to be the same length at ' + base);
        for (var i = 0; i < left.length; i++) {
            if (!compare(left[i], right[i], base, '[' + i + ']')) return false;
        }
        return true;
    }
    function objEq(left, right, base) {
        base = base || '';
        if (left && left instanceof nodes.LiteralNode) {
            assert.equal(left.value, right.value, 'Expected literal value to be equal in both trees at ' + base + ': ' + left.value + ' !== ' + right.value);
            assert.equal(left.litType, right.litType, 'Expected literal type to be equal in both trees at ' + base + ': ' + left.value + ' !== ' + right.value);
            return true;
        }
        var keys = {};  // A set of string key names
        var key;
        for(key in left) {
            if (!left.hasOwnProperty(key)) continue;
            keys[key] = true;
            if (!(key in right)) {
                assert.fail('Key "' + key + '" was found in generated parse tree but not in expected parse tree at ' + base);
            }
            if ((key === 'start' || key === 'end') &&
                left instanceof nodes.SymbolNode ||
                left instanceof nodes.TypeNode ||
                left instanceof nodes.TypedIdentifierNode) continue;
            compare(left[key], right[key], base, '.' + key);
        }
        for(key in right) {
            if (!right.hasOwnProperty(key)) continue;
            if (!(key in keys)) {
                assert.fail('Key "' + key + '" was found in expected parse tree but not in generated parse tree at ' + base);
            }
        }
        return true;
    }
    assert(compare(parsed, tree, '', ''));
};

exports._root = function _root(body) {
    if (!body.length) {
        return new nodes.RootNode(body, 0, 0);
    }
    return new nodes.RootNode(body, body[0].start, body[body.length - 1].end);
};

exports._i = function _i(text) {
    return new nodes.SymbolNode(text, 0, 0);
};

exports._type = function _type(text, attributes) {
    return new nodes.TypeNode(text, attributes || [], 0, 0);
};

exports._typed = function _typed(ident, type) {
    return new nodes.TypedIdentifierNode(type, ident, 0, 0);
};

exports._int = function _int(val) {
    return new nodes.LiteralNode('int', val.toString(), 0, 0);
};

exports._float = function _float(val) {
    return new nodes.LiteralNode('float', val.toString(), 0, 0);
};
