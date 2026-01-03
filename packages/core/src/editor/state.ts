import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const theme = EditorView.theme({
    '&': {
        backgroundColor: 'transparent',
        color: 'var(--text)',
        fontFamily: '"SF Pro Display", "Segoe UI", "Helvetica Neue", "Fira Sans", system-ui, -apple-system, sans-serif'
    },
    '.cm-content': {
        caretColor: 'transparent',
        fontSize: '15px',
        lineHeight: '1.6',
        padding: 0
    },
    '.cm-line': {
        padding: '0 0 0 8px'
    },
    '.cm-gutters': {
        display: 'none'
    },
    '.cm-scroller': {
        overflow: 'auto'
    },
    '.cm-selectionLayer .cm-selectionBackground': {
        backgroundColor: 'rgba(125, 211, 252, 0.2)'
    }
});

const highlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.8em', fontWeight: '600', lineHeight: '1.2' },
    { tag: tags.heading2, fontSize: '1.5em', fontWeight: '600', lineHeight: '1.2' },
    { tag: tags.heading3, fontSize: '1.3em', fontWeight: '600' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.quote, color: 'var(--muted)' },
    { tag: tags.list, color: 'var(--text)' },
    { tag: tags.link, color: 'var(--accent)' },
    { tag: tags.monospace, fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
]);

const extensions = [
    markdown({ base: markdownLanguage }),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    theme,
    syntaxHighlighting(highlightStyle)
];

export function createMarkdownState(doc: string) {
    return EditorState.create({
        doc,
        extensions
    });
}
