/**
 * Casts an int to a uint
 * @param {int} val
 * @returns {uint}
 */
function int2uint(val) {
    val = val | 0;
    if ((val | 0) < 0) {
        return 0;
    }
    return val | 0;
}

/**
 * Casts a uint to int (32-bit)
 * @param {uint} val
 * @returns {int}
 */
function uint2int(val) {
    val = val | 0;
    if ((val | 0) > 2147483647) { // 2^(32-1) - 1
        return 2147483647;
    }
    return val | 0;
}

/**
 * Casts a float to a uint
 * @param {float} val
 * @returns {uint}
 */
function float2uint(val) {
    val = +val;
    if (+val < 0) {
        return 0;
    }
    if (+val > 4294967295) { // 2^32 - 1
        return 4294967295;
    }
    return val | 0;
}
