var types = require('../types');


exports.traverse = function traverse(cb) {
    if (this.attributes) {
        this.attributes.forEach(function(attribute) {
            if (attribute) cb(attribute, 'attributes');
        });
    }
};

exports.substitute = function substitute() {
    // TODO: should this substitute attributes?
};

exports.getType = function getType(ctx) {
    if (this.__type) {
        return this.__type;
    }

    if (this.name === 'func') {
        this.__type = new types.Func(
            this.attributes[0] && this.attributes[0].getType(ctx),
            this.attributes.slice(1).map(function(attribute) {
                return attribute.getType(ctx);
            })
        );
    } else if (this.name === 'array') {
        this.__type = new types.Array(this.attributes[0].getType(ctx));
    } else if (this.name === 'tuple') {
        this.__type = new types.Tuple(this.attributes.map(function(t) {return t.getType(ctx);}));
    } else {
        this.__type = ctx.resolveType(
            this.name,
            this.attributes.map(function(a) {
                return a.getType(ctx);
            }
        ));
    }

    return this.__type;

};

exports.validateTypes = function validateTypes() {};

exports.toString = function toString() {
    return '<' + this.name +
        (this.__type ? ':' + (this.__type.__assignedName || 'unassigned') : '') +
        (this.attributes.length ?
            '; ' + this.attributes.map(function(attribute) {
                return attribute ? attribute.toString() : 'null';
            }).join(', ') :
            '') +
        '>';
};

exports.translate = function translate(ctx) {
    this.attributes = this.attributes.map(function(p) {
        return p.translate(ctx);
    });
    return this;
};
