import { appConfigDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { createPromptRecord, matchesSearch, nowIso, normalizeTags } from './models.js';

const PROMPTS_FILE = 'prompt-library.json';
const MAX_PROMPTS = 200;
const WEB_PROMPTS_KEY = 'agentpad-web-prompt-library';
const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export class PromptLibrary {
    constructor() {
        this.items = [];
        this.path = null;
        this.listeners = new Set();
    }

    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emitChange() {
        const snapshot = this.getItems();
        this.listeners.forEach(listener => {
            try {
                listener(snapshot);
            } catch (err) {
                console.error('PromptLibrary listener error:', err);
            }
        });
    }

    async init() {
        if (!isTauriRuntime) {
            await this.load();
            return;
        }
        const configDir = await appConfigDir();
        if (!(await exists(configDir))) {
            await mkdir(configDir, { recursive: true });
        }
        this.path = await join(configDir, PROMPTS_FILE);
        await this.load();
    }

    async load() {
        try {
            if (!isTauriRuntime) {
                const raw = localStorage.getItem(WEB_PROMPTS_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                this.items = Array.isArray(parsed)
                    ? parsed.map(entry => createPromptRecord(entry)).filter(entry => entry.text.trim().length > 0).slice(0, MAX_PROMPTS)
                    : [];
                this.emitChange();
                return;
            }
            if (!this.path || !(await exists(this.path))) {
                this.items = [];
                this.emitChange();
                return;
            }
            const raw = await readTextFile(this.path);
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                this.items = [];
                this.emitChange();
                return;
            }

            this.items = parsed
                .map(entry => createPromptRecord(entry))
                .filter(entry => entry.text.trim().length > 0)
                .slice(0, MAX_PROMPTS);
            this.emitChange();
        } catch (err) {
            console.error('Failed to load prompt library:', err);
            this.items = [];
            this.emitChange();
        }
    }

    async save() {
        try {
            if (!isTauriRuntime) {
                localStorage.setItem(WEB_PROMPTS_KEY, JSON.stringify(this.items, null, 2));
                this.emitChange();
                return;
            }
            if (!this.path) return;
            await writeTextFile(this.path, JSON.stringify(this.items, null, 2));
            this.emitChange();
        } catch (err) {
            console.error('Failed to save prompt library:', err);
        }
    }

    getItems() {
        return [...this.items].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }

    async addPrompt(text, title = null, metadata = {}) {
        if (!text || !text.trim()) return null;
        const prompt = createPromptRecord({
            ...metadata,
            title: (title || '').trim() || metadata.title,
            text,
        });
        this.items = [prompt, ...this.items].slice(0, MAX_PROMPTS);
        await this.save();
        return prompt;
    }

    getPrompt(id) {
        return this.items.find(item => item.id === id) || null;
    }

    async updatePrompt(id, patch = {}) {
        const prompt = this.items.find(item => item.id === id);
        if (!prompt) return null;

        Object.assign(prompt, {
            ...patch,
            tags: patch.tags !== undefined ? normalizeTags(patch.tags) : prompt.tags,
            updatedAt: nowIso(),
        });

        if (!prompt.title?.trim()) {
            prompt.title = createPromptRecord(prompt).title;
        }

        await this.save();
        return prompt;
    }

    async duplicatePrompt(id) {
        const prompt = this.getPrompt(id);
        if (!prompt) return null;

        return this.addPrompt(prompt.text, `${prompt.title} Copy`, {
            category: prompt.category,
            tags: [...prompt.tags],
            notes: prompt.notes,
        });
    }

    async removePrompt(id) {
        this.items = this.items.filter(item => item.id !== id);
        await this.save();
    }

    async togglePin(id) {
        const item = this.items.find(entry => entry.id === id);
        if (!item) return;
        item.pinned = !item.pinned;
        item.updatedAt = nowIso();
        await this.save();
    }

    search(query, options = {}) {
        return this.getItems().filter((prompt) => {
            if (options.category && options.category !== 'all' && prompt.category !== options.category) {
                return false;
            }
            if (options.tag && !prompt.tags.includes(options.tag)) {
                return false;
            }
            return matchesSearch(prompt, query);
        });
    }
}

export const promptLibrary = new PromptLibrary();
