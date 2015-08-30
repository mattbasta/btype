import BaseBlockHLIR from './BaseBlockHLIR';
import BaseHLIR from './BaseHLIR';
import Struct from '../compiler/types/Struct';
import * as symbols from '../symbols';


const TYPE_CACHE = Symbol();

export default class ObjectDeclarationHLIR extends BaseHLIR {

    constructor(name, attributes, start, end) {
        super(start, end);
        this.name = name;
        this.attributes = attributes;

        this.objConstructor = null;
        this.methods = [];
        this.members = [];
        this.operatorStatements = [];
    }

    setConstructor(objConstructor) {
        this.objConstructor = objConstructor;
    }

    setMethods(methods) {
        this.methods = methods;
    }

    setMembers(members) {
        this.members = members;
    }

    setOperatorStatements(operatorStatements) {
        this.operatorStatements = operatorStatements;
    }


    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }
        this.settleTypes(ctx);

        var typeMap = new Map();
        var type = new Struct(this.name,);
        type[symbols.ASSIGNED_NAME] = this[symbols.ASSIGNED_NAME];

        this.members.forEach(m => {
            typeMap.set(m.name, m.resolveType(ctx));
            if (m.isPrivate) type.privateMembers.add(m.name);
            if (m.isFinal) type.finalMembers.add(m.name);
        });

        if (this.objConstructor) {
            type.objConstructor = this.objConstructor[symbols.ASSIGNED_NAME];
            if (this.objConstructor[symbols.IS_FINAL]) type.finalMembers.add('new');
        }

        this.methods.forEach(m => {
            type.methods.set(m.name, m[symbols.ASSIGNED_NAME]);
            if (m.isPrivate) type.privateMembers.add(m.name);
            if (m.isFinal) type.finalMembers.add(m.name);
        });

        return this[TYPE_CACHE] = type;
    }

    settleTypes(ctx) {
        if (this.objConstructor) this.objConstructor.settleTypes(ctx);
        this.methods.forEach(m => m.settleTypes(ctx));
        this.operatorStatements.forEach(o => o.settleTypes(ctx));
        this.members.forEach(m => m.resolveType(ctx));
    }

};
