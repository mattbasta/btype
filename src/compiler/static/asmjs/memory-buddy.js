/*
Memory is managed in a buddy system. The heap starts out as one contiguous
block of memory and is continuously divided down until the memory is in 32 byte
chunks.

See https://github.com/mattbasta/btype/wiki/Object-Shape for info

*/

/**
 * @param uint index Pointer to the heap memory being used
 * @param uint bit (0 or 1) The bit being requested
 * @returns uint (0 or 1) Value of the bit
 */
function _malloc_lookup(index, bit) {
    index = index | 0;
    bit = bit | 0;

    var idxVal = 0;
    var posVal = 0;

    // Fetch the byte at the position in the heap.
    // We divide by four because each byte in memheap contains the data for
    // four memory locations.
    idxVal = memheap[index >>> 2] | 0;
    // Determine the value to compare against the byte.
    // `1<<x` is 2^x in real math. `2<<x` is 2^x+1
    if (bit | 0 == 1) {
        posVal = 2 << ((index | 0) % 4 << 1);
    } else {
        posVal = 1 << ((index | 0) % 4 << 1);
    }
    // `posVal` always contains all zeroes and a single one.
    // `???? & 0010` will equal `00?0`. If `0010 === 00?0`, the unknown bit
    // is 1.
    return (idxVal & posVal) == (posVal | 0) | 0;
}

/**
 * @param uint index Pointer to the heap memory being set
 * @param uint bit (0 or 1) The bit being set
 * @returns void
 */
function _malloc_toggle(index, bit) {
    index = index | 0;
    bit = bit | 0;

    var idxVal = 0;
    var posVal = 0;
    // Determine the position in the heap to set.
    // We divide by four because each byte in memheap contains the data for
    // four memory locations.
    idxVal = index >>> 2;
    // Determine the value to compare against the byte.
    // `1<<x` is 2^x in real math. `2<<x` is 2^x+1
    if (bit | 0 == 1) {
        // 00000010 << 0 * 2 == 00000010
        // 00000010 << 1 * 2 == 00001000
        // 00000010 << 2 * 2 == 00100000
        // 00000010 << 3 * 2 == 10000000
        posVal = 2 << ((index | 0) % 4 << 1);
    } else {
        // 00000001 << 0 * 2 == 00000001
        // 00000001 << 1 * 2 == 00000100
        // 00000001 << 2 * 2 == 00010000
        // 00000001 << 3 * 2 == 01000000
        posVal = 1 << ((index | 0) % 4 << 1);
    }
    // Set the byte at the position in the heap.
    // `??X? ^ 0010` will produce `??Y?` where X = !Y.
    memheap[idxVal] = memheap[idxVal] ^ posVal;
}

/**
 * @param uint pointer The position of the center of the block
 * @param uint pairSize The size of the block being addressed
 * @param uint requestedSize The requested amount of memory
 * @param uint midpoint The value of the midpoint bookkeeping value
 * @returns uint Pointer to free memory block or null
 */
function _malloc_search(pointer, pairSize, requestedSize, midpoint) {
    pointer = pointer | 0;
    pairSize = pairSize | 0;
    requestedSize = requestedSize | 0;
    midpoint = midpoint | 0;

    var temp = 0;
    var nextSize = 0;
    var nextHalfSize = 0;
    nextSize = pairSize >>> 1;
    nextHalfSize = pairSize >>> 2;

    // Will the block not fit in one of the pairs?
    if ((nextSize | 0) < (requestedSize | 0) | (nextSize | 0) < LOWEST_ORDER) {

        // If it won't fit and the block is split, it's a lost cause.
        if ((midpoint | 0) != 0) {
            return 0;
        }

        // Otherwise return the current block.
        temp = pointer - nextSize | 0;
        // If the address is in use, bail.
        if (_malloc_lookup(temp, 1) | 0) {
            return 0;
        }
        _malloc_toggle(temp, 1);
        return temp + BUDDY_SPACE | 0;
    }

    // If the current block is not split...
    if ((midpoint | 0) == 0) {
        // Check to make sure it's not in use.
        if (_malloc_lookup(pointer - nextSize | 0, 1) | 0) {
            // If it is, this block is unusable.
            return 0;
        }
        _malloc_toggle(pointer, 0);  // Split the block

        // Perform the same lookup on the left-hand side, setting the
        // pointer in the middle.
        // We know that the left side is unallocated because the current
        // block was not split and the left-most bit was unset.
        return _malloc_search(pointer - nextHalfSize | 0, nextSize, requestedSize, 0) | 0;
    }

    // If the left side is split or unallocated, go that route.
    temp = _malloc_lookup(pointer - nextHalfSize | 0, 0) | 0;
    if ((temp | 0) == 1 | (_malloc_lookup(pointer - nextSize | 0, 1) | 0) == 0) {
        // Search that side.
        temp = _malloc_search(pointer - nextHalfSize | 0, nextSize, requestedSize, temp) | 0;
        if ((temp | 0) != 0) {
            return temp | 0;
        }
    }

    // Do the same for the right side.
    temp = _malloc_lookup(pointer + nextHalfSize | 0, 0) | 0;
    if (temp | (_malloc_lookup(pointer | 0, 1) | 0) == 0) {
        // Search this side.
        temp = _malloc_search(pointer + nextHalfSize | 0, nextSize, requestedSize, temp) | 0;
        if (temp | 0) {
            return temp | 0;
        }
    }

    // If neither the left nor the right sides return a value, return `null`.
    return 0;
}

