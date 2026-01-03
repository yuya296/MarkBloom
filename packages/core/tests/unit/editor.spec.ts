import { describe, expect, it } from 'vitest';
import { createMarkdownState } from '../../src/editor/state';
import { EditorState } from '@codemirror/state';

describe('createMarkdownState', () => {
    it('creates a read-only state with provided markdown', () => {
        const markdown = '# Title\n\nSome content';
        const state = createMarkdownState(markdown);
        expect(state.doc.toString()).toBe(markdown);
        expect(state.facet(EditorState.readOnly)).toBe(true);
    });
});
