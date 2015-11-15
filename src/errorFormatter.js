export default class ErrorFormatter {
    /**
     * @param  {string[]} lines
     */
    constructor(lines) {
        this.lines = lines;
    }

    /**
     * Returns the column number for the current file from a start index
     * @param  {int} startIndex
     * @return {int} The column number
     */
    getColumn(startIndex) {
        var consumed = 0;

        var i;
        for (i = 0; i < this.lines.length; i++) {
            let line = this.lines[i];
            if (consumed + line.length + 1 > startIndex) {
                break;
            }
            consumed += line.length + 1;
        }
        return startIndex - consumed;
    }

    /**
     * Helper that wraps `getVerboseError` to accept a start index rather than
     * a column number
     * @param  {int} line
     * @param  {int} startIndex
     * @return {string}
     */
    getVerboseErrorAtIndex(line, startIndex) {
        return this.getVerboseError(line, this.getColumn(startIndex));
    }

    /**
     * Returns a verbose error with a source snippet
     * @param  {int} line
     * @param  {int} column
     * @return {string} The verbose error
     */
    getVerboseError(line, column) {
        var [lineData, offset] = this.getTrimmedLine(this.lines[line - 1], column);

        var hasPreviousLine = line > 1;
        var hasNextLine = line < this.lines.length;

        var prefixLength = hasNextLine ? (line + 1).toString().length : line.toString().length;

        var prefix = this.rpad(line.toString(), prefixLength);
        var cursorPrefix = this.rpad('', prefixLength);

        var output = prefix + ' | ' + lineData + '\n' +
            cursorPrefix + ' | ' + this.getVerboseErrorCursor(column + offset) + ` (${line}:${column})`;

        if (hasPreviousLine) {
            output = this.rpad((line - 1).toString(), prefixLength) +
                ' | ' +
                this.getTrimmedLine(this.lines[line - 2])[0] +
                '\n' +
                output;
        }
        if (hasNextLine) {
            output += '\n' +
                this.rpad((line + 1).toString(), prefixLength) +
                ' | ' +
                this.getTrimmedLine(this.lines[line])[0] +
                '\n';
        }

        return output;
    }

    /**
     * Pads the right of a string
     * @param  {string} string The string to pad
     * @param  {int} length The length the string should be
     * @param  {string} [padWith] What to pad the string with
     * @return {string} The padded string
     */
    rpad(string, length, padWith = ' ') {
        return string + padWith.repeat(length - string.length);
    }

    /**
     * Returns the trimmed version of a line and an offset for the start position
     * @param  {string} lineData
     * @param  {int} column Column, defaults to zero
     * @return {array} Two-tuple containing trimmed line and offset
     */
    getTrimmedLine(lineData, column = 0) {
        var offset = 0;
        if (column > 40) {
            lineData = '...' + lineData.substr(column - 37);
            offset -= 40;
        }
        if (lineData.length > 80) {
            lineData = lineData.substr(0, 77) + '...';
        }

        return [lineData, offset];
    }

    /**
     * Returns the cursor for the verbose error
     * @param  {int} position The start index of the cursor
     * @return {string}
     */
    getVerboseErrorCursor(position) {
        return (new Array(position)).join(' ') + '^';
    }

};
