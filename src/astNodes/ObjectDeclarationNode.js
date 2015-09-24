import BaseBlockNode from './BaseBlockNode';
import {Context} from '../compiler/context';
import ContextBuilder from '../contextBuilder';
import ObjectDeclarationHLIR from '../hlirNodes/ObjectDeclarationHLIR';
import * as symbols from '../symbols';


const IS_MADE = Symbol();
const BUILDER = Symbol();

export default class ObjectDeclarationNode extends BaseBlockNode {
    constructor(
                name,
                objConstructor,
                members,
                methods,
                attributes,
                operators,
                start,
                end
            ) {
        super(start, end);

        this.name = name;
        this.attributes = attributes;
        this.members = members;
        this.objConstructor = objConstructor;
        this.methods = methods;
        this.operators = operators;
    }

    get id() {
        return 20;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.name);
        bitstr.writebits(!!this.objConstructor, 1);
        this.packBlock(bitstr, 'attributes');
        if (this.objConstructor) this.objConstructor.pack(bitstr);
        this.packBlock(bitstr, 'members');
        this.packBlock(bitstr, 'methods');
        this.packBlock(bitstr, 'operators');
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'object ' + this.name +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join(', ') + '>' : '') +
            ' {\n' +
            this.members.map(m => m.toString()).join('') +
            (this.objConstructor ? this.objConstructor.toString() : '') +
            this.methods.map(m => m.toString()).join('') +
            this.operators.map(o => o.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        builder.peekCtx().registerPrototype(this.name, this);
        this[IS_MADE] = true;
        return [];
    }

    [symbols.FCONSTRUCT](rootCtx, attributes) {
        if (!this[IS_MADE]) {
            throw new Error('FCONSTRUCT called prematurely');
        }

        if (attributes.length !== this.attributes.length) {
            let passedAttrs = '<' + attributes.map(a => a.toString()).join(', ') + '>';
            let currentAttrs = '<' + this.attributes.join(', ') + '>';
            throw this.TypeError(
                'Expected ' + this.attributes.length + ' attribute(s) (' + currentAttrs + ') ' +
                'but got ' + attributes.length + ' attribute(s) (' + passedAttrs + ') for ' +
                this.name
            );
        }

        var mappedAttributes = new Map();
        this.attributes.forEach((a, i) => {
            mappedAttributes.set(a, attributes[i]);
        });

        var node = new ObjectDeclarationHLIR(this.name, mappedAttributes);

        var builder = new ContextBuilder(rootCtx.env, rootCtx.privileged);
        builder.pushCtx(rootCtx);

        var ctx = new Context(rootCtx.env, node, rootCtx, rootCtx.privileged);
        builder.pushCtx(ctx);

        mappedAttributes.forEach((type, name) => {
            ctx.typeDefs.set(name, type);
        });

        node[symbols.ASSIGNED_NAME] = rootCtx.env.namer();
        node[symbols.IS_CONSTRUCTED] = true;
        node[BUILDER] = builder;

        return node;
    }

    bindContents(node) {
        if (!(node instanceof ObjectDeclarationHLIR)) {
            throw new TypeError('Attempting to bind to invalid HLIR node');
        }
        if (!(builder instanceof ContextBuilder)) {
            throw new TypeError('Attempting to bind object declaration methods with invalid context builder');
        }

        var builder = node[BUILDER];
        delete node[BUILDER];

        if (this.objConstructor) {
            node.setConstructor(
                this.objConstructor[symbols.FMAKEHLIR](builder)
            );
        }
        node.setMethods(
            this.methods.map(m => m[symbols.FMAKEHLIR](builder))
        );
        node.setMembers(
            this.members.map(m => m[symbols.FMAKEHLIR](builder))
        );
        node.setOperatorStatements(
            this.operators.map(o => o[symbols.FMAKEHLIR](builder))
        );
    }

};
