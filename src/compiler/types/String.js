import Array_ from './Array';
import * as types from '../types';
import Type from './Type';


export default class String extends Type {
    constructor() {
        super();
        this._type = 'string';
    }

    subscript(index) {
        return 8 + index * 4; // 4 == sizeof(uint)
    }

    getSize() {
        return null;
    }

    flatTypeName() {
        return 'string';
    }

    toString() {
        return 'string';
    }

    equals(x) {
        if (x instanceof Array_ && x.contentsType.equals(types.privateTypes.uint)) return true;
        return x instanceof String;
    }

    getSubscriptType(index) {
        return types.privateTypes.uint;
    }

    hasMember(name) {
        return name === 'length';
    }

    getMemberType(name) {
        return types.publicTypes.int;
    }

};
