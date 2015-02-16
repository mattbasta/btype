var assert = require('assert');

var lexer = require('../../src/lexer');
var parser = require('../../src/parser');

var node = parser.node;


exports.compareTree = function compareTree(script, tree) {
    var parsed = parser(lexer(script));
    function compare(left, right, base, key) {
        if (left instanceof lexer.token) {
            assert.equal(left.text, right.text, 'Expected token "' + key + '" text to be equal in both trees at ' + base + ': "' + left.text + '" != "' + right.text + '"');
            assert.equal(left.type, right.type, 'Expected token "' + key + '" type to be equal in both trees at ' + base + ': "' + left.type + '" != "' + right.type + '"');
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
        if (left && left.type === 'Literal') {
            assert.equal(left.value, right.value, 'Expected literal value to be equal in both trees at ' + base);
            assert.equal(left.litType, right.litType, 'Expected literal type to be equal in both trees at ' + base);
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
                left.type === 'Symbol' ||
                left.type === 'Type' ||
                left.type === 'TypedIdentifier') continue;
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
    return node('Root', null, null, {body: body});
};

exports._i = function _i(text) {
    return node(
        'Symbol',
        {name: text}
    );
};

exports._type = function _type(text, attributes) {
    return node(
        'Type',
        {
            name: text,
            attributes: attributes || []
        }
    );
};

exports._typed = function _typed(ident, type) {
    return node(
        'TypedIdentifier',
        {
            idType: type,
            name: ident
        }
    );
};

exports._int = function _int(val) {
    return node('Literal', {value: val.toString(), litType: 'int'});
};

exports._float = function _float(val) {
    return node('Literal', {value: val.toString(), litType: 'float'});
};
