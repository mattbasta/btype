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


# Requirements

You must have Node 5.x or later installed. Running tests requires LLVM 3.6 or later.

```bash
npm install -g btype

# or for hacking

npm install
brew install llvm  # Or your favorite package manager
```


## Goals

- Provide a language with the best features of JavaScript, Python, etc.
- Code compiled to JS should run faster than vanilla JavaScript
- Code should compile to a wide array of targets
- Tools for accessing external JS utilities should be available
- Automatic memory management
- Very fast compilation
- Code compiled to JavaScript should minify well
