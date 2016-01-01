import * as symbols from '../symbols';

const BODY_FIELDS = new Set(['body', 'consequent', 'alternate']);


export default class BaseHLIR {

    constructor(start = 0, end = 0) {
        this.start = start;
        this.end = end;
    }

    settleTypes() {
        throw new Error('not implemented');
    }

    TypeError(error, start = null, end = null) {
        var err = new TypeError(error);
        err[symbols.ERR_MSG] = error;
        err[symbols.ERR_START] = start !== null ? start : this.start;
        err[symbols.ERR_END] = end !== null ? end : this.end;
        return err;
    }


    traverse(cb) {
        Object.keys(this).forEach(key => {
            if (key === 'start' || key === 'end') return;
            if (!this[key] || typeof this[key] !== 'object') return;
            if (key.startsWith('is')) return;
            if (Array.isArray(this[key])) {
                this[key].forEach(e => cb(e, key));
            } else {
                cb(this[key], key);
            }
        });
    }
    traverseBodies(cb) {
        Object.keys(this)
            .filter(BODY_FIELDS.has.bind(BODY_FIELDS))
            .filter(k => Array.isArray(this[k]))
            .forEach(k => cb(this[k]));
    }


    iterate(cb, afterCB) {
        this.traverse((node, member) => {
            var ret = cb(node, member);
            if (ret === false) return;
            node.iterate(cb, afterCB);
            if (afterCB) afterCB(node, member);
        });
    }
    iterateBodies(cb, afterCB, filter) {
        if (this.traverseBodies && (!filter || filter(this) !== false)) {
            this.traverseBodies((body, member) => {
                var ret = cb(body, member);
                if (ret === false) return;
                if (afterCB) afterCB(body, member);
            });
            this.iterate(node => node.iterateBodies(cb, afterCB, filter));
        }
    }

    iterateWithSelf(cb, afterCB = null) {
        cb(this, null);
        this.iterate(cb, afterCB);
        if (afterCB) {
            afterCB(this, null);
        }
    }

    findAndReplace(filter = null, preTraverse = false, beforeCB = null, afterCB = null) {
        this.iterate((node, member) => {
            if (beforeCB) {
                beforeCB(node, member);
            }
            if (preTraverse) {
                node.findAndReplace(filter, preTraverse, beforeCB, afterCB);
            }
            var replacer;
            if (filter && (replacer = filter(node, member))) {
                this.substitute((sNode, member) => {
                    if (node !== sNode) return sNode;
                    return replacer(sNode, member);
                });
            }
            if (!preTraverse) {
                node.findAndReplace(filter, preTraverse, beforeCB, afterCB);
            }
            if (afterCB) {
                afterCB(node, member);
            }
        });
    }

    substitute(cb) {
        Object.keys(this).forEach(k => {
            if (k === 'start' || k === 'end') return;
            var val = this[k];
            if (Array.isArray(val) && val.some(x => typeof x === 'object')) {
                this[k] = val.map(e => cb(e, k)).filter(e => e);
            } else if (typeof val !== 'object') {
                return;
            } else {
                this[k] = cb(val, k) || val;
            }
        });
    }

    toString() {
        var out = '';
        Object.keys(this).forEach(key => {
            if (key === 'start' || key === 'end') return;
            if (!this[key] || typeof this[key] !== 'object') return;
            if (key.startsWith('is')) return;
            if (Array.isArray(this[key])) {
                if (!this[key].length) {
                    out += `${key}: <empty>\n`;
                } else {
                    out += `${key}:\n`;
                    this[key].forEach(e => {
                        out += e.toString().split('\n').map(x => '    ' + x).join('\n') + '\n';
                    });
                }
            } else {
                out += `${key}: ${this[key].toString()}\n`;
            }
        });

        out = out.split('\n').map(line => '    ' + line).join('\n');
        out = this.asString() + '\n' + out;
        return out.trim();
    }

    asString() {
        return `${this.constructor.name} (${this.start}:${this.end})`;
    }

};
