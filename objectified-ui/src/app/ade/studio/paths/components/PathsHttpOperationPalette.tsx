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

type ParamPaletteLocation = 'header' | 'cookie';

const PARAM_CHIPS: { inLocation: ParamPaletteLocation; suggestedName: string; title: string; hint: string }[] = [
  {
    inLocation: 'header',
    suggestedName: 'Authorization',
    title: 'Header',
    hint: 'in: header — e.g. Authorization, X-Request-ID. Drop onto an operation.',
  },
  {
    inLocation: 'cookie',
    suggestedName: 'session',
    title: 'Cookie',
    hint: 'in: cookie — e.g. session. Drop onto an operation. Browser cookie rules may differ from export.',
  },
];

function handleOperationDragStart(event: React.DragEvent, method: PaletteHttpMethod) {
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

function handleParameterDragStart(
  event: React.DragEvent,
  inLocation: ParamPaletteLocation,
  suggestedName: string
) {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type: 'parameter',
      inLocation,
      suggestedName,
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
        aria-label="HTTP operation and parameter palette"
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
                      onDragStart={(e) => handleOperationDragStart(e, method)}
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

        <div
          className={`border-t border-b px-2 py-2 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <span
            className={`block text-center text-[0.625rem] font-semibold uppercase tracking-wide ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Params
          </span>
        </div>
        <div className="px-2 py-3">
          <ul className="flex flex-col gap-2">
            {PARAM_CHIPS.map((chip) => (
              <li key={chip.inLocation}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) =>
                        handleParameterDragStart(e, chip.inLocation, chip.suggestedName)
                      }
                      className={`flex w-full cursor-grab flex-col items-stretch rounded-lg border px-1.5 py-2 text-left text-[0.625rem] font-medium shadow-sm transition-[box-shadow,transform] active:cursor-grabbing ${
                        chip.inLocation === 'header'
                          ? isDark
                            ? 'border-purple-500/50 bg-purple-950/40 text-purple-100 shadow-black/20 hover:-translate-y-px hover:shadow-md'
                            : 'border-purple-300 bg-purple-50 text-purple-900 shadow-purple-200/30 hover:-translate-y-px hover:shadow-md'
                          : isDark
                            ? 'border-orange-500/50 bg-orange-950/35 text-orange-100 shadow-black/20 hover:-translate-y-px hover:shadow-md'
                            : 'border-orange-300 bg-orange-50 text-orange-900 shadow-orange-200/30 hover:-translate-y-px hover:shadow-md'
                      }`}
                    >
                      <span className="font-mono text-[0.5625rem] uppercase tracking-wide opacity-80">
                        in:{chip.inLocation}
                      </span>
                      <span className="truncate font-mono text-[0.6875rem] leading-tight">{chip.suggestedName}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[14rem] text-xs">
                    {chip.hint}
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
