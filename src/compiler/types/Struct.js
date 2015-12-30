import {memberSize} from './_utils';
import * as symbols from '../../symbols';


const LAYOUT_CACHE = Symbol();
const ORDERED_LAYOUT_CACHE = Symbol();
const LAYOUT_INDICES_CACHE = Symbol();

export default class Struct {
    constructor(name, contentsTypeMap) {
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
    }

    getLayout() {
        if (this[LAYOUT_CACHE]) return this[LAYOUT_CACHE];
        var offsets = {}; // TODO: make this a map?
        var i = 0;
        this.contentsTypeMap.forEach((value, key) => {
            var size = memberSize(value);
            offsets[key] = i;
            i += size;
        });
        return this[LAYOUT_CACHE] = offsets;
    }

    getOrderedLayout() {
        if (this[ORDERED_LAYOUT_CACHE]) return this[ORDERED_LAYOUT_CACHE];
        var keys = Array.from(this.contentsTypeMap.keys());
        keys.sort((a, b) => {
            return memberSize(this.contentsTypeMap.get(a)) < memberSize(this.contentsTypeMap.get(b));
        });
        var order = keys.map(m => this.contentsTypeMap.get(m));
        return this[ORDERED_LAYOUT_CACHE] = order;
    }

    getLayoutIndex(name) {
        if (this[LAYOUT_INDICES_CACHE]) return this[LAYOUT_INDICES_CACHE].get(name);
        var layout = getLayout();
        var indices = this[LAYOUT_INDICES_CACHE] = new Map();
        this.getOrderedLayout().forEach((key, i) => indices.set(key, i));
        return indices.get(name);
    }

    getSize() {
        var sum = 0;
        this.contentsTypeMap.forEach(v => sum += memberSize(v));
        return sum;
    }

    equals(x) {
        // Ignore null types.
        if (!x) return false;
        // If we have an assigned name, compare that.
        if (this[symbols.ASSIGNED_NAME] === x[symbols.ASSIGNED_NAME]) return true;
        // If the other one isn't a struct or has a different name, fail.
        if (!(x instanceof Struct && this.typeName === x.typeName)) return false;
        // If the number of members is not the same, fail.
        if (this.contentsTypeMap.size !== x.contentsTypeMap.size) return false;
        // Test each member for equality.
        for (var key of this.contentsTypeMap.keys()) {
            // If the member is not in the other struct, fail.
            if (!x.contentsTypeMap.has(key)) return false;
            // If the member is the same type, fail.
            if (!this.contentsTypeMap.get(key).equals(x.contentsTypeMap.get(key))) return false;
        }
        return true;
    }

    toString(verbose = false) {
        if (!verbose) {
            return this.typeName;
        }
        var out = this.typeName;
        this.contentsTypeMap.forEach((k, v) => {
            out += `\n  ${k}: ${v.toString(true)}`;
        });
        return out;
    }

    flatTypeName() {
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
        var method = this.getMethod(name);
        var temp = ctx.lookupFunctionByName(method).resolveType(ctx);
        temp[symbols.IS_METHOD] = true;
        return temp;
    }

    hasMember(name) {
        return this.contentsTypeMap.has(name);
    }

    getMemberType(name) {
        return this.contentsTypeMap.get(name);
    }

    isSubscriptable() {
        return false;
    }

};
