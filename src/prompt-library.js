import { appConfigDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const PROMPTS_FILE = 'prompt-library.json';
const MAX_PROMPTS = 200;

function nowIso() {
    return new Date().toISOString();
}

function createTitle(text) {
    const firstLine = text.split(/\r?\n/).find(Boolean) || 'Untitled Prompt';
    return firstLine.length > 48 ? `${firstLine.slice(0, 48)}...` : firstLine;
}

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
        const configDir = await appConfigDir();
        if (!(await exists(configDir))) {
            await mkdir(configDir, { recursive: true });
        }
        this.path = await join(configDir, PROMPTS_FILE);
        await this.load();
    }

    async load() {
        try {
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
                .map(entry => ({
                    id: entry.id || Date.now().toString(36),
                    title: entry.title || createTitle(entry.text || ''),
                    text: entry.text || '',
                    createdAt: entry.createdAt || nowIso(),
                    updatedAt: entry.updatedAt || entry.createdAt || nowIso(),
                    pinned: !!entry.pinned
                }))
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

    async addPrompt(text, title = null) {
        if (!text || !text.trim()) return null;
        const now = nowIso();
        const prompt = {
            id: Date.now().toString(36),
            title: (title || '').trim() || createTitle(text),
            text,
            createdAt: now,
            updatedAt: now,
            pinned: false
        };
        this.items = [prompt, ...this.items].slice(0, MAX_PROMPTS);
        await this.save();
        return prompt;
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
}

export const promptLibrary = new PromptLibrary();
