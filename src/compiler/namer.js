const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const NUMCHARS = CHARS.length;

export default function NamerFactory() {
    var count = 0;
    return function Namer() {
        var name = CHARS[count % NUMCHARS];
        var tmp = (count - count % NUMCHARS) / NUMCHARS;
        while (tmp) {
            name += CHARS[tmp % NUMCHARS - 1];
            tmp = (tmp - tmp % NUMCHARS) / NUMCHARS;
        }
        count++;
        return '$' + name;
    };
};
