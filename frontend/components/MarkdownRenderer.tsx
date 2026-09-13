import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  const sanitized = content
    .replace(/<PROJECT_DATA>[\s\S]*?<\/PROJECT_DATA>/g, '')
    .replace(/\[PROJECT RISK ENGINE EVALUATION\]/g, '')
    .replace(/\[SAFETY INCIDENTS\]/g, '')
    .replace(/\[EXACT FACTS.*?\]/g, '')
    .replace(/\[RELEVANT SEMANTIC EVIDENCE.*?\]/g, '')
    .replace(/PROJECT METADATA & AUTHORITATIVE RISK ENGINE:/g, '')
    .replace(/EXACT FACTS & RECORD COUNTS \(SQL\):/g, '')
    .replace(/RELEVANT SEMANTIC EVIDENCE \(RAG VECTOR SEARCH\):/g, '')
    .trim();

  const lines = sanitized.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) {
        elements.push(
          <p key={'p-' + key} className='text-slate-800 leading-relaxed my-1.5'>
            {renderInline(text)}
          </p>
        );
      }
      paragraphBuffer = [];
    }
  };

  const flushList = (key: string) => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={'ul-' + key} className='space-y-1.5 my-2 pl-4 list-disc marker:text-[#D99A16]'>
            {currentList.items.map((item, idx) => (
              <li key={'li-' + idx} className='text-slate-800 leading-relaxed text-xs sm:text-sm'>
                {item}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={'ol-' + key} className='space-y-1.5 my-2 pl-5 list-decimal marker:font-bold marker:text-slate-700'>
            {currentList.items.map((item, idx) => (
              <li key={'oli-' + idx} className='text-slate-800 leading-relaxed text-xs sm:text-sm'>
                {item}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph('empty-' + lineIdx);
      flushList('empty-' + lineIdx);
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph('h3-' + lineIdx);
      flushList('h3-' + lineIdx);
      elements.push(
        <h3
          key={'h3-' + lineIdx}
          className='text-sm sm:text-base font-bold text-slate-900 tracking-tight mt-3.5 mb-1.5 flex items-center gap-1.5 first:mt-0'
        >
          {renderInline(trimmed.substring(4))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph('h2-' + lineIdx);
      flushList('h2-' + lineIdx);
      elements.push(
        <h2
          key={'h2-' + lineIdx}
          className='text-base sm:text-lg font-extrabold text-slate-900 tracking-tight mt-4 mb-2 first:mt-0'
        >
          {renderInline(trimmed.substring(3))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph('h1-' + lineIdx);
      flushList('h1-' + lineIdx);
      elements.push(
        <h1
          key={'h1-' + lineIdx}
          className='text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-4 mb-2 first:mt-0'
        >
          {renderInline(trimmed.substring(2))}
        </h1>
      );
      return;
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph('ul-before-' + lineIdx);
      if (!currentList || currentList.type !== 'ul') {
        flushList('ul-switch-' + lineIdx);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInline(ulMatch[1]));
      return;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph('ol-before-' + lineIdx);
      if (!currentList || currentList.type !== 'ol') {
        flushList('ol-switch-' + lineIdx);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInline(olMatch[2]));
      return;
    }

    flushList('p-before-' + lineIdx);
    paragraphBuffer.push(trimmed);
  });

  flushParagraph('final');
  flushList('final');

  return <div className={'space-y-1 leading-relaxed ' + className}>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  const codeParts = text.split(/([^]+)/g);
  if (codeParts.length > 1) {
    return codeParts.map((part, idx) => {
      if (part.startsWith('') && part.endsWith('') && part.length >= 2) {
        const codeContent = part.slice(1, -1);
        return (
          <code
            key={'code-' + idx}
            className='px-1.5 py-0.5 mx-0.5 rounded bg-amber-50 text-[#B45309] font-mono text-[11px] sm:text-xs font-semibold border border-amber-200/60'
          >
            {codeContent}
          </code>
        );
      }
      return <React.Fragment key={'text-' + idx}>{renderBoldAndItalic(part)}</React.Fragment>;
    });
  }

  return renderBoldAndItalic(text);
}

function renderBoldAndItalic(text: string): React.ReactNode {
  if (!text) return null;

  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  if (boldParts.length > 1) {
    return boldParts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={'b-' + idx} className='font-bold text-slate-900'>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={'t-' + idx}>{renderItalic(part)}</React.Fragment>;
    });
  }

  return renderItalic(text);
}

function renderItalic(text: string): React.ReactNode {
  if (!text) return null;

  const italicParts = text.split(/(\*[^*]+\*)/g);
  if (italicParts.length > 1) {
    return italicParts.map((part, idx) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={'i-' + idx} className='italic text-slate-700'>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  }

  return text;
}
