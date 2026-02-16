'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X, ExternalLink } from 'lucide-react';

interface WhatsNewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewDialog: React.FC<WhatsNewDialogProps> = ({ isOpen, onClose }) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch('/WHATS_NEW.md')
        .then((response) => response.text())
        .then((text) => {
          setMarkdownContent(text);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading What\'s New content:', error);
          setMarkdownContent('# Error\n\nFailed to load What\'s New content.');
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            What&apos;s New
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-80px)] scroll-smooth">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400 animate-pulse">Loading…</div>
            </div>
          ) : (
            <article className="prose prose-gray dark:prose-invert prose-base max-w-none prose-headings:font-semibold prose-a:font-medium">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mt-0 mb-5 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-3">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mt-8 mb-3 text-gray-900 dark:text-white">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-900 dark:text-white">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed [&>p]:mb-0 [&>p]:inline">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900 dark:text-white">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-gray-800 dark:text-gray-200">{children}</em>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline underline-offset-2"
                    >
                      {children}
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    </a>
                  ),
                  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
                    const inline = !className?.includes('language-');
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';

                    if (inline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                        {language && (
                          <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 border-b border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {language}
                            </span>
                          </div>
                        )}
                        <pre className="bg-gray-50 dark:bg-gray-900 p-4 overflow-x-auto m-0 text-sm">
                          <code className="font-mono text-gray-800 dark:text-gray-200" {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 my-4 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 py-2 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  hr: () => (
                    <hr className="my-6 border-0 border-t border-gray-200 dark:border-gray-600" />
                  ),
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  tr: ({ children }) => (
                    <tr className="border-b border-gray-200 dark:border-gray-600 last:border-0">
                      {children}
                    </tr>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {children}
                    </td>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                      {children}
                    </tbody>
                  ),
                  img: ({ src, alt }) => (
                    <img
                      src={src}
                      alt={alt || ''}
                      className="max-w-full h-auto rounded-lg my-4 shadow-sm border border-gray-200 dark:border-gray-600"
                    />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsNewDialog;

