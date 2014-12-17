
/**
 * @param uint funcID The ID of the function to point to
 * @param uint ctx Pointer to the context for the function
 * @returns uint Pointer to the new function reference
 */
function getfuncref(funcID, ctx) {
    funcID = funcID | 0;
    ctx = ctx | 0;
    var x = 0;
    x = malloc(8) | 0; // 4b pointer to function, 4b pointer to ctx
    ptrheap[x >> 2] = funcID;
    ptrheap[(x + 4) >> 2] = ctx;
    return x | 0;
}