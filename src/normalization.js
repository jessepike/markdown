import { diffLines } from 'diff';

/**
 * Normalizes GFM table formatting: trims cell content, ensures single space padding.
 */
function normalizeGfmTables(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        // Detect start of a table block (at least 2 consecutive lines with |)
        if (lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('|')) {
            const tableStart = i;
            while (i < lines.length && lines[i].includes('|')) {
                i++;
            }
            const tableLines = lines.slice(tableStart, i);
            const normalized = tableLines.map(line => {
                // Split by |, trim each cell, rejoin with single-space padding
                const trimmed = line.trim();
                if (!trimmed.startsWith('|')) {
                    // Not a proper pipe table line, leave as-is
                    return line;
                }
                const cells = trimmed.split('|');
                // cells[0] is empty (before first |), cells[last] is empty (after last |)
                const inner = cells.slice(1, -1).map(c => ` ${c.trim()} `);
                return '|' + inner.join('|') + '|';
            });
            result.push(...normalized);
        } else {
            result.push(lines[i]);
            i++;
        }
    }

    return result.join('\n');
}

/**
 * Normalizes Markdown content based on v1 rules.
 * @param {string} text 
 * @returns {string} Normalized text
 */
export function normalizeContent(text) {
    let normalized = text;

    // 1. Line Endings (CRLF -> LF)
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Trailing Whitespace (per line)
    // Regex: Replace any spaces/tabs at end of line with nothing, preserving newline
    normalized = normalized.replace(/[ \t]+$/gm, '');

    // 3. Code Fences (~~~ -> ```)
    // Only at start of line
    normalized = normalized.replace(/^~~~(\w*)$/gm, '```$1');

    // 4. Excessive Blank Lines (Collapse >2 to 2)
    // >2 newlines means 3 or more \n
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // 5. List Indentation (normalize to multiples of 2 spaces)
    normalized = normalized.replace(/^( {3,})([-*+]|\d+\.)\s/gm, (match, indent, marker, offset) => {
        const rounded = Math.round(indent.length / 2) * 2;
        return ' '.repeat(rounded) + marker + ' ';
    });

    // 6. GFM Table Pipe Alignment
    normalized = normalizeGfmTables(normalized);

    // 7. Final Newline
    // Ensure exactly one trailing newline
    if (!normalized.endsWith('\n')) {
        normalized = normalized + '\n';
    }
    // Also if multiple newlines at EOF, trim to 1
    normalized = normalized.replace(/\n+$/, '\n');

    return normalized;
}

/**
 * Generates a line-based diff.
 * @param {string} original 
 * @param {string} modified 
 * @returns {Array<import('diff').Change>}
 */
export function generateDiff(original, modified) {
    return diffLines(original, modified, { newlineIsToken: true });
}
