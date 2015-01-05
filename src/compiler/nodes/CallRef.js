var CallRaw = require('./CallRaw');


exports.traverse = CallRaw.traverse;
exports.substitute = CallRaw.substitute;
exports.getType = CallRaw.getType;
exports.validateTypes = CallRaw.validateTypes;
exports.toString = CallRaw.toString;

exports.__getName =  function() {
    return 'CallRef';
};
