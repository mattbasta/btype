import * as symbols from './symbols';


export default class NodeBase {
    TypeError(error, start = null, end = null) {
        const err = new TypeError(error);
        err[symbols.ERR_MSG] = error;
        err[symbols.ERR_START] = start !== null ? start : this.start;
        err[symbols.ERR_END] = end !== null ? end : this.end;
        return err;
    }
};
