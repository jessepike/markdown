export function nowIso() {
    return new Date().toISOString();
}

export function createTitle(text, fallback = 'Untitled', max = 48) {
    const firstLine = String(text || '').split(/\r?\n/).find(Boolean) || fallback;
    return firstLine.length > max ? `${firstLine.slice(0, max)}...` : firstLine;
}

export function inferShelfKind(text, explicitKind = null) {
    if (explicitKind) return explicitKind;
    const sample = String(text || '');
    if (!sample.trim()) return 'note';

    const codeSignals = [
        /```/,
        /^\s{2,}\S/m,
        /\b(function|const|let|class|import|export|return|SELECT|INSERT|UPDATE|DELETE)\b/,
        /[{}();=>]/,
    ];

    return codeSignals.some((pattern) => pattern.test(sample)) ? 'code' : 'text';
}

export function normalizeTags(value) {
    if (!value) return [];
    const tags = Array.isArray(value) ? value : String(value).split(',');
    return tags
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

export function serializeTags(tags) {
    return normalizeTags(tags).join(', ');
}

export function createPromptRecord(entry = {}) {
    const text = entry.text || '';
    const createdAt = entry.createdAt || nowIso();
    return {
        id: entry.id || `prompt-${Date.now().toString(36)}`,
        title: entry.title || createTitle(text, 'Untitled Prompt', 56),
        text,
        category: entry.category || 'general',
        tags: normalizeTags(entry.tags),
        notes: entry.notes || '',
        createdAt,
        updatedAt: entry.updatedAt || createdAt,
        pinned: !!entry.pinned,
    };
}

export function createShelfRecord(entry = {}) {
    const text = entry.text || '';
    const createdAt = entry.createdAt || nowIso();
    const kind = entry.kind || inferShelfKind(text);

    return {
        id: entry.id || `shelf-${Date.now().toString(36)}`,
        title: entry.title || createTitle(text, kind === 'image' ? 'Image' : 'Untitled', 42),
        text,
        kind,
        source: entry.source || 'manual',
        imagePath: entry.imagePath || null,
        mimeType: entry.mimeType || null,
        createdAt,
        updatedAt: entry.updatedAt || createdAt,
        pinned: !!entry.pinned,
        sensitive: !!entry.sensitive,
        expiresAt: entry.expiresAt || null,
        tags: normalizeTags(entry.tags),
    };
}

export function matchesSearch(record, query, extra = []) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return true;

    const haystack = [
        record.title,
        record.text,
        record.notes,
        record.category,
        ...(record.tags || []),
        ...extra,
    ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();

    return haystack.includes(normalized);
}
