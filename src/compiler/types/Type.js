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
        const x = Object.assign(Object.create(this.constructor.prototype), this);
        x.constructor = this.constructor;
        x.prototype = this.prototype;

        Object.keys(x).forEach(key => {
            if (Array.isArray(x[key])) {
                x[key] = x[key].slice(0);
            }
        });

        return x;
    }

};
