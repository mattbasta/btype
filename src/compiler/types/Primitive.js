export default class Primitive {
    constructor(typeName, backing) {
        this.typeName = typeName;
        this.backing = backing;

        this._type = 'primitive';
    }

    getSize() {
        switch (this.typeName) {
            case 'int':
            case 'uint':
            case 'sfloat':
                return 4;
            case 'byte':
            case 'bool':
                return 1;
            case 'float':
                return 8;
        }
    }

    toString() {
        return this.typeName;
    }

    flatTypeName() {
        return this.typeName;
    }

    equals(x) {
        return x instanceof Primitive && this.typeName === x.typeName;
    }

    isSubscriptable() {
        return false;
    }

    hasStaticMethod() {
        return false;
    }

};
