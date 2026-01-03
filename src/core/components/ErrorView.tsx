type Props = {
    message: string;
};

export function ErrorView({ message }: Props) {
    return (
        <div className="mb-error" role="alert">
            <p className="mb-error__title">Render error</p>
            <p className="mb-error__detail">{message}</p>
        </div>
    );
}
