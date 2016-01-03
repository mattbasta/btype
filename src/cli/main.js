import fs from 'fs';
import path from 'path';

import compiler from '../compiler/compiler';


export default function(argv, help) {
    var incomingStdin = !('isTTY' in process.stdin);

    if (process.argv.length < 3 && !incomingStdin) {
        help();
        process.exit(1);
        return; // unreachable
    }

    if (argv._[0]) {
        fs.readFile(argv._[0], (err, data) => {
            if (err) {
                console.error('Could not read file.');
                console.error(err);
                help();
                process.exit(1);
                return; // unreacable
            }

            processData(data, argv);
        });
    } else {
        let incomingData = '';
        process.stdin.on('data', data => incomingData += data);
        process.stdin.on('end', () => processData(incomingData, argv));
    }
};

function processData(data, argv) {
    var runtimeEntry = argv['runtime-entry'];
    var compiled = compiler({
        filename: argv._[0] || 'stdin',
        format: argv.target,
        sourceCode: data.toString(),
        config: {
            // Used to define a runtime environment to make application
            // standalone
            runtime: 'runtime' in argv,
            runtimeEntry: runtimeEntry,
            // Used to output debugging information into compiled files
            debugInfo: 'debug-info' in argv,
            debugInfoOutput: argv['debug-info-path'],
        },
    });

    if (!argv.exec) {
        console.log(compiled);
        return;
    }
    if (runtimeEntry) {
        console.log(eval(`${compiled}[${JSON.stringify(runtimeEntry)}]();`));
    } else {
        eval(compiled + ';');
    }
}
