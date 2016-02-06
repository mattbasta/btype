import {memberSize} from './_utils';
import String from './String';
import Type from './Type';
import {publicTypes} from '../types';


export default class Array extends Type {
    constructor(contentsType) {
        super();
        this.contentsType = contentsType;
        this._type = 'array';
    }

    subscript(index) {
        // We have an offset of 8 because primitives that take up eight bytes
        // need to be aligned to a multiple of 8 on the heap.
        return 8 + index * memberSize(this.contentType);
    }

    getSize() {
        return null; // Must be special-cased.
    }

    toString() {
        return 'array<' + this.contentsType.toString() + '>';
    }

    flatTypeName() {
        return 'array$' + this.contentsType.flatTypeName();
    }

    equals(x) {
        if (x instanceof String && this.contentsType.equals(types.privateTypes.uint)) return true;
        return x instanceof Array_ && this.contentsType.equals(x.contentsType);
    }

    getSubscriptType() {
        return this.contentsType;
    }

    hasMember(name) {
        return name === 'length';
    }

    getMemberType(name) {
        return publicTypes.int;
    }

};
