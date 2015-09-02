import BaseHLIR from './BaseHLIR';
import Func from '../compiler/types/Func';
import {Array as Array_} from '../compiler/types/Array';
import Tuple from '../compiler/types/Tuple';
import {resolve} from '../compiler/types';


const TYPE_CACHE = Symbol();

export default class TypeHLIR extends BaseHLIR {

    constructor(name, attributes, start, end) {
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
            this[TYPE_CACHE] = ctx.resolveType(
                this.name,
                this.attributes.map(a => a.resolveType(ctx))
            );
        }

        return this[TYPE_CACHE];
    }

};
