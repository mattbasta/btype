export default class BaseHLIR {

    constructor(start, end) {
        this.start = start;
        this.end = end;
    }

    settleTypes() {}

    get TypeError() {
        return error => new TypeError(error + ' (' + this.start + ':' + this.end + ')');
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


    iterate(cb, afterCB) {
        this.traverse((node, memeber) => {
            if (!node) return;
            var ret = cb(node, member);
            if (ret === false) return;
            node.iterate(callback, afterCB);
            if (afterCB) afterCB(node, member);
        });
    }

    iterateWithSelf(cb, afterCB) {
        cb(this, null);
        this.iterate(cb, afterCB);
        if (afterCB) afterCB(this, null);
    }

};
