# btype

[![Build Status](https://travis-ci.org/mattbasta/btype.svg?branch=master)](https://travis-ci.org/mattbasta/btype) [![Join the chat at https://gitter.im/mattbasta/btype](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mattbasta/btype?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## A fast language for the web

BType is a compiled, statically typed language for the web that doesn't get in
the way of day-to-day development. It's unusual for a language to be considered "fast"; rather, it is usually the case that the language *runtime* is considered fast. BType achieves these performance results by using "native" compile targets like asm.js and LLVM IR instead of running in an interpreter. This enables complex optimizations that perform much closer to native than other means.

At the time of writing, BType is still in an extremely early phase of development and should NOT be used for any production needs.


## Goals

- Provide a language with the best features of JavaScript, Python, etc.
- Compiled code should run faster than normal JavaScript
- Code should compile to a wide array of compile targets
- Tools for accessing external JS utilities should be available
- You shouldn't need to worry about memory management
- Should compile very quickly
- Code should minify exceptionally well


# Features

- Tree shaking
- Lexical scope, closures
- First-class functions
- Compiles directly to asm.js, vanilla JavaScript, and LLVM IR
- Operator overloading
- Type safety
