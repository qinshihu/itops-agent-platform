import React from 'react';
import MarkdownIt from 'markdown-it';
import { clsx } from 'clsx';
import { sanitizeHTML } from '../../lib/xss';

interface MarkdownOutputProps {
  content: string;
  className?: string;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
});

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');
  if (hrefIndex >= 0) {
    const href = token.attrs![hrefIndex][1];
    if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:')) {
      token.attrs![hrefIndex][1] = '#';
    }
  }
  return self.renderToken(tokens, idx, options);
};

const MarkdownOutput: React.FC<MarkdownOutputProps> = ({ content, className }) => {
  const renderContent = () => {
    if (!content) return null;
    
    const html = md.render(content);
    const sanitized = sanitizeHTML(html);
    
    return (
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  };

  return (
    <div className={clsx(
      "prose prose-invert max-w-none",
      "prose-headings:text-white prose-headings:font-bold",
      "prose-p:text-gray-200 prose-p:leading-relaxed prose-p:mb-4",
      "prose-strong:text-blue-400 prose-strong:font-semibold",
      "prose-code:text-blue-400 prose-code:bg-blue-500/20 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:font-mono",
      "prose-pre:bg-gradient-to-br prose-pre:from-gray-800/80 prose-pre:to-slate-900/80 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-xl prose-pre:shadow-lg prose-pre:backdrop-blur",
      "prose-pre:overflow-x-auto",
      "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-gradient-to-r prose-blockquote:from-blue-500/10 prose-blockquote:to-transparent prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:my-4",
      "prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5",
      "prose-li:text-gray-200 prose-li:mb-2",
      "prose-table:w-full prose-table:border-collapse prose-table:my-4",
      "prose-th:bg-gray-800/80 prose-th:text-white prose-th:font-semibold",
      "prose-th:border prose-th:border-gray-700 prose-th:py-3 prose-th:px-4",
      "prose-td:text-gray-300 prose-td:border prose-td:border-gray-700 prose-td:py-3 prose-td:px-4",
      "prose-a:text-blue-400 prose-a:hover:text-blue-300 prose-a:underline prose-a:transition-colors",
      "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
      "prose-h1:mb-3 prose-h1:mb-3 prose-h3:mb-2",
      "prose-img:rounded-lg prose-img:shadow-lg",
      "prose-hr:border-gray-700 prose-hr:my-6",
      className
    )}>
      {renderContent()}
    </div>
  );
};

export default MarkdownOutput;
