export const ASSIGNED_NAME = Symbol('assigned name');
export const BASE_PROTOTYPE = Symbol('a reference to the objec\'s base prototype');
export const CONTEXT = Symbol('the context associated with the node');
export const DECLARES_SOMETHING = Symbol('flags that the node declares something in a context');
export const IS_CONSTRUCTED = Symbol('this object prototype is constructed');
export const IS_FIRSTCLASS = Symbol('whether the function is first class');
export const IS_CONSTRUCTOR = Symbol('whether a function is the constructor of an object');
export const IS_METHOD = Symbol('this function is a method');
export const IS_OBJOPSTMT = Symbol('this operator statement is associated with an object');

export const IS_CTX_OBJ = Symbol('flag indiciating that a type is for lexical types');
export const IS_SELF_PARAM = Symbol('flag indiciating that a type is for a self param');

export const IS_FINAL = Symbol('the item is declared as final in an object');
export const IS_PRIVATE = Symbol('the item is declared as private in an object');

export const ORIG_OPERATOR = Symbol('the original operator of an operator statement');
export const IS_FUNC = Symbol('whether a symbol points at a function');
export const IS_FUNCREF = Symbol('whether a New node represents a reference to a function');
export const REFCONTEXT = Symbol('the context that a symbol refers to');
export const REFNAME = Symbol('the assigned name that a symbol refers to');
export const REFTYPE = Symbol('the type of the variable that a symbol refers to');
export const REFIDX = Symbol('the funclist index that a symbol target refers to');

export const FUNCLIST = Symbol('Function table');
export const FUNCLIST_IDX = Symbol('Function table index');

export const FMAKEHLIR = Symbol('function: make HLIR');
export const FMAKEHLIRBLOCK = Symbol('function: make HLIR from a block');
export const FCONSTRUCT = Symbol('function: convert registered AST prototype to HLIR');

export const ERR_MSG = Symbol('error: original btype message');
export const ERR_START = Symbol('error: start index of error in bt file');
export const ERR_LINE = Symbol('error: line of error in bt file, optional instead of ERR_START');
export const ERR_COL = Symbol('error: column of error in bt file, optional instead of ERR_START');
export const ERR_END = Symbol('error: end index of error in bt file');

export const IGNORE_ERRORS = Symbol('special flag for ignoring certain errors on generated functions');
