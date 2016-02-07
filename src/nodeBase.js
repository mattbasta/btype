import * as symbols from './symbols';

/*
FIXME: This is done as it is because of https://phabricator.babeljs.io/T7017.
Please make this ES6-ey once babel 6.5.0 is released and everything in BType is upgraded.
*/

function NodeBase() {}

// Can't put a name on the closure here, since it'll cause infinite recursion.
NodeBase.prototype.TypeError = function(error, start = null, end = null) {
    var err = new TypeError(error);
    err[symbols.ERR_MSG] = error;
    err[symbols.ERR_START] = start !== null ? start : this.start;
    err[symbols.ERR_END] = end !== null ? end : this.end;
    return err;
};

module.exports = NodeBase;
