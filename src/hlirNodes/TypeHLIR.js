import BaseHLIR from './BaseHLIR';
import Func from '../compiler/types/Func';
import Array_ from '../compiler/types/Array';
import Tuple from '../compiler/types/Tuple';
import {resolve} from '../compiler/types';
import * as symbols from '../symbols';


const TYPE_CACHE = Symbol();
const RESOLVE_CATCH = Symbol();

export default class TypeHLIR extends BaseHLIR {

    constructor(name, attributes = [], start = 0, end = 0) {
        super(start, end);
        this.name = name;
        this.attributes = attributes;
    }

    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }

        if (this.name === 'func') {
            this[TYPE_CACHE] = new Func(
                this.attributes[0] && this.attributes[0].resolveType(ctx),
                this.attributes.slice(1).map(a => a.resolveType(ctx))
            );
        } else if (this.name === 'array') {
            this[TYPE_CACHE] = new Array_(this.attributes[0].resolveType(ctx));
        } else if (this.name === 'tuple') {
            this[TYPE_CACHE] = new Tuple(this.attributes.map(t => t.resolveType(ctx)));
        } else {
            try {
                this[TYPE_CACHE] = ctx.resolveType(
                    this.name,
                    this.attributes.map(a => a.resolveType(ctx))
                );
            } catch (e) {
                if (RESOLVE_CATCH in e) {
                    throw e;
                }
                e[RESOLVE_CATCH] = true;
                if (!(symbols.ERR_START in e) && !(symbols.ERR_LINE in e)) {
                    e[symbols.ERR_MSG] = e.message;
                    e[symbols.ERR_START] = this.start;
                    e[symbols.ERR_END] = this.end;
                }
                throw e;
            }
            if (!this[TYPE_CACHE]) {
                throw this.TypeError(`Could not resolve type "${this.name}"`);
            }
        }

        return this[TYPE_CACHE];
    }

    forceType(type) {
        this[TYPE_CACHE] = type;
    }

    toString() {
        if (this.attributes.length) {
            return super.toString();
        } else {
            return this.asString();
        }
    }

    asString() {
        return `TypeHLIR (${this.start}:${this.end}) for ${this.name}`;
    }

};

TypeHLIR.from = function from(type, start = 0, end = 0) {
    const t = new TypeHLIR(
        type.typeName || type._type,
        [],
        start,
        end
    );
    t.forceType(type);
    return t;
};
