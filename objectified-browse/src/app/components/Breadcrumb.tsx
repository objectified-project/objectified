'use client';

import Link from 'next/link';
import { Fragment } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link
        href="/"
        className="flex items-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>
      {items.map((item, index) => (
        <Fragment key={index}>
          <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {item.href ? (
            <Link
              href={item.href}
              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 truncate max-w-[150px]"
              title={item.label}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-900 dark:text-zinc-50 font-medium truncate max-w-[200px]" title={item.label}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

