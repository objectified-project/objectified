'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X } from 'lucide-react';

interface WhatsNewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewDialog: React.FC<WhatsNewDialogProps> = ({ isOpen, onClose }) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Fetch the markdown content
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
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            What's New
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-900 dark:text-white" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-xl font-semibold mt-4 mb-2 text-gray-900 dark:text-white" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="ml-4 text-gray-700 dark:text-gray-300" {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code
                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm font-mono"
                        {...props}
                      />
                    ) : (
                      <code
                        className="block px-4 py-3 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded text-sm font-mono overflow-x-auto"
                        {...props}
                      />
                    ),
                  pre: ({ node, ...props }) => (
                    <pre className="mb-4 overflow-x-auto" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-4"
                      {...props}
                    />
                  ),
                  hr: ({ node, ...props }) => (
                    <hr className="my-6 border-gray-300 dark:border-gray-600" {...props} />
                  ),
                  img: ({ node, ...props }) => (
                    <img
                      className="max-w-full h-auto rounded-lg my-4"
                      {...props}
                    />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsNewDialog;

