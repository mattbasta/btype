
/**
 * @param uint funcID The ID of the function to point to
 * @param uint ctx Pointer to the context for the function
 * @returns uint Pointer to the new function reference
 */
function getfuncref(funcID, ctx) {
    funcID = funcID | 0;
    ctx = ctx | 0;
    var x = 0;
    x = malloc(16) | 0; // 4b pointer to function, 4b pointer to ctx, 8b header
    ptrheap[x + 8 >> 2] = funcID;
    ptrheap[x + 12 >> 2] = ctx;
    gcref(ctx);
    return x | 0;
}


/**
 * @param uint funcID The ID of the function to point to
 * @param uint ctx Pointer to the object to bind the method to
 * @returns uint Pointer to the new bound method
 */
function getboundmethod(funcID, self) {
    funcID = funcID | 0;
    self = self | 0;
    var x = 0;
    x = malloc(16) | 0; // 4b pointer to function, 4b pointer to self, 8b header
    ptrheap[x + 8 >> 2] = funcID;
    ptrheap[x + 12 >> 2] = self;
    gcref(self);
    return x | 0;
}
