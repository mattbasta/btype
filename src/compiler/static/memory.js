// For use by the memory manager.
var memheap = new stdlib.Uint8Array(heap);
// Heap object for storing pointers.
var ptrheap = new stdlib.Uint32Array(heap);
// Heap object for storing integer types.
var intheap = new stdlib.Int32Array(heap);
// Heap object for storing floating point data.
var floatheap = new stdlib.Float64Array(heap);

var HEAP_SIZE = $HEAP_SIZE$;

/*
Memory is managed in a buddy system. The heap starts out as one contiguous
block of memory and is continuously divided down until the memory is in 32 byte
chunks.


One unit of memory:
- uint32 Reference count
- uint32 Object shape
- [object data]

*/

/*
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
    idxVal = memheap[index >>> 2] | 0;
    // Determine the value to compare against the byte.
    // `1<<x` is 2^x in real math. `2<<x` is 2^x+1
    if (bit | 0 == 1) {
        posVal = 2 << ((index | 0) % 4);
    } else {
        posVal = 1 << ((index | 0) % 4);
    }
    // `posVal` always contains all zeroes and a single one.
    // `???? & 0010` will equal `00?0`. If `0010 === 00?0`, the unknown bit
    // is 1.
    if ((idxVal & posVal) == (posVal | 0)) {
        return 1;
    }
    return 0;
}

/*
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
    idxVal = index >> 2;
    // Determine the value to compare against the byte.
    // `1<<x` is 2^x in real math. `2<<x` is 2^x+1
    if (bit | 0 == 1) {
        posVal = 2 << ((index | 0) % 4);
    } else {
        posVal = 1 << ((index | 0) % 4);
    }
    // Set the byte at the position in the heap.
    // `??X? ^ 0010` will produce `??Y?` where X = !Y.
    memheap[idxVal] = memheap[idxVal] ^ posVal;
}

/*
* @param uint pointer The position of the center of the block
* @param uint pairSize The size of the block addressed
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
    nextSize = pairSize >> 1;
    nextHalfSize = pairSize >> 2;
    // Will the block not fit in one of the pairs?
    if ((nextSize | 0) < (requestedSize | 0) | (nextSize | 0) < 64) {
        // If no, and the current block is not split, return the current block.
        if ((midpoint | 0) == 0) {
            temp = pointer - nextSize | 0;
            // If the address is in use, bail.
            if ((_malloc_lookup(temp, 1) | 0) == 1) {
                return 0;
            }
            _malloc_toggle(temp, 1);
            return temp + 1 | 0;
        }
        // Otherwise it's a lost cause.
    } else {
        // If the current block is not split...
        if ((midpoint | 0) == 0) {
            // Check to make sure it's not in use.
            if ((_malloc_lookup(pointer - nextSize | 0, 1) | 0) == 1) {
                // If it is, this block is unusable.
                return 0;
            }
            _malloc_toggle(pointer, 0);  // Split the block

            // Perform the same lookup on the left-hand side, setting the
            // pointer in the middle.
            // We know that the left side is unallocated because the current
            // block was not split and the left-most bit was unset.
            return _malloc_search(pointer - nextHalfSize | 0, nextSize, requestedSize, 1) | 0;
        } else {
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
            if ((temp | 0) == 1 | (_malloc_lookup(pointer | 0, 1) | 0) == 0) {
                // Search this side.
                temp = _malloc_search(pointer + nextHalfSize | 0, nextSize, requestedSize, temp) | 0;
                if ((temp | 0) != 0) {
                    return temp | 0;
                }
            }
        }
    }
    return 0;
}

/*
* @param uint bytes Number of bytes to allocate
* @returns uint Pointer to location of allocated memory
*/
function malloc(bytes) {
    bytes = bytes | 0;  // Cast to int

    var halfHeap = 0;
    var midpoint = 0;
    bytes = bytes + 8 | 0;  // Account for reference count and object shape (4 bytes each)
    halfHeap = HEAP_SIZE >> 1;
    midpoint = _malloc_lookup(halfHeap, 0) | 0;
    return _malloc_search(halfHeap, HEAP_SIZE, bytes, midpoint) | 0;
}

/*
* @param int pointer A pointer to the memory location to be freed.
* @returns void
*/
function free(pointer) {
    pointer = pointer | 0;  // Cast to int

    // Start with the lowest possible size of the block.
    var size = 128;
    var buddy = 0;
    var midpoint = 0;
    var temp = 0;
    // Pull off the offset from the heap.
    pointer = pointer - 1 | 0;

    // Prevent double-free errors.
    if ((_malloc_lookup(pointer, 1) | 0) == 0) {
        return;
    }

    // Free the block straight away.
    _malloc_toggle(pointer, 1);

    while ((temp | 0) == 0) {
        // Calculate the position of the buddy (pos XOR size)
        buddy = pointer ^ size;
        if ((buddy | 0) < (pointer | 0)) {
            midpoint = pointer;
        } else {
            midpoint = buddy;
        }
        temp = _malloc_lookup(midpoint, 0) | 0;
        size = size << 1;
    }

    // At this point, we've found the first full pair:
    //  - buddy:  The address of the buddy.
    //  - midpoint:  The midpoint of the block being freed and its buddy.
    //  - size: The size of the block containing the block to be freed and its buddy.

    while (1) {
        // If the buddy is split or allocated, we're done.
        if ((_malloc_lookup(buddy + (size >> 1) | 0, 0) | 0) == 1 |
            (_malloc_lookup(buddy, 1) | 0)) {
            return;
        }
        // Unsplit the current block.
        _malloc_toggle(midpoint, 0);
        // Put the pointer at the start of the block.
        pointer = midpoint - size | 0;
        // Update the size to match the block.
        size = size << 1;
        // If we've freed all the way up to the size of the heap, we're done.
        if ((size | 0) >= 1024) {
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
