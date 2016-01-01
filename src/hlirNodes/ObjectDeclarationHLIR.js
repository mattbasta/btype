import BaseBlockHLIR from './BaseBlockHLIR';
import BaseHLIR from './BaseHLIR';
import * as symbols from '../symbols';


const ATTRIBUTES = Symbol();

export default class ObjectDeclarationHLIR extends BaseHLIR {

    constructor(name, attributes, start, end) {
        super(start, end);
        this.name = name;
        this[ATTRIBUTES] = attributes;

        this.objConstructor = null;
        this.methods = null;
        this.members = null;
        this.operatorStatements = [];
    }

    setConstructor(objConstructor) {
        this.objConstructor = objConstructor;
    }

    setMembers(members) {
        this.members = members;
    }

    setMethods(methods) {
        this.methods = methods;
    }

    setOperatorStatements(operatorStatements) {
        this.operatorStatements = operatorStatements;
    }


    resolveType(ctx) {
        throw new Error('Use Context.resolvePrototype instead.');
    }

    settleTypes(ctx) {
        this.members.forEach(m => m.resolveType(ctx));
    }

};
