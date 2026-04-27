'use client';

import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { PropertySuggestion } from './propertySuggestions';

interface SuggestionCardProps {
  suggestion: PropertySuggestion;
  onSelect: (sectionId: string) => void;
}

/**
 * Compact "next best action" card rendered at the bottom of the section nav.
 * Stays out of the user's way until they have triaged real errors.
 */
export const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(suggestion.section)}
    className="group w-full text-left rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-3 py-2.5 transition-shadow hover:shadow-sm dark:border-violet-900/60 dark:from-violet-950/40 dark:to-slate-900"
  >
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/15 text-violet-600 dark:text-violet-300">
        <Lightbulb className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.1em] font-semibold text-violet-600 dark:text-violet-300">
          Suggestion
        </div>
        <div className="mt-0.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
          {suggestion.title}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          {suggestion.description}
        </p>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-300 group-hover:gap-1.5 transition-all">
          {suggestion.cta ?? 'Jump to section'}
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  </button>
);

export default SuggestionCard;
