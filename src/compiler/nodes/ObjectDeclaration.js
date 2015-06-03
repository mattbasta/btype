var types = require('../types');

var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    this.members.forEach(function traverseObjectDeclMembers(stmt) {
        cb(stmt, 'members');
    });
    this.methods.forEach(function traverseObjectDeclMethods(stmt) {
        cb(stmt, 'methods');
    });
    this.operators.forEach(function traverseObjectDeclOperators(stmt) {
        cb(stmt, 'operator');
    });
    if (this.objConstructor) cb(this.objConstructor, 'objConstructor');
};

exports.substitute = function substitute(cb) {
    this.members = this.members.map(function(stmt) {
        return cb(stmt, 'members');
    }).filter(ident);
    this.methods = this.methods.map(function(stmt) {
        return cb(stmt, 'methods');
    }).filter(ident);
    this.objConstructor = cb(this.objConstructor, 'objConstructor') || this.objConstructor;
};

exports.getIncompleteType = function getIncompleteType(ctx) {
    if (this.__type) return this.__type;
    if (this.__incompleteType) return this.__incompleteType;

    var mapping = this.__typeMapping = this.__typeMapping || {};
    var incompleteType = new types.Struct(this.name, mapping);
    incompleteType.__assignedName = this.__assignedName;
    this.__incompleteType = incompleteType;
    return incompleteType;
};

exports.getType = function getType(ctx) {
    if (this.__type) return this.__type;

    var output = this.getIncompleteType(ctx);
    var mapping = this.__typeMapping;

    // NOTE: There's some serious knife-throwing going on here. To support
    // recursive and self-referencing types, an empty mapping is passed and
    // populated after the fact.

    this.members.forEach(function getTypeObjectDeclMemberIter(member) {
        mapping[member.name] = member.getType(ctx);
        if (member.isPrivate) {
            output.privateMembers[member.name] = true;
        }
        if (member.isFinal) {
            output.finalMembers[member.name] = true;
        }
    });

    if (this.objConstructor) {
        output.objConstructor = this.objConstructor.base.__assignedName;
        if (this.objConstructor.isFinal) {
            output.finalMembers['new'] = true;
        }
    }

    if (this.methods.length) {
        this.methods.forEach(function getTypeObjectDeclMethodIter(method) {
            output.methods[method.name] = method.base.__assignedName;
            if (method.isPrivate) {
                output.privateMembers[method.name] = true;
            }
            if (method.isFinal) {
                output.finalMembers[method.name] = true;
            }
        });
    }

    return this.__type = output;
};

exports.translate = function translate(ctx, constructing) {
    if (!constructing) return this;
    this.members = this.members.map(function(s) {
        return s.translate(ctx);
    });
    this.methods = this.methods.map(function(s) {
        return s.translate(ctx);
    });
    this.operators = this.operators.map(function(s) {
        return s.translate(ctx);
    });
    if (this.objConstructor) this.objConstructor = this.objConstructor.translate(ctx);
    return this;
};

exports.validateTypes = function validateTypes(ctx) {
    if (!this.__isConstructed) return;

    if (this.objConstructor) this.objConstructor.validateTypes(ctx);

    this.members.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
    this.methods.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Object(' + this.name + (this.__assignedName ? '::' + this.__assignedName : '') + '):\n' +
        '    Members:\n' +
        indentEach(this.members.map(function(member) {return member.toString();}).join('\n'), 2) + '\n' +
        '    Constructor:\n' +
        (this.objConstructor ? indentEach(this.objConstructor.toString(), 2) : '        void') + '\n' +
        '    Methods:\n' +
        indentEach(this.methods.map(function(method) {
            return method.name + ': ' + method.toString();
        }).join('\n'), 2);
};


exports.rewriteAttributes = function rewriteAttributes(attributes) {
    if (attributes.length !== this.attributes.length) {
        throw new TypeError('Wrong number of attributes passed to object prototype: ' + attributes.length + ' != ' + this.attributes.length);
    }

    var me = this;
    require('../traverser').traverse(this, function attributeRewriteTraverser(node) {
        if (node.type !== 'Type') return;

        var idx;
        // Replace attribute identifiers with their actual types.
        if ((idx = me.attributes.indexOf(node.name)) !== -1) {
            if (node.attributes.length) {
                throw new TypeError('Cannot apply attributes to attributes defined in object declaration');
            }

            // Don't bother changing the semantics of the code, just define the
            // magic type.
            node.__type = attributes[idx];
            node.name = attributes[idx].toString();
            return;
        }

        // Replace self-references with versions that include attributes
        if (node.name === me.name && node.attributes.length === 0) {
            var nodes = require('../nodes');
            node.attributes = attributes.map(function(attr) {
                return new nodes.Type({
                    __type: attr,
                    name: attr.toString(),
                    attributes: [],
                });
            });
        }

    });

    this.__origAttributes = this.attributes;
    this.attributes = [];

};
