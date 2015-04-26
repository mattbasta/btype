var utils = require('./_utils');


function Tuple(contentsTypeArr) {
    this.contentsTypeArr = contentsTypeArr;

    function getLayout() {
        var keys = contentsTypeArr.map(function(_, i) {return i;});
        keys.sort(function(a, b) {
            return memberSize(a) < memberSize(b);
        });
        return keys;
    }

    var cachedLayoutIndices;
    this.getLayoutIndex = function(index) {
        index = index | 0;
        var sum = 0;
        for (var i = 0; i < this.contentsTypeArr.length; i++) {
            if (i === index) {
                return sum;
            }
            sum += utils.memberSize(i);
        }
        throw new TypeError('Invalid layout index: ' + index + ' in tuple ' + this.toString());
    };

}

Tuple.prototype._type = 'tuple';

Tuple.prototype.equals = function equals(x) {
    if (!(x instanceof Tuple)) return false;
    return this.contentsTypeArr.every(function(type, i) {
        return type.equals(x.contentsTypeArr[i]);
    });
};

Tuple.prototype.toString = function toString() {
    return 'tuple<' + this.contentsTypeArr.map(function(t) {return t.toString();}).join(',') + '>';
};

Tuple.prototype.getSize = function getSize() {
    var sum = 0;
    for (var i = 0; i < this.contentsTypeArr.length; i++) {
        sum += utils.memberSize(this.contentsTypeArr[i]);
    }
    return sum;
};

Tuple.prototype.flatTypeName = function flatTypeName() {
    return 'tuple$' + this.contentsTypeArr.map(function(type) {
        return type.flatTypeName();
    }).join('$') + '$$';

    /*
    The final two dollar signs are important. Otherwise, nested tuples
    could cause problems:
        A: tuple$foo$bar
        B: tuple$XXX$bar where XXX is type A
    vs.
        A: tuple$foo$bar$bar
        B: tuple$XXX where XXX is type A

    Both would otherwise be

        tuple$tuple$foo$bar$bar

    instead, they become

        tuple$tuple$foo$bar$$bar$$
        tuple$tuple$foo$bar$bar$$$$

    respectively.

    */
};

Tuple.prototype.isSubscriptable = function isSubscriptable() {
    return true;
};

Tuple.prototype.getSubscriptType = function getSubscriptType(index) {
    return this.contentsTypeArr[index];
};

module.exports = Tuple;
