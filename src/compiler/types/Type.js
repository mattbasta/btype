export default class Type {
    flatTypeName() {
        throw new TypeError(`flatTypeName not declared on ${this.toString()}`);
    }
    equals() {
        return false;
    }

    hasMethod() {
        return false;
    }

    hasMember() {
        return false;
    }

    isSubscriptable() {
        return false;
    }

    hasStaticMethod() {
        return false;
    }

    getSize() {
        return 0;
    }


    clone() {
        var x = Object.create(this.constructor.prototype);
        x = Object.assign(x, this);
        x.constructor = this.constructor;
        x.prototype = this.prototype;
        return x;
    }

};
