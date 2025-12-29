'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';

interface LibraryItem {
  id: string;
  label: string;
  type: string;
  color?: string;
  icon?: React.ReactNode;
}

const HTTP_METHODS = [
  { id: 'get', label: 'GET', type: 'method', color: 'bg-green-500' },
  { id: 'post', label: 'POST', type: 'method', color: 'bg-blue-500' },
  { id: 'put', label: 'PUT', type: 'method', color: 'bg-orange-500' },
  { id: 'delete', label: 'DELETE', type: 'method', color: 'bg-red-500' },
  { id: 'patch', label: 'PATCH', type: 'method', color: 'bg-purple-500' },
  { id: 'head', label: 'HEAD', type: 'method', color: 'bg-gray-500' },
  { id: 'options', label: 'OPTIONS', type: 'method', color: 'bg-gray-500' },
];

const RESPONSE_CODES = [
  { id: '200', label: '200', type: 'response', color: 'bg-green-500' },
  { id: '201', label: '201', type: 'response', color: 'bg-green-500' },
  { id: '400', label: '400', type: 'response', color: 'bg-yellow-500' },
  { id: '401', label: '401', type: 'response', color: 'bg-yellow-500' },
  { id: '404', label: '404', type: 'response', color: 'bg-orange-500' },
  { id: '500', label: '500', type: 'response', color: 'bg-red-500' },
];

export default function LibraryPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['paths', 'methods', 'schemas', 'parameters', 'responses'])
  );

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const onDragStart = (event: React.DragEvent, item: LibraryItem) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', JSON.stringify(item));
  };

  return (
    <div className="w-[280px] shrink-0 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-20 relative">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Paths Section */}
        <Collapsible.Root
          open={openSections.has('paths')}
          onOpenChange={() => toggleSection('paths')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Paths
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('paths') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2">
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'new-path', label: 'New Path', type: 'path' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors cursor-move"
            >
              <Plus className="h-4 w-4" />
              New Path
            </button>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* HTTP Methods Section */}
        <Collapsible.Root
          open={openSections.has('methods')}
          onOpenChange={() => toggleSection('methods')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              HTTP Methods
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('methods') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {HTTP_METHODS.map((method) => (
                <button
                  key={method.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, method)}
                  className={`${method.color} text-white px-3 py-2 rounded-md text-xs font-bold hover:opacity-90 transition-opacity cursor-move shadow-sm`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Schemas Section */}
        <Collapsible.Root
          open={openSections.has('schemas')}
          onOpenChange={() => toggleSection('schemas')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Schemas
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('schemas') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2">
            <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
              <div className="py-2 px-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                No schemas yet
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Parameters Section */}
        <Collapsible.Root
          open={openSections.has('parameters')}
          onOpenChange={() => toggleSection('parameters')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Parameters
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('parameters') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2 space-y-2">
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'query-param', label: 'Query Param', type: 'parameter' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-indigo-500">?</span>
              Query Param
            </button>
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'header-param', label: 'Header Param', type: 'parameter' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-blue-500">H</span>
              Header Param
            </button>
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'cookie-param', label: 'Cookie Param', type: 'parameter' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-orange-500">🍪</span>
              Cookie Param
            </button>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Responses Section */}
        <Collapsible.Root
          open={openSections.has('responses')}
          onOpenChange={() => toggleSection('responses')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Responses
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('responses') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {RESPONSE_CODES.map((code) => (
                <button
                  key={code.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, code)}
                  className={`${code.color} text-white px-3 py-2 rounded-md text-xs font-bold hover:opacity-90 transition-opacity cursor-move shadow-sm`}
                >
                  {code.label}
                </button>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Security Section */}
        <Collapsible.Root
          open={openSections.has('security')}
          onOpenChange={() => toggleSection('security')}
        >
          <Collapsible.Trigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Security
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform ${
                openSections.has('security') ? 'rotate-180' : ''
              }`}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-3 py-2 space-y-2">
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'bearer-token', label: 'Bearer Token', type: 'security' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-green-500">🔐</span>
              Bearer Token
            </button>
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'api-key', label: 'API Key', type: 'security' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-blue-500">🔑</span>
              API Key
            </button>
            <button
              draggable
              onDragStart={(e) => onDragStart(e, { id: 'oauth2', label: 'OAuth2', type: 'security' })}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-move"
            >
              <span className="text-purple-500">🔒</span>
              OAuth2
            </button>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    </div>
  );
}

