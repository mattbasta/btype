import {memberSize} from './_utils';


export default class Tuple {
    constructor(contentsTypeArr) {
        this.contentsTypeArr = contentsTypeArr;

        this._type = 'tuple';
    }

    getLayout() {
        var keys = this.contentsTypeArr.map(function(_, i) {return i;});
        keys.sort(function(a, b) {
            return memberSize(a) < memberSize(b);
        });
        return keys;
    }

    getLayoutIndex(index) {
        index = index | 0;
        var sum = 0;
        for (var i = 0; i < this.contentsTypeArr.length; i++) {
            if (i === index) {
                return sum;
            }
            sum += memberSize(i);
        }
        throw new TypeError('Invalid layout index: ' + index + ' in tuple ' + this.toString());
    }

    equals(x) {
        if (!(x instanceof Tuple)) return false;
        return this.contentsTypeArr.every(function(type, i) {
            return type.equals(x.contentsTypeArr[i]);
        });
    }

    toString() {
        return 'tuple<' + this.contentsTypeArr.map(t => t.toString()).join(',') + '>';
    }

    getSize() {
        var sum = 0;
        for (var i = 0; i < this.contentsTypeArr.length; i++) {
            sum += memberSize(this.contentsTypeArr[i]);
        }
        return sum;
    }

    flatTypeName() {
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
    }

    isSubscriptable() {
        return true;
    }

    getSubscriptType(index) {
        return this.contentsTypeArr[index];
    }

    hasStaticMethod() {
        return false;
    }

};
