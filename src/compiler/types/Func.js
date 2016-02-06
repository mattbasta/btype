import Type from './Type';


export default class Func extends Type {
    constructor(returnType, args) {
        super();
        this.returnType = returnType;
        this.args = args;

        this._type = 'func';
    }

    equals(x) {
        if (!(x instanceof Func)) return false;
        if (!(this.returnType ? this.returnType.equals(x.returnType) : !x.returnType)) return false;
        if (this.args.length !== x.args.length) return false;
        return this.args.every((arg, i) => {
            return arg.equals(x.args[i]);
        });
    }

    toString() {
        return 'func<' +
            (this.returnType ? this.returnType.toString() : 'null') +
            (this.args.length ? ',' + this.args.map(arg => arg.toString()).join(',') : '') +
            '>';
    }

    flatTypeName(ctxPointers) {
        return 'func$' +
            (this.returnType ? this.returnType.flatTypeName() : 'null') +
            (this.args.length ? '$' + this.args.map(arg => arg.flatTypeName(ctxPointers)).join('$') : '') +
            '$$';
    }

    getReturnType() {
        return this.returnType;
    }

    getArgs() {
        return this.args;
    }

    getSize() {
        // This should return the size of a function reference.
        return 8; // 4 for functable index, 4 for pointer to context
    }
};
