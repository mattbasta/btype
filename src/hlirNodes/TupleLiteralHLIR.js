import BaseExpressionHLIR from './BaseExpressionHLIR';
import Tuple from '../compiler/types/Tuple';


export default class TupleLiteralHLIR extends BaseExpressionHLIR {

    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
    }

    resolveType(ctx, expectedType) {
        if (expectedType && expectedType._type !== 'tuple') {
            throw this.TypeError('Tuple used where ' + expectedType + ' was expected');
        }
        let expectedElementTypes;
        if (!expectedType) {
            expectedElementTypes = this.elements.map(() => null); // array of nulls
        } else {
            expectedElementTypes = expectedType.contentsTypeArr;
        }
        const elemTypes = this.elements.map(e => e.resolveType(ctx));
        const myType = new Tuple(elemTypes);

        if (expectedType && !myType.equals(expectedType)) {
            throw this.TypeError(myType + ' found where ' + expectedType + ' was expected');
        }

        return myType;
    }

};
