import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { createMarkdownState } from '../editor/state';

type Props = {
    markdown: string;
    onError?: (message: string) => void;
    onReady?: () => void;
};

export function MarkdownView({ markdown, onError, onReady }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        try {
            const state = createMarkdownState(markdown);
            viewRef.current = new EditorView({
                state,
                parent: containerRef.current
            });
            onReady?.();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Markdown previewを初期化できませんでした。';
            onError?.(message);
        }

        return () => {
            viewRef.current?.destroy();
            viewRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) {
            return;
        }

        const current = view.state.doc.toString();
        if (current === markdown) {
            return;
        }

        try {
            view.dispatch({
                changes: { from: 0, to: current.length, insert: markdown }
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Markdown previewの更新に失敗しました。';
            onError?.(message);
        }
    }, [markdown, onError]);

    return <div className="mb-markdown" ref={containerRef} />;
}
