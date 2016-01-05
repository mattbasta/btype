export default class Module {
    constructor(mod) {
        this.mod = mod;
        this.memberMapping = mod.exports;

        this._type = 'module';
    }

    equals() {
        return false;
    }

    flatTypeName() {
        return 'module';
    }

    hasMember(name) {
        return this.memberMapping.has(name);
    }

    getMemberType(name) {
        return this.mod.typeMap.get(this.memberMapping.get(name));
    }

    hasMethod() {
        return false;
    }

    hasType(name) {
        return this.mod.exportPrototypes.has(name);
    }

    getTypeOf(name, attributes) {
        return this.mod.resolveType(name, attributes || []);
    }

    isSubscriptable() {
        return false;
    }

    hasStaticMethod(name) {
        return this.memberMapping.has(name);
    }

    getStaticMethod(name) {
        return this.memberMapping.get(name);
    }

    getStaticMethodType(name) {
        var assignedName = this.getStaticMethod(name);
        return this.mod.typeMap.get(assignedName);
    }

};
