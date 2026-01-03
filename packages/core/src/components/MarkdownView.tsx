type Props = {
    html: string;
};

export function MarkdownView({ html }: Props) {
    return <article className="mb-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
