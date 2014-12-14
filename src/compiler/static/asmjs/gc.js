
/**
 * @param uint ptr Pointer to the object being queried
 * @returns uint Number of references to the object
 */
function rcGet(ptr) {
    ptr = ptr | 0;
    return ptrheap[ptr >> 2] | 0;
}

/**
 * @param uint ptr Pointer to the object being referenced
 * @returns void
 */
function rcRef(ptr) {
    ptr = ptr | 0;
    ptrheap[ptr >> 2] = (ptrheap[ptr >> 2] | 0) + 1 | 0;
}

/**
 * @param uint ptr Pointer to the object being dereferenced
 * @returns void
 */
function rcDeref(ptr) {
    ptr = ptr | 0;

    var newRC = 0;
    newRC = (ptrheap[ptr >> 2] | 0) - 1 | 0;
    // TODO: Add finalizer support here.

    // If there's no remaining references to the object, free it.
    if ((newRC | 0) == 0) {
        free(newRC);
        return;
    }
    ptrheap[ptr >> 2] = newRC;
}
