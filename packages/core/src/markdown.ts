import { marked, type MarkedOptions } from 'marked';
import createDOMPurify from 'dompurify';

const renderer = new marked.Renderer();
renderer.table = (header, body) => `<table class="mb-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;

const markedOptions = {
    gfm: true,
    breaks: true,
    mangle: false,
    headerIds: true,
    renderer
} satisfies MarkedOptions & { headerIds?: boolean; mangle: boolean };

marked.setOptions(markedOptions);

const domPurify = typeof window !== 'undefined' ? createDOMPurify(window) : undefined;

export function renderMarkdownToHtml(markdown: string): string {
    const html = (marked.parse(markdown ?? '') as string) || '';
    if (!domPurify) {
        return html;
    }
    return domPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
