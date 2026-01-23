import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
    html: true,
    breaks: true
});

const input = "Line 1\nLine 2";
const output = md.render(input);

console.log("Input:", JSON.stringify(input));
console.log("Output:", JSON.stringify(output));

if (output.includes("<br>")) {
    console.log("SUCCESS: Breaks are working.");
} else {
    console.error("FAILURE: Breaks are NOT working.");
    process.exit(1);
}
