# btype

[![Build Status](https://travis-ci.org/mattbasta/btype.svg?branch=master)](https://travis-ci.org/mattbasta/btype) [![Join the chat at https://gitter.im/mattbasta/btype](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mattbasta/btype?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


## A fast language for the web

BType is a compiled, statically typed language for the web that doesn't get in
the way of day-to-day development. It's unusual for a language to be considered "fast"; rather, it is usually the case that the language *runtime* is considered fast. BType achieves good performance by using "native" compile targets like asm.js and LLVM IR.

At the time of writing, BType is still experimental and should NOT be used for production needs.


# Features

- Tree shaking
- Lexical scope, closures, first-class functions
- Compiles directly to JavaScript and LLVM IR
- Operator overloading
- Generics
- Strong static typing with type inference

## Goals

- Provide a language with the best features of most modern dynamic languages
- Code compiled to JS should run faster than vanilla JavaScript
- Code should compile to a wide array of targets
- Tools for accessing external JS utilities should be available
- Automatic memory management
- Very fast compilation
- Code compiled to JavaScript should minify well


# Requirements

## Standalone (CLI)

You must have Node 6.x or later installed to run BType via the command line.
This is mostly for performance reasons. Running tests requires LLVM 3.8 or
later.

```bash
npm install -g btype

# or for hacking

npm install
brew install llvm  # Or your favorite package manager
```

BType targets LLVM 3.8.


## Library

To use BType in your project, you can use these other projects to compile your
BType source:

- **[btype-hook](https://github.com/mattbasta/btype-hook)**: A Node.js `require()` hook that allows you to import BType code just like a JavaScript file.
- **[btype-webpack-loader](https://github.com/mattbasta/btype-webpack-loader)**: A Webpack loader that allows you to `require()` or `import` BType code into your project.

If you would like to use BType directly, you can install the compiler as a library:

```bash
npm install --save btype
```

You can require it as you'd expect:

```js
import fs from 'fs';
import path from 'path';

import btype from 'btype';

const filePath = path.resolve('myBTypeFile.bt');
const source = fs.readFileSync(filePath).toString();

const transpiled = btype(source, filePath, 'js');
console.log(transpiled);
```

To use BType as a library, there is no minimum version of Node required. ES5
support is required.
