var types = require('../types');

var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    this.content.forEach(function(c) {
        cb(c, 'content');
    });
};

exports.substitute = function substitute(cb) {
    this.content = this.content.map(function(item) {
        return cb(item, 'content');
    }).filter(ident);
};

exports.getType = function getType(ctx) {
    var typeArr = this.content.map(function(item) {
        return item.getType(ctx);
    });
    return new types.Tuple(typeArr);
};

exports.validateTypes = function validateTypes(ctx) {
    this.content.forEach(function(item) {
        item.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Tuple:\n' +
           indentEach(this.content.map(function(x) {return x.toString()}).join('\n'));
};

exports.translate = function translate() {
    this.content = this.content.map(function(p) {
        return p.translate();
    });
    return this;
};
