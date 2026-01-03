import { useEffect, useState } from 'react';
import { MarkdownView } from './components/MarkdownView';
import { ErrorView } from './components/ErrorView';

export type CoreProps = {
    markdown: string;
    updatedAt?: number;
    onError?: (message: string) => void;
};

export function CoreApp({ markdown, updatedAt, onError }: CoreProps) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
    }, [markdown]);

    const handleReady = () => {
        setError(null);
    };

    const handleError = (message: string) => {
        setError(message);
        onError?.(message);
    };

    return (
        <div className="mb-shell" data-updated-at={updatedAt ?? ''}>
            {error && <ErrorView message={error} />}
            {!error && (
                <MarkdownView markdown={markdown} onError={handleError} onReady={handleReady} />
            )}
        </div>
    );
}
