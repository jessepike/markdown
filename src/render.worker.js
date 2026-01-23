import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({
    html: true, // We allow HTML but sanitize in the main thread
    linkify: true,
    typographer: true
}).use(taskLists);

self.onmessage = (e) => {
    const markdownText = e.data;
    const html = md.render(markdownText);
    self.postMessage(html);
};
