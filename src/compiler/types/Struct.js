import {memberSize} from './_utils';
import * as symbols from '../../symbols';
import Type from './Type';


const LAYOUT_CACHE = Symbol();
const ORDERED_LAYOUT_CACHE = Symbol();
const LAYOUT_INDICES_CACHE = Symbol();

export default class Struct extends Type {
    constructor(name, contentsTypeMap, attributeTypes = null) {
        super();
        this.typeName = name;
        this.contentsTypeMap = contentsTypeMap;

        this.objConstructor = null;
        this.methods = new Map();
        this.privateMembers = new Set();
        this.finalMembers = new Set();

        // WARNING! This must not do any processing on contentsTypeMap as part of
        // this constructor. All processing must be done by methods. This is to
        // facilitate lazily constructed structs, which are necessary for self-
        // referencing and cyclic type dependencies.

        this._type = 'struct';

        this.attributeTypes = attributeTypes;
    }

    getLayout() {
        if (this[LAYOUT_CACHE]) return this[LAYOUT_CACHE];
        const offsets = {}; // TODO: make this a map?
        let i = 0;
        this.contentsTypeMap.forEach((value, key) => {
            const size = memberSize(value);
            offsets[key] = i;
            i += size;
        });
        return this[LAYOUT_CACHE] = offsets;
    }

    getSortedMemberNames() {
        const keys = Array.from(this.contentsTypeMap.keys());
        keys.sort((a, b) => {
            return memberSize(this.contentsTypeMap.get(a)) < memberSize(this.contentsTypeMap.get(b));
        });
        return keys;
    }

    getOrderedLayout() {
        if (this[ORDERED_LAYOUT_CACHE]) return this[ORDERED_LAYOUT_CACHE];
        const keys = this.getSortedMemberNames();
        const order = keys.map(m => this.contentsTypeMap.get(m));
        return this[ORDERED_LAYOUT_CACHE] = order;
    }

    getLayoutIndex(name) {
        if (this[LAYOUT_INDICES_CACHE]) return this[LAYOUT_INDICES_CACHE].get(name);
        const keys = this.getSortedMemberNames();
        const indices = this[LAYOUT_INDICES_CACHE] = new Map();
        keys.forEach((key, i) => indices.set(key, i));
        return indices.get(name);
    }

    getSize() {
        return Array.from(this.contentsTypeMap.values()).reduce((a, b) => a + memberSize(b), 0);
    }

    equals(x) {
        if (x === this) return true;

        // Ignore null types.
        if (!x) return false;
        // If we have an assigned name, compare that.
        if (this[symbols.ASSIGNED_NAME] === x[symbols.ASSIGNED_NAME]) return true;
        // If the other one isn't a struct or has a different name, fail.
        if (!(x instanceof Struct && this.typeName === x.typeName)) return false;
        // If the number of members is not the same, fail.
        if (this.contentsTypeMap.size !== x.contentsTypeMap.size) return false;
        // Test each member for equality.
        for (let key of this.contentsTypeMap.keys()) {
            // If the member is not in the other struct, fail.
            if (!x.contentsTypeMap.has(key)) return false;
            // If the member is the same type, fail.
            if (!this.contentsTypeMap.get(key).equals(x.contentsTypeMap.get(key))) return false;
        }
        return true;
    }

    toString(verbose = false) {
        if (!verbose) {
            if (!this.attributeTypes || !this.attributeTypes.length) {
                return this.typeName;
            } else {
                return `${this.typeName}<${this.attributeTypes.map(x => x.toString()).join(',')}>`;
            }
        }
        let out = this.typeName;
        this.contentsTypeMap.forEach((k, v) => {
            out += `\n  ${k}: ${v.toString(true)}`;
        });
        return out;
    }

    flatTypeName(ctxPointers) {
        if ((this[symbols.IS_CTX_OBJ] || this[symbols.IS_SELF_PARAM]) && ctxPointers) {
            return 'ptr';
        }
        if (!this[symbols.ASSIGNED_NAME]) {
            throw new TypeError('Cannot get struct type (' + this.typeName + ') before assigned name is generated');
        }
        return 'struct$' + this[symbols.ASSIGNED_NAME];
    }

    hasMethod(name) {
        return this.methods.has(name);
    }

    getMethod(name) {
        return this.methods.get(name);
    }

    getMethodType(name, ctx) {
        const method = this.getMethod(name);
        const temp = ctx.lookupFunctionByName(method).resolveType(ctx);
        temp[symbols.IS_METHOD] = true;
        return temp;
    }

    hasMember(name) {
        return this.contentsTypeMap.has(name);
    }

    getMemberType(name) {
        return this.contentsTypeMap.get(name);
    }

};
