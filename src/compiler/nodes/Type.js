var types = require('../types');


exports.traverse = function traverse(cb) {
    if (this.traits) {
        this.traits.forEach(function(trait) {
            if (trait) cb(trait, 'traits');
        });
    }
};

exports.substitute = function substitute() {};

exports.getType = function getType(ctx) {
    if (this.__type) {
        return this.__type;
    }

    if (this.name === 'func') {
        return this.__type = new types.Func(
            this.traits[0] && this.traits[0].getType(ctx),
            this.traits.slice(1).map(function(trait) {
                return trait.getType(ctx);
            })
        );
    } else if (this.name === 'array') {
        return this.__type = new types.Array_(this.traits[0].getType(ctx));
    }

    if (this.name === 'date') debugger;
    return this.__type = ctx.resolveType(this.name);
};

exports.validateTypes = function validateTypes() {};

exports.toString = function toString() {
    return '<' + this.name + (this.traits.length ? '; ' + this.traits.map(function(trait) {return trait ? trait.toString() : 'null';}).join(', ') : '') + '>';
};
