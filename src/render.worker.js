import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({
    html: true, // We allow HTML but sanitize in the main thread
    linkify: true,
    typographer: true,
    breaks: true // Convert '\n' in paragraphs into <br>
}).use(taskLists);

self.onmessage = (e) => {
    // Determine if data is simple string (legacy/direct) or object
    let markdownText = '';
    // FORCE enable breaks by default in constructor, but we can override if we re-init.
    // simpler: just trust md was init with breaks: true above. 

    let options = { renderFrontmatter: true, docType: 'markdown' };

    if (typeof e.data === 'string') {
        markdownText = e.data;
    } else if (e.data && typeof e.data === 'object') {
        markdownText = e.data.content || '';
        if (e.data.options) {
            options = { ...options, ...e.data.options };
        }
    }

    if (options.docType === 'yaml') {
        const yamlBlock = markdownText.replace(/```/g, '\\`\\`\\`');
        self.postMessage(md.render(`\`\`\`yaml\n${yamlBlock}\n\`\`\``));
        return;
    }

    // Clean up internal AI artifacts (PUA characters)
    // Matches sequences like cite...
    markdownText = markdownText.replace(/\uE200[\s\S]*?\uE201/g, '');

    // YAML Front Matter Parsing
    if (options.renderFrontmatter) {
        // Robust regex: Support --- or ___ as start delimiter
        // Match start of string, followed by 3 dashes or underscores, newline, content, newline, 3 dashes or underscores
        const yamlMatch = markdownText.match(/^([-_]{3})\s*[\r\n]+([\s\S]+?)[\r\n]+[-_]{3}/);
        if (yamlMatch) {
            const yamlContent = yamlMatch[2];
            const lines = yamlContent.split(/[\r\n]+/);
            let fmHtml = '<div class="front-matter">';

            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim(); // Handle values with colons
                    // Basic cleanup of quotes if present (optional but nice)
                    const cleanValue = value.replace(/^["'](.*)["']$/, '$1');

                    fmHtml += `
                        <div class="fm-row">
                            <span class="fm-key">${key}:</span>
                            <span class="fm-value">${cleanValue}</span>
                        </div>`;
                }
            });
            fmHtml += '</div>';

            // Replace the block with our HTML
            markdownText = markdownText.replace(yamlMatch[0], fmHtml);
        }
    }

    const html = md.render(markdownText);
    self.postMessage(html);
};
