import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullPage?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  text,
  fullPage = false,
}: LoadingSpinnerProps) {
  const content = (
    <>
      <div className={`loading-spinner loading-spinner--${size}`} />
      {text && <p className="loading-spinner-text">{text}</p>}
    </>
  );

  if (fullPage) {
    return <div className="loading-spinner-container">{content}</div>;
  }

  return <div className="loading-spinner-inline">{content}</div>;
}
