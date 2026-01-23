import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
// Theme handled by custom definition below
// Spec said "One Dark aesthetic", I can use the official theme if installed.
// I installed: @codemirror/lang-markdown @codemirror/view @codemirror/state codemirror
// I missed @codemirror/theme-one-dark.
// I will simulate One Dark via EditorView.theme for now to save a huge install step,
// or I can just install it quickly next.
// Let's implement a quick custom theme object here to match CSS variables.

const zedTheme = EditorView.theme({
    "&": {
        color: "#abb2bf",
        backgroundColor: "#23272e"
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
        backgroundColor: "#23272e",
        color: "#5c6370",
        border: "none"
    }
}, { dark: true });

export function createEditor(parent, initialContent, onChange) {
    const startState = EditorState.create({
        doc: initialContent,
        extensions: [
            basicSetup, // Using the convenience basicSetup from 'codemirror' package
            markdown(),
            zedTheme,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChange(update.state.doc.toString());
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
