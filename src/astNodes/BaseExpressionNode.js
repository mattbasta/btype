import BaseNode from './BaseNode';

export default class BaseExpressionNode extends BaseNode {

    resolveType(ctx, expectation) {
        throw new Error('Not implemented');
    }

};
