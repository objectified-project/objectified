'use client';

import React, { memo, useState, useCallback } from 'react';
import { NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Folder, Edit2, Trash2, X, Check, Palette } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

// Predefined group colors with name, bg, border, and text colors
export const GROUP_COLORS = [
  { name: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300', hex: '#6366f1' },
  { name: 'purple', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', hex: '#a855f7' },
  { name: 'pink', bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-300 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300', hex: '#ec4899' },
  { name: 'rose', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', hex: '#f43f5e' },
  { name: 'red', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700', text: 'text-red-700 dark:text-red-300', hex: '#ef4444' },
  { name: 'orange', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', hex: '#f97316' },
  { name: 'amber', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', hex: '#f59e0b' },
  { name: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', hex: '#eab308' },
  { name: 'lime', bg: 'bg-lime-50 dark:bg-lime-950/30', border: 'border-lime-300 dark:border-lime-700', text: 'text-lime-700 dark:text-lime-300', hex: '#84cc16' },
  { name: 'green', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300', hex: '#22c55e' },
  { name: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', hex: '#10b981' },
  { name: 'teal', bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-300 dark:border-teal-700', text: 'text-teal-700 dark:text-teal-300', hex: '#14b8a6' },
  { name: 'cyan', bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', hex: '#06b6d4' },
  { name: 'sky', bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-300 dark:border-sky-700', text: 'text-sky-700 dark:text-sky-300', hex: '#0ea5e9' },
  { name: 'blue', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', hex: '#3b82f6' },
  { name: 'gray', bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-gray-300 dark:border-gray-600', text: 'text-gray-700 dark:text-gray-300', hex: '#6b7280' },
];

export interface GroupNodeData {
  id: string;
  name: string;
  description?: string;
  color: string; // Color name from GROUP_COLORS
  nodeIds: string[]; // IDs of nodes contained in this group
  onRename?: (groupId: string, newName: string) => void;
  onDelete?: (groupId: string) => void;
  onColorChange?: (groupId: string, newColor: string) => void;
  isReadOnly?: boolean;
}

const GroupNode = memo(({ id, data, selected }: NodeProps) => {
  const groupData = data as unknown as GroupNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(groupData.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const { getNodes } = useReactFlow();

  // Get color configuration
  const colorConfig = GROUP_COLORS.find(c => c.name === groupData.color) || GROUP_COLORS[0];

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (groupData.isReadOnly) return;
    setEditName(groupData.name);
    setIsEditing(true);
  }, [groupData.name, groupData.isReadOnly]);

  const handleSaveEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim() && editName !== groupData.name) {
      groupData.onRename?.(groupData.id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, groupData]);

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(groupData.name);
    setIsEditing(false);
  }, [groupData.name]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (editName.trim() && editName !== groupData.name) {
        groupData.onRename?.(groupData.id, editName.trim());
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setEditName(groupData.name);
      setIsEditing(false);
    }
  }, [editName, groupData]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (groupData.isReadOnly) return;
    groupData.onDelete?.(groupData.id);
  }, [groupData]);

  const handleColorChange = useCallback((colorName: string) => {
    if (groupData.isReadOnly) return;
    groupData.onColorChange?.(groupData.id, colorName);
    setColorPickerOpen(false);
  }, [groupData]);

  // Count nodes in this group
  const nodeCount = groupData.nodeIds?.length || 0;

  return (
    <>
      {/* Node resizer for adjusting group size */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected && !groupData.isReadOnly}
        lineClassName="!border-indigo-400"
        handleClassName="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white !rounded"
      />

      <div
        className={`
          w-full h-full rounded-2xl border-2 border-dashed transition-all duration-200
          ${colorConfig.bg} ${colorConfig.border}
          ${selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' : ''}
        `}
        style={{ minWidth: 200, minHeight: 150 }}
      >
        {/* Group Header */}
        <div
          className={`
            absolute -top-3 left-4 px-3 py-1 rounded-lg border shadow-sm
            ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text}
            flex items-center gap-2 cursor-move
          `}
        >
          <Folder className="h-4 w-4" />

          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`
                  px-2 py-0.5 text-sm font-medium rounded border-0 outline-none
                  bg-white dark:bg-gray-800 ${colorConfig.text}
                  w-32
                `}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition-colors"
              >
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition-colors"
              >
                <X className="h-3 w-3 text-red-600 dark:text-red-400" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-sm font-semibold">{groupData.name}</span>
              <span className="text-xs opacity-70">({nodeCount})</span>
            </>
          )}

          {/* Actions (visible when selected and not editing) */}
          {selected && !isEditing && !groupData.isReadOnly && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-current/20">
              {/* Color picker */}
              <Popover.Root open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                <Popover.Trigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition-colors"
                    title="Change color"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3"
                    sideOffset={5}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {GROUP_COLORS.map((color) => (
                        <button
                          key={color.name}
                          onClick={() => handleColorChange(color.name)}
                          className={`
                            w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                            ${color.name === groupData.color ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}
                          `}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <Popover.Arrow className="fill-white dark:fill-gray-800" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              {/* Rename button */}
              <button
                onClick={handleStartEdit}
                className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition-colors"
                title="Rename group"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>

              {/* Delete button */}
              <button
                onClick={handleDelete}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-red-600 dark:text-red-400"
                title="Delete group"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Description (if any) */}
        {groupData.description && (
          <div className={`absolute bottom-2 left-4 right-4 text-xs ${colorConfig.text} opacity-70 truncate`}>
            {groupData.description}
          </div>
        )}
      </div>
    </>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;

