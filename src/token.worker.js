import { countTokens } from '@anthropic-ai/tokenizer';

// Report startup
self.postMessage({ debug: "Worker started" });

self.onmessage = async (e) => {
    self.postMessage({ debug: "Worker received message" });
    const text = e.data;
    try {
        const count = countTokens(text);
        self.postMessage({ count });
    } catch (err) {
        console.error('Token calculation failed:', err);
        self.postMessage({ error: err.message });
    }
};

self.onerror = function (message, source, lineno, colno, error) {
    self.postMessage({ error: `Global Worker Error: ${message}` });
};
