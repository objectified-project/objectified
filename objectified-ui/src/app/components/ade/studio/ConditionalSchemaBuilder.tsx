'use client';

import React, { useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { GitBranch, Plus, Trash2, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export interface ConditionalRule {
  id: string;
  // IF condition
  ifCondition: {
    property: string;
    operator: 'equals' | 'const' | 'enum' | 'type' | 'required' | 'pattern' | 'minimum' | 'maximum';
    value: string;
  };
  // THEN schema (what should be required/validated when IF is true)
  thenSchema: {
    requiredProperties: string[];
    propertyConstraints: Array<{
      property: string;
      constraint: 'minLength' | 'maxLength' | 'minimum' | 'maximum' | 'pattern' | 'const' | 'enum' | 'type';
      value: string;
    }>;
  };
  // ELSE schema (optional - what should be required/validated when IF is false)
  elseSchema?: {
    requiredProperties: string[];
    propertyConstraints: Array<{
      property: string;
      constraint: 'minLength' | 'maxLength' | 'minimum' | 'maximum' | 'pattern' | 'const' | 'enum' | 'type';
      value: string;
    }>;
  };
}

interface ConditionalSchemaBuilderProps {
  rules: ConditionalRule[];
  onChange: (rules: ConditionalRule[]) => void;
  availableProperties: string[];
  disabled?: boolean;
  /** When provided, replaces the default "Conditional Schema Rules" header with custom content (e.g. section title + Add Rule on one line). */
  renderHeader?: (addRule: () => void) => React.ReactNode;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const OPERATORS = [
  { value: 'equals', label: 'equals (const)', description: 'Property must equal exact value' },
  { value: 'enum', label: 'is one of (enum)', description: 'Property value is in a set of values' },
  { value: 'type', label: 'has type', description: 'Property has specific type' },
  { value: 'required', label: 'is present', description: 'Property exists (is not undefined)' },
  { value: 'pattern', label: 'matches pattern', description: 'Property matches regex pattern' },
  { value: 'minimum', label: 'is at least', description: 'Number is >= value' },
  { value: 'maximum', label: 'is at most', description: 'Number is <= value' },
];

const CONSTRAINTS = [
  { value: 'minLength', label: 'Min Length', forTypes: ['string'] },
  { value: 'maxLength', label: 'Max Length', forTypes: ['string'] },
  { value: 'minimum', label: 'Minimum', forTypes: ['number', 'integer'] },
  { value: 'maximum', label: 'Maximum', forTypes: ['number', 'integer'] },
  { value: 'pattern', label: 'Pattern', forTypes: ['string'] },
  { value: 'const', label: 'Const', forTypes: ['string', 'number', 'integer', 'boolean'] },
  { value: 'enum', label: 'Enum', forTypes: ['string', 'number', 'integer'] },
  { value: 'type', label: 'Type', forTypes: ['any'] },
];

export const ConditionalSchemaBuilder: React.FC<ConditionalSchemaBuilderProps> = ({
  rules,
  onChange,
  availableProperties,
  disabled = false,
  renderHeader,
}) => {
  const isDark = useDarkMode();

  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const toggleExpanded = (ruleId: string) => {
    const next = new Set(expandedRules);
    if (next.has(ruleId)) {
      next.delete(ruleId);
    } else {
      next.add(ruleId);
    }
    setExpandedRules(next);
  };

  const addRule = () => {
    const newRule: ConditionalRule = {
      id: generateId(),
      ifCondition: {
        property: '',
        operator: 'equals',
        value: '',
      },
      thenSchema: {
        requiredProperties: [],
        propertyConstraints: [],
      },
    };
    const newRules = [...rules, newRule];
    onChange(newRules);
    setExpandedRules(new Set([...expandedRules, newRule.id]));
  };

  const updateRule = (ruleId: string, updates: Partial<ConditionalRule>) => {
    onChange(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  };

  const deleteRule = (ruleId: string) => {
    onChange(rules.filter(r => r.id !== ruleId));
    const next = new Set(expandedRules);
    next.delete(ruleId);
    setExpandedRules(next);
  };

  const addElseSchema = (ruleId: string) => {
    updateRule(ruleId, {
      elseSchema: {
        requiredProperties: [],
        propertyConstraints: [],
      }
    });
  };

  const removeElseSchema = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      const { elseSchema, ...rest } = rule;
      onChange(rules.map(r => r.id === ruleId ? rest as ConditionalRule : r));
    }
  };

  const addThenConstraint = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, {
        thenSchema: {
          ...rule.thenSchema,
          propertyConstraints: [
            ...rule.thenSchema.propertyConstraints,
            { property: '', constraint: 'minLength', value: '' }
          ]
        }
      });
    }
  };

  const addElseConstraint = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule && rule.elseSchema) {
      updateRule(ruleId, {
        elseSchema: {
          ...rule.elseSchema,
          propertyConstraints: [
            ...rule.elseSchema.propertyConstraints,
            { property: '', constraint: 'minLength', value: '' }
          ]
        }
      });
    }
  };

  const removeThenConstraint = (ruleId: string, index: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, {
        thenSchema: {
          ...rule.thenSchema,
          propertyConstraints: rule.thenSchema.propertyConstraints.filter((_, i) => i !== index)
        }
      });
    }
  };

  const removeElseConstraint = (ruleId: string, index: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule && rule.elseSchema) {
      updateRule(ruleId, {
        elseSchema: {
          ...rule.elseSchema,
          propertyConstraints: rule.elseSchema.propertyConstraints.filter((_, i) => i !== index)
        }
      });
    }
  };

  const renderConditionBuilder = (rule: ConditionalRule) => (
    <div className={`p-4 rounded-lg border mb-4 ${isDark ? 'bg-indigo-950/50 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${isDark ? 'bg-indigo-700' : 'bg-indigo-500'}`}>
          IF
        </span>
        <span className={`text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>Condition to check</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Property</label>
          <input
            list={`if-property-${rule.id}`}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            placeholder="Select or type property name"
            value={rule.ifCondition.property || ''}
            onChange={(e) => updateRule(rule.id, { ifCondition: { ...rule.ifCondition, property: e.target.value } })}
            disabled={disabled}
          />
          <datalist id={`if-property-${rule.id}`}>
            {availableProperties.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Operator</label>
          <select
            className="min-w-[140px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            value={rule.ifCondition.operator}
            onChange={(e) => updateRule(rule.id, { ifCondition: { ...rule.ifCondition, operator: e.target.value as any } })}
            disabled={disabled}
          >
            {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
        </div>

        {rule.ifCondition.operator !== 'required' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {rule.ifCondition.operator === 'enum' ? 'Values (comma-separated)' : 'Value'}
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
              placeholder={
                rule.ifCondition.operator === 'enum' ? 'value1, value2, value3' :
                rule.ifCondition.operator === 'type' ? 'string, number, boolean...' :
                rule.ifCondition.operator === 'pattern' ? '^[A-Z]+$' : 'value'
              }
              value={rule.ifCondition.value}
              onChange={(e) => updateRule(rule.id, { ifCondition: { ...rule.ifCondition, value: e.target.value } })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500 mt-1">{OPERATORS.find(o => o.value === rule.ifCondition.operator)?.description}</p>
          </div>
        )}
        {rule.ifCondition.operator === 'required' && (
          <div className="flex items-center text-slate-500 dark:text-slate-400 text-xs">(property exists)</div>
        )}
      </div>
    </div>
  );

  const renderSchemaBuilder = (
    rule: ConditionalRule,
    schemaType: 'then' | 'else',
    schema: ConditionalRule['thenSchema']
  ) => (
    <div
      className={`p-4 rounded-lg border mb-2 ${
        schemaType === 'then'
          ? (isDark ? 'bg-green-950/30 border-green-700' : 'bg-green-50 border-green-200')
          : (isDark ? 'bg-red-950/30 border-red-700' : 'bg-red-50 border-red-200')
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-semibold text-white ${
              schemaType === 'then' ? (isDark ? 'bg-green-700' : 'bg-green-500') : (isDark ? 'bg-red-700' : 'bg-red-500')
            }`}
          >
            {schemaType.toUpperCase()}
          </span>
          <span
            className={`text-xs ${
              schemaType === 'then' ? (isDark ? 'text-green-300' : 'text-green-700') : (isDark ? 'text-red-300' : 'text-red-700')
            }`}
          >
            {schemaType === 'then' ? 'Apply when condition is TRUE' : 'Apply when condition is FALSE'}
          </span>
        </div>
        {schemaType === 'else' && (
          <button
            type="button"
            onClick={() => removeElseSchema(rule.id)}
            disabled={disabled}
            className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Require these properties:</label>
        <div className="flex flex-wrap gap-2">
          {schema.requiredProperties.map((prop, i) => (
            <span
              key={prop}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                schemaType === 'then' ? 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-200' : 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200'
              }`}
            >
              {prop}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const next = schema.requiredProperties.filter((_, j) => j !== i);
                    if (schemaType === 'then') updateRule(rule.id, { thenSchema: { ...schema, requiredProperties: next } });
                    else updateRule(rule.id, { elseSchema: { ...schema, requiredProperties: next } });
                  }}
                  className="hover:opacity-80"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {!disabled && (
            <select
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const next = [...schema.requiredProperties, v];
                if (schemaType === 'then') updateRule(rule.id, { thenSchema: { ...schema, requiredProperties: next } });
                else updateRule(rule.id, { elseSchema: { ...schema, requiredProperties: next } });
                e.target.value = '';
              }}
            >
              <option value="">Add property...</option>
              {availableProperties.filter((p) => !schema.requiredProperties.includes(p)).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Additional constraints:</span>
          <button
            type="button"
            onClick={() => schemaType === 'then' ? addThenConstraint(rule.id) : addElseConstraint(rule.id)}
            disabled={disabled}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Constraint
          </button>
        </div>

        {schema.propertyConstraints.length === 0 ? (
          <p className="text-xs italic text-slate-500 dark:text-slate-400 text-center py-2">No additional constraints</p>
        ) : (
          <div className="space-y-2">
            {schema.propertyConstraints.map((constraint, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center p-2 rounded bg-black/10 dark:bg-white/5"
              >
                <input
                  list={`constraint-prop-${rule.id}-${schemaType}-${idx}`}
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                  placeholder="Property"
                  value={constraint.property}
                  onChange={(e) => {
                    const newConstraints = [...schema.propertyConstraints];
                    newConstraints[idx] = { ...constraint, property: e.target.value };
                    if (schemaType === 'then') updateRule(rule.id, { thenSchema: { ...schema, propertyConstraints: newConstraints } });
                    else updateRule(rule.id, { elseSchema: { ...schema, propertyConstraints: newConstraints } });
                  }}
                  disabled={disabled}
                />
                <datalist id={`constraint-prop-${rule.id}-${schemaType}-${idx}`}>
                  {availableProperties.map((p) => <option key={p} value={p} />)}
                </datalist>
                <select
                  className="min-w-[100px] px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                  value={constraint.constraint}
                  onChange={(e) => {
                    const newConstraints = [...schema.propertyConstraints];
                    newConstraints[idx] = { ...constraint, constraint: e.target.value as any };
                    if (schemaType === 'then') updateRule(rule.id, { thenSchema: { ...schema, propertyConstraints: newConstraints } });
                    else updateRule(rule.id, { elseSchema: { ...schema, propertyConstraints: newConstraints } });
                  }}
                  disabled={disabled}
                >
                  {CONSTRAINTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                  placeholder="Value"
                  value={constraint.value}
                  onChange={(e) => {
                    const newConstraints = [...schema.propertyConstraints];
                    newConstraints[idx] = { ...constraint, value: e.target.value };
                    if (schemaType === 'then') updateRule(rule.id, { thenSchema: { ...schema, propertyConstraints: newConstraints } });
                    else updateRule(rule.id, { elseSchema: { ...schema, propertyConstraints: newConstraints } });
                  }}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => schemaType === 'then' ? removeThenConstraint(rule.id, idx) : removeElseConstraint(rule.id, idx)}
                  disabled={disabled}
                  className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderRuleSummary = (rule: ConditionalRule) => {
    const code = (text: string) => (
      <code className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100 font-mono text-[11px]">
        {text}
      </code>
    );
    const phrase = (text: string, tone: 'indigo' | 'green' | 'red' = 'indigo') => (
      <span
        className={
          tone === 'green'
            ? 'font-semibold text-green-700 dark:text-green-300'
            : tone === 'red'
              ? 'font-semibold text-red-700 dark:text-red-300'
              : 'font-semibold text-indigo-700 dark:text-indigo-300'
        }
      >
        {text}
      </span>
    );

    const placeholder = <span className="italic text-slate-400 dark:text-slate-500">…</span>;

    const propNode = rule.ifCondition.property ? code(rule.ifCondition.property) : placeholder;
    const valueNode = rule.ifCondition.value ? code(rule.ifCondition.value) : placeholder;

    const ifClause: React.ReactNode = (() => {
      switch (rule.ifCondition.operator) {
        case 'equals':
        case 'const':
          return <>{propNode} {phrase('is')} {valueNode}</>;
        case 'enum':
          return <>{propNode} {phrase('is one of')} {valueNode}</>;
        case 'type':
          return <>{propNode} {phrase('has type')} {valueNode}</>;
        case 'pattern':
          return <>{propNode} {phrase('matches')} {valueNode}</>;
        case 'minimum':
          return <>{propNode} {phrase('≥')} {valueNode}</>;
        case 'maximum':
          return <>{propNode} {phrase('≤')} {valueNode}</>;
        case 'required':
          return <>{propNode} {phrase('is present')}</>;
        default:
          return <>{propNode} {phrase(rule.ifCondition.operator)} {valueNode}</>;
      }
    })();

    const formatConstraint = (
      c: { property: string; constraint: string; value: string },
      tone: 'green' | 'red',
    ): React.ReactNode => {
      const propEl = c.property ? code(c.property) : placeholder;
      const valEl = c.value ? code(c.value) : placeholder;
      switch (c.constraint) {
        case 'minLength':
          return <>{propEl} {phrase('length ≥', tone)} {valEl}</>;
        case 'maxLength':
          return <>{propEl} {phrase('length ≤', tone)} {valEl}</>;
        case 'minimum':
          return <>{propEl} {phrase('≥', tone)} {valEl}</>;
        case 'maximum':
          return <>{propEl} {phrase('≤', tone)} {valEl}</>;
        case 'pattern':
          return <>{propEl} {phrase('matches', tone)} {valEl}</>;
        case 'const':
          return <>{propEl} {phrase('is', tone)} {valEl}</>;
        case 'enum':
          return <>{propEl} {phrase('is one of', tone)} {valEl}</>;
        case 'type':
          return <>{propEl} {phrase('has type', tone)} {valEl}</>;
        default:
          return <>{propEl} {phrase(c.constraint, tone)} {valEl}</>;
      }
    };

    const buildBranch = (
      schema: ConditionalRule['thenSchema'] | undefined,
      tone: 'green' | 'red',
    ): React.ReactNode[] => {
      if (!schema) return [];
      const parts: React.ReactNode[] = [];
      if (schema.requiredProperties.length > 0) {
        const reqs = schema.requiredProperties.filter(Boolean);
        if (reqs.length > 0) {
          const list: React.ReactNode[] = [];
          reqs.forEach((p, i) => {
            if (i > 0) list.push(<span key={`sep-${i}`}>, </span>);
            list.push(<React.Fragment key={`p-${i}`}>{code(p)}</React.Fragment>);
          });
          parts.push(
            <span key="req">
              {list} {phrase(reqs.length === 1 ? 'is required' : 'are required', tone)}
            </span>,
          );
        }
      }
      schema.propertyConstraints.forEach((c, i) => {
        parts.push(<span key={`c-${i}`}>{formatConstraint(c, tone)}</span>);
      });
      return parts;
    };

    const thenParts = buildBranch(rule.thenSchema, 'green');
    const elseParts = buildBranch(rule.elseSchema, 'red');

    const joinParts = (parts: React.ReactNode[]): React.ReactNode => {
      if (parts.length === 0) return null;
      const out: React.ReactNode[] = [];
      parts.forEach((p, i) => {
        if (i > 0) out.push(<span key={`and-${i}`} className="text-slate-500"> and </span>);
        out.push(<React.Fragment key={`pp-${i}`}>{p}</React.Fragment>);
      });
      return out;
    };

    const isEmpty =
      !rule.ifCondition.property &&
      thenParts.length === 0 &&
      elseParts.length === 0;

    if (isEmpty) {
      return (
        <span className="text-[12px] italic text-slate-500 dark:text-slate-400">
          New rule — fill in the condition and outcomes below.
        </span>
      );
    }

    return (
      <span className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">When </span>
        {ifClause}
        <span className="text-slate-500 dark:text-slate-400">, then </span>
        {thenParts.length > 0 ? joinParts(thenParts) : <span className="italic text-slate-400">…no constraints</span>}
        {elseParts.length > 0 && (
          <>
            <span className="text-slate-500 dark:text-slate-400">. Otherwise, </span>
            {joinParts(elseParts)}
          </>
        )}
        <span className="text-slate-500 dark:text-slate-400">.</span>
      </span>
    );
  };

  const renderVisualFlow = (rule: ConditionalRule) => (
    <div className="py-2 px-3 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 mb-4 flex items-start gap-2 min-w-0 flex-1">
      <GitBranch size={14} className="text-indigo-500 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{renderRuleSummary(rule)}</div>
    </div>
  );

  return (
    <div>
      {renderHeader ? (
        <div className="mb-4">{renderHeader(addRule)}</div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Conditional Schema Rules</span>
            <TooltipPrimitive.Provider>
              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <span className="cursor-help text-slate-500 dark:text-slate-400 inline-flex">
                    <HelpCircle size={16} />
                  </span>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Content
                    sideOffset={5}
                    className="max-w-xs px-3 py-2 text-xs bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded shadow-lg"
                  >
                    Define if/then/else conditions for complex validation. When the &apos;if&apos; condition matches, the &apos;then&apos; schema is applied. Optionally, an &apos;else&apos; schema applies when the condition doesn&apos;t match.
                  </TooltipPrimitive.Content>
              </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>
          </div>
          <button
            type="button"
            onClick={addRule}
            disabled={disabled}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <div className={`p-6 text-center rounded-lg border-2 border-dashed ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <GitBranch size={24} className={`mx-auto mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No conditional rules defined</p>
          <p className={`text-xs mt-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Add rules to create dynamic validation based on property values
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className={`rounded-lg border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(rule.id)}
                className={`w-full flex items-start justify-between gap-2 p-3 text-left ${isDark ? 'bg-slate-900' : 'bg-slate-50'} border-b border-slate-200 dark:border-slate-700`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">
                    Rule {index + 1}
                  </span>
                  {!expandedRules.has(rule.id) && (
                    <div className="min-w-0 flex-1 pt-0.5">{renderRuleSummary(rule)}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteRule(rule.id); }}
                    disabled={disabled}
                    className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedRules.has(rule.id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {expandedRules.has(rule.id) && (
                <div className="p-4">
                  {renderVisualFlow(rule)}
                  {renderConditionBuilder(rule)}
                  {renderSchemaBuilder(rule, 'then', rule.thenSchema)}
                  {rule.elseSchema ? (
                    renderSchemaBuilder(rule, 'else', rule.elseSchema)
                  ) : (
                    <button
                      type="button"
                      onClick={() => addElseSchema(rule.id)}
                      disabled={disabled}
                      className="text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded disabled:opacity-50"
                    >
                      + Add ELSE condition
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to convert ConditionalRule[] to JSON Schema if/then/else
export const conditionalRulesToJsonSchema = (rules: ConditionalRule[]): any[] => {
  return rules.map(rule => {
    const result: any = {};

    // Build IF schema
    const ifSchema: any = { properties: {} };
    if (rule.ifCondition.property) {
      const propSchema: any = {};

      switch (rule.ifCondition.operator) {
        case 'equals':
        case 'const':
          propSchema.const = rule.ifCondition.value;
          break;
        case 'enum':
          propSchema.enum = rule.ifCondition.value.split(',').map(v => v.trim());
          break;
        case 'type':
          propSchema.type = rule.ifCondition.value;
          break;
        case 'pattern':
          propSchema.pattern = rule.ifCondition.value;
          break;
        case 'minimum':
          propSchema.minimum = parseFloat(rule.ifCondition.value);
          break;
        case 'maximum':
          propSchema.maximum = parseFloat(rule.ifCondition.value);
          break;
        case 'required':
          // For 'required', we just need the property to exist
          break;
      }

      ifSchema.properties[rule.ifCondition.property] = propSchema;

      if (rule.ifCondition.operator === 'required') {
        ifSchema.required = [rule.ifCondition.property];
      }
    }
    result.if = ifSchema;

    // Build THEN schema
    const thenSchema: any = {};
    if (rule.thenSchema.requiredProperties.length > 0) {
      thenSchema.required = rule.thenSchema.requiredProperties;
    }
    if (rule.thenSchema.propertyConstraints.length > 0) {
      thenSchema.properties = {};
      rule.thenSchema.propertyConstraints.forEach(constraint => {
        if (!thenSchema.properties[constraint.property]) {
          thenSchema.properties[constraint.property] = {};
        }
        switch (constraint.constraint) {
          case 'minLength':
            thenSchema.properties[constraint.property].minLength = parseInt(constraint.value);
            break;
          case 'maxLength':
            thenSchema.properties[constraint.property].maxLength = parseInt(constraint.value);
            break;
          case 'minimum':
            thenSchema.properties[constraint.property].minimum = parseFloat(constraint.value);
            break;
          case 'maximum':
            thenSchema.properties[constraint.property].maximum = parseFloat(constraint.value);
            break;
          case 'pattern':
            thenSchema.properties[constraint.property].pattern = constraint.value;
            break;
          case 'const':
            thenSchema.properties[constraint.property].const = constraint.value;
            break;
          case 'enum':
            thenSchema.properties[constraint.property].enum = constraint.value.split(',').map(v => v.trim());
            break;
          case 'type':
            thenSchema.properties[constraint.property].type = constraint.value;
            break;
        }
      });
    }
    result.then = thenSchema;

    // Build ELSE schema (optional)
    if (rule.elseSchema) {
      const elseSchema: any = {};
      if (rule.elseSchema.requiredProperties.length > 0) {
        elseSchema.required = rule.elseSchema.requiredProperties;
      }
      if (rule.elseSchema.propertyConstraints.length > 0) {
        elseSchema.properties = {};
        rule.elseSchema.propertyConstraints.forEach(constraint => {
          if (!elseSchema.properties[constraint.property]) {
            elseSchema.properties[constraint.property] = {};
          }
          switch (constraint.constraint) {
            case 'minLength':
              elseSchema.properties[constraint.property].minLength = parseInt(constraint.value);
              break;
            case 'maxLength':
              elseSchema.properties[constraint.property].maxLength = parseInt(constraint.value);
              break;
            case 'minimum':
              elseSchema.properties[constraint.property].minimum = parseFloat(constraint.value);
              break;
            case 'maximum':
              elseSchema.properties[constraint.property].maximum = parseFloat(constraint.value);
              break;
            case 'pattern':
              elseSchema.properties[constraint.property].pattern = constraint.value;
              break;
            case 'const':
              elseSchema.properties[constraint.property].const = constraint.value;
              break;
            case 'enum':
              elseSchema.properties[constraint.property].enum = constraint.value.split(',').map(v => v.trim());
              break;
            case 'type':
              elseSchema.properties[constraint.property].type = constraint.value;
              break;
          }
        });
      }
      result.else = elseSchema;
    }

    return result;
  }).filter(rule => rule.if && Object.keys(rule.if.properties || {}).length > 0);
};

// Helper function to parse JSON Schema if/then/else back to ConditionalRule[]
// Handles nested if/then/else by flattening them into separate rules
export const jsonSchemaToConditionalRules = (allOfArray: any[]): ConditionalRule[] => {
  if (!allOfArray || !Array.isArray(allOfArray)) return [];

  const rules: ConditionalRule[] = [];

  const parseIfThenElse = (item: any) => {
    if (!item.if) return;

    const rule: ConditionalRule = {
      id: generateId(),
      ifCondition: {
        property: '',
        operator: 'equals',
        value: '',
      },
      thenSchema: {
        requiredProperties: [],
        propertyConstraints: [],
      },
    };

    // Parse IF condition
    if (item.if?.properties) {
      const propName = Object.keys(item.if.properties)[0];
      if (propName) {
        rule.ifCondition.property = propName;
        const propSchema = item.if.properties[propName];

        if (propSchema.const !== undefined) {
          rule.ifCondition.operator = 'equals';
          rule.ifCondition.value = String(propSchema.const);
        } else if (propSchema.enum) {
          rule.ifCondition.operator = 'enum';
          rule.ifCondition.value = propSchema.enum.join(', ');
        } else if (propSchema.type) {
          rule.ifCondition.operator = 'type';
          rule.ifCondition.value = propSchema.type;
        } else if (propSchema.pattern) {
          rule.ifCondition.operator = 'pattern';
          rule.ifCondition.value = propSchema.pattern;
        } else if (propSchema.minimum !== undefined) {
          rule.ifCondition.operator = 'minimum';
          rule.ifCondition.value = String(propSchema.minimum);
        } else if (propSchema.maximum !== undefined) {
          rule.ifCondition.operator = 'maximum';
          rule.ifCondition.value = String(propSchema.maximum);
        }
      }
    }
    if (item.if?.required && item.if.required.length > 0) {
      rule.ifCondition.property = item.if.required[0];
      rule.ifCondition.operator = 'required';
      rule.ifCondition.value = '';
    }

    // Parse THEN schema
    if (item.then?.required) {
      rule.thenSchema.requiredProperties = item.then.required;
    }
    if (item.then?.properties) {
      Object.entries(item.then.properties).forEach(([prop, schema]: [string, any]) => {
        Object.entries(schema).forEach(([constraint, value]) => {
          rule.thenSchema.propertyConstraints.push({
            property: prop,
            constraint: constraint as any,
            value: Array.isArray(value) ? value.join(', ') : String(value),
          });
        });
      });
    }

    // Parse ELSE schema - check if it contains a nested if/then/else
    if (item.else) {
      if (item.else.if) {
        // Nested if/then/else - recursively parse it as a separate rule
        // Don't add an else to the current rule, just parse the nested one
        parseIfThenElse(item.else);
      } else {
        // Simple else schema - add to current rule
        rule.elseSchema = {
          requiredProperties: item.else.required || [],
          propertyConstraints: [],
        };
        if (item.else.properties) {
          Object.entries(item.else.properties).forEach(([prop, schema]: [string, any]) => {
            Object.entries(schema).forEach(([constraint, value]) => {
              rule.elseSchema!.propertyConstraints.push({
                property: prop,
                constraint: constraint as any,
                value: Array.isArray(value) ? value.join(', ') : String(value),
              });
            });
          });
        }
      }
    }

    rules.push(rule);
  };

  allOfArray
    .filter(item => item.if !== undefined)
    .forEach(item => parseIfThenElse(item));

  return rules;
};

export default ConditionalSchemaBuilder;

