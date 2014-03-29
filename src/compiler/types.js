
module.exports = function type(name, traits) {
    this.name = name;
    this.traits = traits || [];
};

module.exports.prototype.equals = function(type) {
    if (type.name !== this.name) return false;
    if (type.traits.length !== this.traits.length) return false;
    for (var i = 0; i < this.traits.length; i++) {
        if (!this.traits[i].equals(type.traits[i])) return false;
    }
    return true;
};
