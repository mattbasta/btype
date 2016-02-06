import Type from './Type';


export default class Module extends Type {
    constructor(mod) {
        super();
        this.mod = mod;
        this.memberMapping = mod.exports;

        this._type = 'module';
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

    hasType(name) {
        return this.mod.exportPrototypes.has(name);
    }

    getTypeOf(name, attributes) {
        return this.mod.resolveType(name, attributes || []);
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
