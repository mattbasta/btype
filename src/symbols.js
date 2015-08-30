export const ASSIGNED_NAME = Symbol('assigned name');
export const BASE_PROTOTYPE = Symbol('a reference to the objec\'s base prototype');
export const CONTEXT = Symbol('the context associated with the node');
export const DECLARES_SOMETHING = Symbol('flags that the node declares something in a context');
export const IS_CONSTRUCTED = Symbol('this object prototype is constructed');
export const IS_FIRSTCLASS = Symbol('whether the function is first class');
export const IS_CONSTRUCTOR = Symbol('whether a function is the constructor of an object');
export const IS_METHOD = Symbol('this function is a method');

export const IS_FINAL = Symbol('the item is declared as final in an object');
export const IS_PRIVATE = Symbol('the item is declared as private in an object');

export const IS_FUNC = Symbol('whether a symbol points at a function');
export const REFCONTEXT = Symbol('the context that a symbol refers to');
export const REFNAME = Symbol('the assigned name that a symbol refers to');
export const REFTYPE = Symbol('the type of the variable that a symbol refers to');

export const FUNCLIST = Symbol('Function table');
export const FUNCLIST_IDX = Symbol('Function table index');

export const FMAKEHLIR = Symbol('function: make HLIR');
export const FMAKEHLIRBLOCK = Symbol('function: make HLIR from a block');
export const FCONSTRUCT = Symbol('function: convert registered AST prototype to HLIR');
