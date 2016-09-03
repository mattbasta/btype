export default function generate(env) {
    return Array.from(env.included.values()).map(i => i.scope.toString()).join('\n');
};
