var fs = require('fs');
var path = require('path');

import compiler from '../compiler/compiler';
import lexer from '../lexer';
import parse from '../parser';


function help() {
    console.log(`Usage:
    btype <file path>
    `);
}

export default function(argv) {
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
        process.stdin.on('data', data => {
            incomingData += data;
        });
        process.stdin.on('end', () => processData(incomingData, argv));
    }
};

function processData(data, argv) {
    var parsed = parse(lexer(data.toString()));
    var compiled = compiler({
        filename: argv._[0],
        tree: parsed,
        format: argv.target,
        config: {
            // Used to define a runtime environment to make application
            // standalone
            runtime: 'runtime' in argv,
            runtimeEntry: argv['runtime-entry'],
            // Used to output debugging information into compiled files
            debugInfo: 'debug-info' in argv,
            debugInfoOutput: argv['debug-info-path'],
        }
    });

    console.log(compiled);
}
