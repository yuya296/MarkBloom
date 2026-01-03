import { createRoot, Root } from 'react-dom/client';
import { CoreApp, CoreProps } from './CoreApp';

export type CoreRenderer = {
    render: (markdown: string, updatedAt?: number) => void;
    dispose: () => void;
};

export function renderCore(container: HTMLElement, props: CoreProps): CoreRenderer {
    let currentProps = props;
    let root: Root | null = createRoot(container);

    const render = (markdown: string, updatedAt?: number) => {
        currentProps = { ...currentProps, markdown, updatedAt };
        root?.render(<CoreApp {...currentProps} />);
    };

    render(props.markdown, props.updatedAt);

    const dispose = () => {
        root?.unmount();
        root = null;
    };

    return { render, dispose };
}

export { CoreApp } from './CoreApp';
export { renderMarkdownToHtml } from './markdown';
