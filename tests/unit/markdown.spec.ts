import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../../src/core/markdown';

describe('renderMarkdownToHtml', () => {
    it('converts markdown table into table html', () => {
        const html = renderMarkdownToHtml('| h1 | h2 |\n| --- | --- |\n| a | b |');
        expect(html).toContain('<table');
        expect(html).toContain('<thead>');
        expect(html).toContain('mb-table');
    });

    it('sanitizes script tags', () => {
        const html = renderMarkdownToHtml('<script>alert(1)</script>');
        expect(html).not.toContain('script');
    });
});
