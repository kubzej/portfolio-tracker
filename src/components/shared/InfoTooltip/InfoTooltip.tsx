import { useState, useRef, useEffect, ReactNode, useMemo } from 'react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  /** Simple text content - supports **bold** and line breaks (\n) */
  text?: string;
  /** Rich content (JSX) - use this for complex formatted tooltips */
  children?: ReactNode;
  /** Position of the popup (currently both render centered) */
  position?: 'top' | 'bottom';
}

/**
 * Strip markdown-like syntax from tooltip text to get plain text.
 * Useful for displaying descriptions outside of InfoTooltip (e.g., in lists).
 * - Removes **bold** markers
 * - Converts | and \n to spaces
 * - Removes bullet points (•)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function stripTooltipMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold** markers, keep text
    .replace(/\s*\|\s*/g, ' ') // Replace | with space
    .replace(/\s*•\s*/g, ' ') // Replace • with space
    .replace(/\n/g, ' ') // Replace newlines with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Parse simple markdown-like syntax in tooltip text:
 * - **text** → <strong>text</strong>
 * - \n or | → line break
 * - Lines starting with • → bullet points
 */
function parseTooltipText(text: string): ReactNode[] {
  // Split by explicit line breaks
  const lines = text.split(/\n|\|/).map((line) => line.trim());

  return lines.map((line, lineIndex) => {
    if (!line) return null;

    // Determine if this is a bullet point
    const isBullet = line.startsWith('•');

    // Get the actual content (without bullet)
    const lineContent = isBullet ? line.slice(1).trim() : line;

    // Skip empty lines and empty bullets
    if (!lineContent) return null;

    // Parse **bold** syntax within the line
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;

    while ((match = boldRegex.exec(lineContent)) !== null) {
      // Add text before the bold
      if (match.index > lastIndex) {
        parts.push(lineContent.slice(lastIndex, match.index));
      }
      // Add bold text
      parts.push(
        <strong key={`b-${lineIndex}-${match.index}`}>{match[1]}</strong>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < lineContent.length) {
      parts.push(lineContent.slice(lastIndex));
    }

    if (isBullet) {
      return (
        <li key={lineIndex} className="tooltip-bullet">
          {parts.length > 0 ? parts : lineContent}
        </li>
      );
    }

    return <p key={lineIndex}>{parts.length > 0 ? parts : lineContent}</p>;
  });
}

export function InfoTooltip({
  text,
  children,
  position = 'top',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Parse text content with markdown-like syntax
  const parsedContent = useMemo(() => {
    if (children) return children;
    if (text) {
      const parsed = parseTooltipText(text);
      // Check if we have bullet points
      const hasBullets = parsed.some(
        (node) =>
          node &&
          typeof node === 'object' &&
          'type' in node &&
          node.type === 'li'
      );
      if (hasBullets) {
        // Separate paragraphs from bullets
        const paragraphs = parsed.filter(
          (node) =>
            node &&
            typeof node === 'object' &&
            'type' in node &&
            node.type === 'p'
        );
        const bullets = parsed.filter(
          (node) =>
            node &&
            typeof node === 'object' &&
            'type' in node &&
            node.type === 'li'
        );
        return (
          <>
            {paragraphs}
            {bullets.length > 0 && <ul className="tooltip-list">{bullets}</ul>}
          </>
        );
      }
      return parsed;
    }
    return null;
  }, [text, children]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent clicks on the tooltip from bubbling to parent elements (like table headers)
  const handleWrapperClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div
      className="info-tooltip"
      ref={wrapperRef}
      onClick={handleWrapperClick}
      onMouseDown={handleWrapperClick}
    >
      <button
        className="info-tooltip__trigger"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="More information"
        aria-expanded={isOpen}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="info-tooltip__backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`info-tooltip__popup info-tooltip__popup--${position}`}
          >
            <div className="info-tooltip__content">{parsedContent}</div>
            <button
              className="info-tooltip__close"
              onClick={() => setIsOpen(false)}
            >
              Rozumím
            </button>
          </div>
        </>
      )}
    </div>
  );
}
