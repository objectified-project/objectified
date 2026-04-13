'use client';

import React from 'react';
import { useDarkMode } from '../../../../hooks/useDarkMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/Tooltip';
import { OPERATION_COLORS, PALETTE_HTTP_METHODS, type PaletteHttpMethod } from './paths-operation-colors';

const METHOD_TOOLTIPS: Record<PaletteHttpMethod, string> = {
  GET: 'Read, list, or search (GET)',
  PUT: 'Replace a resource (PUT)',
  PATCH: 'Partial update (PATCH)',
  DELETE: 'Delete a resource (DELETE)',
  OPTIONS: 'CORS / capability discovery (OPTIONS)',
};

function handleDragStart(event: React.DragEvent, method: PaletteHttpMethod) {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type: 'operation',
      operation: method,
      color: OPERATION_COLORS[method],
      label: method,
    })
  );
}

export default function PathsHttpOperationPalette() {
  const isDark = useDarkMode();

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={`flex h-full w-[5.5rem] shrink-0 flex-col border-r ${
          isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white/90'
        }`}
        aria-label="HTTP operation palette"
      >
        <div
          className={`border-b px-2 py-2.5 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <span
            className={`block text-center text-[0.625rem] font-semibold uppercase tracking-wide ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Ops
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-2">
            {PALETTE_HTTP_METHODS.map((method) => (
              <li key={method}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStart(e, method)}
                      className={`flex w-full cursor-grab items-center justify-center rounded-xl border px-1 py-2.5 text-xs font-bold shadow-md transition-[box-shadow,transform] active:cursor-grabbing ${
                        isDark
                          ? 'border-slate-600 bg-slate-800/90 text-white shadow-black/30 hover:-translate-y-px hover:shadow-lg'
                          : 'border-slate-200/90 bg-white text-slate-900 shadow-slate-300/40 hover:-translate-y-px hover:shadow-lg'
                      }`}
                      style={{
                        borderLeftWidth: 4,
                        borderLeftColor: OPERATION_COLORS[method],
                      }}
                    >
                      {method}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[14rem] text-xs">
                    {METHOD_TOOLTIPS[method]}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
        <p
          className={`border-t px-2 py-2 text-center text-[0.5625rem] leading-snug ${
            isDark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}
        >
          Drag to canvas
          <span className="sr-only">. Touch devices: palette drag may be unsupported in this MVP.</span>
        </p>
      </aside>
    </TooltipProvider>
  );
}
