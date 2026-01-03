import { renderCore } from './index';

declare global {
    interface Window {
        MarkBloomCoreTest: {
            render: (markdown: string, updatedAt?: number) => void;
            reset: () => void;
        };
    }
}

const rootElement = (() => {
    const existing = document.getElementById('root');
    if (existing) return existing;
    const created = document.createElement('div');
    created.id = 'root';
    document.body.appendChild(created);
    return created;
})();

let renderer = renderCore(rootElement, { markdown: '' });

window.MarkBloomCoreTest = {
    render(markdown: string, updatedAt?: number) {
        renderer.render(markdown, updatedAt);
    },
    reset() {
        renderer.dispose();
        renderer = renderCore(rootElement, { markdown: '' });
    }
};
