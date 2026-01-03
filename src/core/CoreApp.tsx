import { useMemo, useState } from 'react';
import { MarkdownView } from './components/MarkdownView';
import { ErrorView } from './components/ErrorView';
import { renderMarkdownToHtml } from './markdown';

export type CoreProps = {
    markdown: string;
    updatedAt?: number;
    onError?: (message: string) => void;
};

export function CoreApp({ markdown, updatedAt, onError }: CoreProps) {
    const [error, setError] = useState<string | null>(null);

    const html = useMemo(() => {
        try {
            setError(null);
            return renderMarkdownToHtml(markdown);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to render Markdown.';
            setError(message);
            onError?.(message);
            return '';
        }
    }, [markdown, onError]);

    if (error) {
        return <ErrorView message={error} />;
    }

    return (
        <div className="mb-shell" data-updated-at={updatedAt ?? ''}>
            <MarkdownView html={html} />
        </div>
    );
}
