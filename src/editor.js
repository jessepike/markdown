import { EditorView, basicSetup } from "codemirror";
import { placeholder } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { search, openSearchPanel, closeSearchPanel } from "@codemirror/search";

const themeCompartment = new Compartment();

const zedTheme = EditorView.theme({
    "&": {
        color: "#abb2bf",
        backgroundColor: "#282c34" // Match --bg-editor
    },
    ".cm-content": {
        caretColor: "#528bff"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "#528bff"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "#3e4451"
    },
    ".cm-gutters": {
        backgroundColor: "#282c34",
        color: "#5c6370",
        border: "none"
    }
}, { dark: true });

const lightTheme = EditorView.theme({
    "&": {
        color: "#0d1117",
        backgroundColor: "#e1e4e8" // Match --bg-editor
    },
    ".cm-content": {
        caretColor: "#0969da"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "#0969da"
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "#bbefff"
    },
    ".cm-gutters": {
        backgroundColor: "#e1e4e8",
        color: "#57606a",
        border: "none"
    }
}, { dark: false });

export function setEditorTheme(view, isDark) {
    view.dispatch({
        effects: themeCompartment.reconfigure(isDark ? zedTheme : lightTheme)
    });
}

export function createEditor(parent, initialContent, onChange, onCursorChange, onPaste, options = {}) {
    const pasteHandler = onPaste ? EditorView.domEventHandlers({
        paste(event, view) {
            return onPaste(event, view);
        }
    }) : [];

    const startState = EditorState.create({
        doc: initialContent,
        extensions: [
            basicSetup, // Using the convenience basicSetup from 'codemirror' package
            markdown(),
            themeCompartment.of(options.theme === 'light' ? lightTheme : zedTheme),
            search({ top: true }), // Configure search panel to appear at top
            placeholder("Start typing..."),
            pasteHandler,
            EditorView.contentAttributes.of({
                spellcheck: options.spellcheck ? "true" : "false"
            }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChange(update.state.doc.toString());
                }
                if (onCursorChange && (update.docChanged || update.selectionSet)) {
                    const state = update.state;
                    const range = state.selection.main;
                    const line = state.doc.lineAt(range.head);
                    // Col is 1-indexed for display
                    onCursorChange(line.number, range.head - line.from + 1);
                }
            })
        ]
    });

    const view = new EditorView({
        state: startState,
        parent: parent
    });

    return view;
}

export function toggleSearch(view) {
    // Check if search panel exists in DOM
    const panel = view.dom.querySelector('.cm-search');
    if (panel) {
        closeSearchPanel(view);
        // Return focus to editor
        view.focus();
    } else {
        openSearchPanel(view);
        // Focus usually happens automatically, but let's ensure input is focused?
        // CodeMirror handles this usually.
    }
}
