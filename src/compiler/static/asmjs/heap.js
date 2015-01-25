// For use by the memory manager.
var memheap = new stdlib.Uint8Array(heap);
// Heap object for storing pointers.
var ptrheap = new stdlib.Uint32Array(heap);
// Heap object for storing integer types.
var intheap = new stdlib.Int32Array(heap);
// Heap object for storing floating point data.
var floatheap = new stdlib.Float64Array(heap);
// Heap object for storing 32-bit floating point data.
var sfloatheap = new stdlib.Float32Array(heap);
