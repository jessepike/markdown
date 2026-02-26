import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export async function exportToDocx(markdownContent, defaultPath) {
    try {
        // 1. Create Document
        const children = parseMarkdownToDocx(markdownContent);

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        // 2. Generate Buffer
        const buffer = await Packer.toBuffer(doc);

        // 3. Save Dialog
        const savePath = await save({
            defaultPath: defaultPath ? defaultPath.replace(/\.md$/, '.docx') : 'untitled.docx',
            filters: [{
                name: 'Word Document',
                extensions: ['docx']
            }]
        });

        if (!savePath) return; // Cancelled

        // 4. Write File
        await writeFile(savePath, new Uint8Array(buffer));
        console.log('Exported to DOCX:', savePath);
        alert('Export Successful!');

    } catch (err) {
        console.error('DOCX Export Failed:', err);
        alert('Export Failed: ' + err.message);
    }
}

// Simple Markdown Parser for MVP
// For a robust solution, we'd use markdown-it's parser to walk the AST.
// Here we'll do line-by-line for basic headers/paragraphs.
function parseMarkdownToDocx(markdown) {
    const lines = markdown.split('\n');
    const docxChildren = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return; // Skip empty lines for now (docx adds spacing usually)

        // Headers
        if (trimmed.startsWith('# ')) {
            docxChildren.push(new Paragraph({
                text: trimmed.substring(2),
                heading: HeadingLevel.HEADING_1,
            }));
        } else if (trimmed.startsWith('## ')) {
            docxChildren.push(new Paragraph({
                text: trimmed.substring(3),
                heading: HeadingLevel.HEADING_2,
            }));
        } else if (trimmed.startsWith('### ')) {
            docxChildren.push(new Paragraph({
                text: trimmed.substring(4),
                heading: HeadingLevel.HEADING_3,
            }));
        }
        // List Item (Unordered)
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            docxChildren.push(new Paragraph({
                text: trimmed.substring(2),
                bullet: {
                    level: 0
                }
            }));
        }
        // Paragraph
        else {
            docxChildren.push(new Paragraph({
                children: [new TextRun(trimmed)],
            }));
        }
    });

    return docxChildren;
}
