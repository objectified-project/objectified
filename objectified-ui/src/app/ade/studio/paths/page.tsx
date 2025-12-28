'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useStudio } from '../StudioContext';

export default function PathsPage() {
  const { data: session } = useSession();
  const { selectedProjectId, selectedVersionId } = useStudio();

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Show message if no project/version selected */}
      {(!selectedProjectId || !selectedVersionId) ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Background decorative elements */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-3xl opacity-60" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-full blur-3xl opacity-60" />

            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-12 md:p-16 text-center shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                No Project Selected
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Please select a project and version from the header to view API paths.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Coming Soon Content */
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Background decorative elements */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full blur-3xl opacity-60" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-full blur-3xl opacity-60" />

            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-3xl p-12 md:p-16 text-center shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 max-w-2xl">
              {/* Icon */}
              <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/30 transform hover:scale-105 transition-transform duration-300">
                <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>

              {/* Coming Soon Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-semibold mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                </span>
                Coming Soon
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                API Paths Generator
              </h1>

              {/* Description */}
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed">
                Generate complete OpenAPI path definitions for your schema. Define endpoints,
                operations, parameters, and responses based on your class definitions.
              </p>

              {/* Feature Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-600/50">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">CRUD Operations</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Auto-generate standard REST endpoints</p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-600/50">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Request Validation</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Schema-based request validation</p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-600/50">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Response Schemas</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Auto-linked response definitions</p>
                </div>
              </div>

              {/* Footer Note */}
              <p className="text-sm text-gray-500 dark:text-gray-500">
                This feature is under active development. Stay tuned!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

