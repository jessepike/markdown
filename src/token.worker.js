import { countTokens } from '@anthropic-ai/tokenizer';

// Report startup
self.postMessage({ debug: "Worker started" });

self.onmessage = async (e) => {
    self.postMessage({ debug: "Worker received message" });
    const text = e.data;
    try {
        const count = countTokens(text);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        self.postMessage({ count, words });
    } catch (err) {
        console.error('Token calculation failed:', err);
        self.postMessage({ error: err.message });
    }
};

self.onerror = function (message, source, lineno, colno, error) {
    self.postMessage({ error: `Global Worker Error: ${message}` });
};
