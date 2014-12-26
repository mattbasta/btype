
/**
 * @param uint ptr Pointer to the object being queried
 * @returns uint Number of references to the object
 */
function gcget(ptr) {
    ptr = ptr | 0;
    return ptrheap[ptr + 4 >> 2] | 0;
}

/**
 * @param uint ptr Pointer to the object being referenced
 * @returns uint The value of ptr
 */
function gcref(ptr) {
    ptr = ptr | 0;
    ptrheap[ptr + 4 >> 2] = (ptrheap[ptr + 4 >> 2] | 0) + 1 | 0;
    return ptr | 0;
}

/**
 * @param uint ptr Pointer to the object being dereferenced
 * @returns void
 */
function gcderef(ptr) {
    ptr = ptr | 0;

    var newRC = 0;
    newRC = (ptrheap[ptr + 4 >> 2] | 0) - 1 | 0;
    // TODO: Add finalizer support here.

    // If there's no remaining references to the object, free it.
    if ((newRC | 0) == 0) {
        free(newRC);
        return;
    }
    ptrheap[ptr + 4 >> 2] = newRC;
}