/**
 * @param uint bytes Number of bytes to allocate
 * @returns uint Pointer to location of allocated memory
 */
function malloc(bytes) {
    bytes = bytes | 0;  // Cast to int

    // Don't allow requesting more memory than the size of the heap
    if ((bytes | 0) > HEAP_SIZE) {
        return 0;
    }

    // Anything requesting zero bytes should be just as happy with the null pointer.
    if ((bytes | 0) == 0) {
        return 0;
    }

    // Anything requesting fewer than eight bytes should round up to 8.
    if ((bytes | 0) < 8) {
        bytes = 8;
    }

    var halfHeap = 0;
    var midpoint = 0;
    bytes = bytes + 8 | 0;  // Account for reference count and object shape (4 bytes each)
    halfHeap = HEAP_SIZE >> 1;
    midpoint = _malloc_lookup(halfHeap, 0) | 0;
    return _malloc_search(halfHeap, HEAP_SIZE, bytes, midpoint) | 0;
}

/**
 * @param uint bytes Number of bytes to allocate
 * @returns uint Pointer to location of allocated and cleared memory
 */
function calloc(bytes) {
    bytes = bytes | 0;

    var destination = 0;
    var iter = 0;
    var n = 0;
    var ptr = 0;

    ptr = malloc(bytes) | 0;

    // If there was an error, bail.
    if ((ptr | 0) == 0) {
        return 0;
    }

    // Anything requesting zero bytes should be just as happy with the null pointer.
    if ((bytes | 0) < 8) {
        bytes = 8;
    }

    iter = ptr | 0;
    destination = ptr + bytes | 0;

    // Set all requested bytes to zero
    // Duff's device to improve calloc
    n = ((bytes | 0) + 7 | 0) / 8 | 0;
    switch ((bytes | 0) % 8 | 0) {
        case 0: memheap[iter] = 0; iter = iter + 1 | 0;
        case 7: memheap[iter] = 0; iter = iter + 1 | 0;
        case 6: memheap[iter] = 0; iter = iter + 1 | 0;
        case 5: memheap[iter] = 0; iter = iter + 1 | 0;
        case 4: memheap[iter] = 0; iter = iter + 1 | 0;
        case 3: memheap[iter] = 0; iter = iter + 1 | 0;
        case 2: memheap[iter] = 0; iter = iter + 1 | 0;
        case 1: memheap[iter] = 0; iter = iter + 1 | 0;
    }
    n = n - 1 | 0;
    while ((n | 0) > 0) {
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        memheap[iter] = 0; iter = iter + 1 | 0;
        n = n - 1 | 0;
    }

    return ptr | 0;
}


/**
 * @param uint pointer A pointer to the memory location to be freed.
 * @returns void
 */
function free(pointer) {
    pointer = pointer | 0;  // Cast to int

    // Ignore null frees
    if ((pointer | 0) == 0) {
        return;
    }

    // Start with the lowest possible size of the block.
    var size = LOWEST_ORDER;
    var buddy = 0;
    var midpoint = 0;
    var temp = 0;
    // Pull off the offset from the heap.
    pointer = pointer - BUDDY_SPACE | 0;

    // Prevent double-free errors.
    if ((_malloc_lookup(pointer, 1) | 0) == 0) {
        return;
    }

    // Free the block straight away.
    _malloc_toggle(pointer, 1);

    do {
        // Calculate the position of the buddy (pos XOR size)
        buddy = pointer ^ size;
        if ((buddy | 0) < (pointer | 0)) {
            midpoint = pointer;
        } else {
            midpoint = buddy;
        }
        temp = _malloc_lookup(midpoint, 0) | 0;
        size = size << 1;
    } while ((temp | 0) == 0);

    // At this point, we've found the first full pair:
    //  - buddy:  The address of the buddy.
    //  - midpoint:  The point between the block being freed and its buddy.
    //  - size: The size of the block containing the block to be freed and its buddy.

    while (1) {
        // If the buddy is split, we're done.
        if ((size | 0) != (LOWEST_ORDER << 1 | 0)) { // The buddy is not the smallest size
            if (_malloc_lookup(buddy + (size >> 1) | 0, 0) | 0) { // The buddy is split.
                return;
            }
        }
        // If the buddy is allocated, we're done.
        if (_malloc_lookup(buddy, 1) | 0) {
            return;
        }
        // Unsplit the current block.
        _malloc_toggle(midpoint, 0);
        // Put the pointer at the start of the block.
        if ((buddy | 0) < (pointer | 0)) {
            pointer = buddy;
        }
        // Update the size to match the block.
        size = size << 1;
        // If we've freed all the way up to the size of the heap, we're done.
        if ((size | 0) >= HEAP_SIZE) {
            return;
        }
        // Calculate the block's buddy.
        buddy = pointer ^ size;
        // Calculate the midpoint of the new block.
        if ((buddy | 0) < (pointer | 0)) {
            midpoint = pointer;
        } else {
            midpoint = buddy;
        }
    }

}
