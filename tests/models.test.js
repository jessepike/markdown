import { describe, expect, it } from 'vitest';
import {
    createPromptRecord,
    createShelfRecord,
    inferShelfKind,
    matchesSearch,
    normalizeTags,
} from '../src/models.js';

describe('models', () => {
    it('normalizes tags consistently', () => {
        expect(normalizeTags('Draft, Prompt, draft')).toEqual(['draft', 'prompt']);
    });

    it('creates prompt records with metadata defaults', () => {
        const prompt = createPromptRecord({ text: '# Prompt\n\nBody' });
        expect(prompt.title).toContain('Prompt');
        expect(prompt.category).toBe('general');
        expect(prompt.tags).toEqual([]);
    });

    it('infers code shelf items from code-like content', () => {
        expect(inferShelfKind('const x = 1;')).toBe('code');
        expect(inferShelfKind('A short note')).toBe('text');
    });

    it('creates shelf image records without text', () => {
        const shelf = createShelfRecord({ kind: 'image', imagePath: 'data:image/png;base64,abc' });
        expect(shelf.kind).toBe('image');
        expect(shelf.imagePath).toContain('data:image');
    });

    it('matches search across tags and metadata', () => {
        const prompt = createPromptRecord({ title: 'Release Prompt', text: 'Ship it', tags: ['deploy'] });
        expect(matchesSearch(prompt, 'deploy')).toBe(true);
        expect(matchesSearch(prompt, 'missing')).toBe(false);
    });
});
