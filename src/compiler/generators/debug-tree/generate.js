export default function generate(env) {
    var output = '';
    env.included.forEach(i => {
        output += i.scope.toString();
    });
    return output;
};
