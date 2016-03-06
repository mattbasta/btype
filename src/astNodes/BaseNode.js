import NodeBase from '../nodeBase';
import * as symbols from '../symbols';


export default class BaseNode extends NodeBase {
    constructor(start, end) {
        super();
        this.start = start;
        this.end = end;
    }

    wrapError(func) {
        try {
            return func();
        } catch (err) {
            if (symbols.ERR_MSG in err ||
                symbols.ERR_START in err ||
                symbols.ERR_LINE in err) {
                throw err;
            }
            err[symbols.ERR_MSG] = err.message;
            err[symbols.ERR_START] = this.start;
            err[symbols.ERR_END] = this.end;
            throw err;
        }
    }

    traverse() {
        throw new Error('Not implemented');
    }

    toString() {
        return 'Unknown Node';
    }

    _indent(input, level) {
        level = level || 1;
        let indentation = '';
        while (level) {
            indentation += '    ';
            level--;
        }
        return input.split('\n').map(function(line) {
            return indentation + line;
        }).join('\n');
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

        return clone;
    }

    setFlag(flag) {
        this[symbols[flag]] = true;
    }

    hasFlag(flag) {
        return !!this[symbols[flag]];
    }

    pack(bitstr) {
        bitstr.writebits(this.id, 8);
        bitstr.writebits(this.start, 32);
        bitstr.writebits(this.end, 32);
    }
    packStr(bitstr, str) {
        bitstr.writebits(str.length, 32);
        for (let i = 0 ; i < str.length; i++) {
            bitstr.writebits(str.charCodeAt(i), 16);
        }
    }


    iterate(cb, afterCB) {
        this.traverse((node, member) => {
            if (!node) {
                return;
            }
            const ret = cb(node, member);
            if (ret === false) {
                return;
            }
            node.iterate(cb, afterCB);
            if (afterCB) {
                afterCB(node, member);
            }
        });
    }

    iterateWithSelf(cb, afterCB) {
        cb(this, null);
        this.iterate(cb, afterCB);
        if (afterCB) {
            afterCB(this, null);
        }
    }

};
