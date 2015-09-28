export function memberSize(type) {
    if (type._type === 'primitive') return type.getSize();
    return 8; // pointer size
};
