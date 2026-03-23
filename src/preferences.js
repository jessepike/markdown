import { appConfigDir, join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';

const SETTINGS_FILE = 'settings.json';

const DEFAULTS = {
    xmlWrapperTag: 'document',
    editorFontSize: 14,
    theme: 'system', // dark, light, system
    syncScroll: true,
    renderFrontmatter: true,
    alwaysReload: false,
    promptOnExternalChange: false,
    includeFrontmatterInCopyLLM: false,
    sanitizationStripFrontmatter: true,
    exportIncludeTheme: true,
    spellcheckEnabled: false
};

class PreferencesManager {
    constructor() {
        this.settings = { ...DEFAULTS };
        this.listeners = [];
        this.configPath = null;
    }

    async init() {
        try {
            const configDir = await appConfigDir();
            this.configPath = await join(configDir, SETTINGS_FILE);

            // Ensure config dir exists
            const dirExists = await exists(configDir);
            if (!dirExists) {
                await mkdir(configDir, { recursive: true });
            }

            await this.load();
        } catch (err) {
            console.error('Failed to init preferences:', err);
        }
    }

    async load() {
        try {
            if (await exists(this.configPath)) {
                const content = await readTextFile(this.configPath);
                const loaded = JSON.parse(content);
                // Merge with defaults to ensure new keys exist
                this.settings = { ...DEFAULTS, ...loaded };
                this.notifyListeners();
            } else {
                await this.save();
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    async save() {
        try {
            if (!this.configPath) return;
            await writeTextFile(this.configPath, JSON.stringify(this.settings, null, 2));
            this.notifyListeners();
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }

    get(key) {
        return this.settings[key];
    }

    getAll() {
        return { ...this.settings };
    }

    async set(key, value) {
        this.settings[key] = value;
        await this.save();
    }

    // Subscribe to changes
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.settings));
    }
}

export const prefs = new PreferencesManager();
