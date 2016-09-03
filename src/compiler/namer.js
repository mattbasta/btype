const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const NUMCHARS = CHARS.length;

export default function NamerFactory() {
    let count = 0;
    return function Namer() {
        let name = CHARS[count % NUMCHARS];
        let tmp = (count - count % NUMCHARS) / NUMCHARS;
        while (tmp) {
            name += CHARS[tmp % NUMCHARS - 1];
            tmp = (tmp - tmp % NUMCHARS) / NUMCHARS;
        }
        count++;
        return '$' + name;
    };
};
