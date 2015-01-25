/*
Memory is managed in a buddy system. The heap starts out as one contiguous
block of memory and is continuously divided down until the memory is in 32 byte
chunks.

See https://github.com/mattbasta/btype/wiki/Object-Shape for info

*/

/**
 * @param uint bytes Number of bytes to allocate
 * @returns uint Pointer to location of allocated memory
 */
function malloc(bytes) {
    bytes = bytes | 0;  // Cast to uint

    // Don't allow requesting more memory than the size of the heap
    if ((bytes | 0) > HEAP_SIZE) {
        return 0;
    }

    // Anything requesting zero bytes should be just as happy with the null
    // pointer.
    if ((bytes | 0) == 0) {
        return 0;
    }

    // The requested number of bytes should always be a multiple of 8.
    if ((bytes % 8 | 0) != 0) {
        bytes = bytes + 8 - (bytes % 8 | 0) | 0
    }

    // If the heap hasn't been initialized, do that now.
    // TODO: Move this to the global scope? Is that allowed in asm.js?
    if (ptrheap[4 >> 2] == 0) {
        ptrheap[0 >> 2] = 8;
        ptrheap[4 >> 2] = 1;
        // 16 = 4b (init space) + 4b (global free ptr) + overhead of first free
        //  block (8b)
        ptrheap[8 >> 2] = HEAP_SIZE - 16 | 0;
        // `ptrheap[12 >> 2] = 0`, but we don't need to say that because it
        // already is
    }

    var prevPtr = 0;

    // If there is no free memory remaining in the heap, return the null
    // pointer.
    if (ptrheap[0 >> 2] == 0) {
        return 0;
    }

    var currentPtr = 0;
    currentPtr = ptrheap[0 >> 2] | 0;
    var currentSize = 0;
    var currentSizeMinus = 0;
    for (;;currentPtr = (ptrheap[prevPtr >> 2] | 0)) {

        // Get the size of the current free block of memory.
        currentSize = ptrheap[currentPtr >> 2] | 0;

        // If the requested block won't fit in the current free block, go to
        // the next free block.
        if (currentSize < bytes) {
            // Set the previous pointer to the memory location of the free
            // pointer of the currently iterated block.
            prevPtr = currentPtr + 4 | 0;

            // If the pointer on the current free block is 0, that means we've
            // exhausted all of the free blocks in the heap. We're forced at
            // this point to return a null pointer.
            if (ptrheap[currentPtr + 4 >> 2] == 0) {
                return 0;
            }
            break;

            continue;
        }

        if (currentSize == bytes) {
            // If the free block fits the requested size exactly, update
            // everything and return.

            // Set the pointer for the next free block from the previous
            // pointer to the next free pointer. If there are no remaining
            // free blocks of memory, this value is null, which will be
            // correct.
            ptrheap[prevPtr >> 2] = ptrheap[currentPtr + 4 >> 2] | 0;
            // Return a pointer to the body of the current free block.
            return currentPtr + 8 | 0;
        }

        // 16b = 8b for a second block to fit in the current one + 8b
        // of assumed memory overhead for garbage collection and the like
        if ((currentSize - 16 | 0) > bytes) {
            // The requested size is larger than what waas requested. In this
            // case, we'll split the free block into two.

            // Set the previous pointer equal to the current block's pointer
            // plus the size of the body of the block plus 8 (the overhead of
            // the current block).
            ptrheap[prevPtr >> 2] = currentPtr + bytes + 8 | 0;
            // Set the size of the current block to the requested block size.
            ptrheap[currentPtr >> 2] = bytes | 0;
            // Set the size of the new free block. 16 is the size of the
            // current block's overhead plus the new free block's overhead.
            ptrheap[currentPtr + bytes + 8 >> 2] = currentSize - bytes - 16 | 0;
            // Set the pointer of the new free block to be equal to the proper
            // next new pointer.
            ptrheap[currentPtr + bytes + 12 >> 2] = ptrheap[currentPtr + 4 >> 2] | 0;

            // The pointer to the next free block on the current block does not
            // need to be set, as the value is meaningless now.

            // Return a pointer to the body of the current free block.
            return currentPtr + 8 | 0;
        }

        // Otherwise, the available size is larger than the requested size
        // but there isn't enough space to create a new free block in that
        // spot. All we're going to do is update the previous pointer and move
        // on with our lives. The size of the current block stays the same; we
        // are simply returning more space to the user than they requested.

        // Set the previous pointer to the value of the current block's
        // pointer.
        ptrheap[prevPtr >> 2] = ptrheap[currentPtr + 4 >> 2] | 0;

        return currentPtr + 8 | 0;

    }

    return 0;

}

/**
 * @param uint bytes Number of bytes to allocate
 * @returns uint Pointer to location of allocated and cleared memory
 */
function calloc(bytes) {
    bytes = bytes | 0;

    var ptr = 0;
    var iter = 0;
    var destination = 0;

    ptr = malloc(bytes) | 0;

    // If there was an error, bail.
    if ((ptr | 0) == 0) {
        return 0;
    }

    iter = ptr | 0;
    destination = ptr + bytes | 0;

    // Set all requested bytes to zero
    for (; (iter | 0) < (destination | 0); iter = iter + 1 | 0) {
        memheap[iter] = 0;
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

    // Pointers in chain memory allocation are to the body of the block rather
    // than the first byte of memory related to the block.
    pointer = pointer - 8 | 0;

    var prevPtr = 0;
    var nextPtr = 0;
    var temp = 0;

    nextPtr = ptrheap[0] | 0;
    while (nextPtr != 0) {
        if (nextPtr > pointer) {
            // We've encountered the next free block after the pointer. At this
            // point, we need to update the previous and next blocks to link
            // the previous block with this one and this one with the next.

            // Update the previous free block to point at this block.
            ptrheap[prevPtr >> 2] = pointer;
            // Update this block to point at the next one.
            ptrheap[pointer + 4 >> 2] = nextPtr;

            // FIXME: This should test in reverse as well.

            // If this block is adjacent to the next block, combine the two.
            if (nextPtr == (pointer + ptrheap[pointer >> 2] + 8 | 0)) {
                // Update the size to encompass both blocks.
                ptrheap[pointer >> 2] = (ptrheap[pointer >> 2] | 0) + (ptrheap[nextPtr >> 2] | 0) + 8 | 0;
                // Update the free pointer of the current block to be whatever the
                // next block's is.
                ptrheap[pointer + 4 >> 2] = ptrheap[nextPtr + 4 >> 2] | 0;
            }

            return;
        }


        // Update the pointers to continue iterating the free list.
        temp = prevPtr | 0;
        prevPtr = nextPtr + 4 | 0;
        nextPtr = ptrheap[temp + 4 >> 2] | 0;
    }

    // If we've gotten to this point, it means the end of the free list has
    // been reached. That means it's an easy fix: simply set the free pointer
    // of the previous block to equal the current pointer.

    ptrheap[prevPtr >> 2] = pointer | 0;

    // TODO: This should test in reverse as well.
}
