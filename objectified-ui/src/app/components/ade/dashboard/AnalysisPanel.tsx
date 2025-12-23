'use client';

import { CheckCircle2, AlertCircle, XCircle, FileCode } from 'lucide-react';
import * as Progress from '@radix-ui/react-progress';
import { AnalysisResult } from '../../../utils/openapi-analyzer';

interface AnalysisPanelProps {
  fileName: string;
  analysis: AnalysisResult;
}

export function AnalysisPanel({ fileName, analysis }: AnalysisPanelProps) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 dark:text-green-400';
      case 'B': return 'text-blue-600 dark:text-blue-400';
      case 'C': return 'text-yellow-600 dark:text-yellow-400';
      case 'D': return 'text-orange-600 dark:text-orange-400';
      case 'F': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'A': return 'Excellent Quality';
      case 'B': return 'Good Quality';
      case 'C': return 'Fair Quality';
      case 'D': return 'Poor Quality';
      case 'F': return 'Needs Improvement';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* File Name */}
      <div className="flex items-center gap-2 text-gray-900 dark:text-white">
        <FileCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <span className="font-semibold">{fileName}</span>
      </div>

      {/* Specification Information */}
      {analysis.document?.info && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Specification Information
          </h3>
          <div className="space-y-3">
            {analysis.document.info.title && (
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </span>
                <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {analysis.document.info.title}
                </div>
              </div>
            )}

            {analysis.document.info.version && (
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </span>
                <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {analysis.document.info.version}
                </div>
              </div>
            )}

            {analysis.document.info.description && (
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </span>
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                  {analysis.document.info.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              {analysis.document.info.contact && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </span>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {analysis.document.info.contact.name && (
                      <div>{analysis.document.info.contact.name}</div>
                    )}
                    {analysis.document.info.contact.email && (
                      <div className="text-indigo-600 dark:text-indigo-400">
                        {analysis.document.info.contact.email}
                      </div>
                    )}
                    {analysis.document.info.contact.url && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {analysis.document.info.contact.url}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {analysis.document.info.license && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    License
                  </span>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {analysis.document.info.license.name}
                    {analysis.document.info.license.url && (
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 truncate">
                        {analysis.document.info.license.url}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {analysis.document.info.termsOfService && (
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Terms of Service
                </span>
                <div className="text-sm text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                  {analysis.document.info.termsOfService}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Format Detection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Format Detection
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Format:</span>
            <div className="flex items-center gap-2">
              {analysis.isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {analysis.format === 'openapi' && `OpenAPI ${analysis.version}`}
                {analysis.format === 'swagger' && `Swagger ${analysis.version}`}
                {analysis.format === 'jsonschema' && `JSON Schema`}
                {analysis.format === 'unknown' && 'Unknown Format'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Syntax:</span>
            <div className="flex items-center gap-2">
              {analysis.syntaxValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Valid {analysis.syntax.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Schema:</span>
            <div className="flex items-center gap-2">
              {analysis.schemaValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {analysis.schemaValid
                  ? `Valid against ${analysis.format.toUpperCase()} meta-schema`
                  : 'Schema validation failed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Specification Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Specification Analysis
        </h3>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-4 text-center border border-indigo-200 dark:border-indigo-800">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {analysis.metrics.schemaCount}
            </div>
            <div className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 font-medium">
              Schemas
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-800">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {analysis.metrics.propertyCount}
            </div>
            <div className="text-xs text-purple-700 dark:text-purple-300 mt-1 font-medium">
              Properties
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 text-center border border-blue-200 dark:border-blue-800">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {analysis.metrics.referenceCount}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 font-medium">
              References
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-lg p-4 text-center border border-teal-200 dark:border-teal-800">
            <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              {analysis.metrics.pathCount}
            </div>
            <div className="text-xs text-teal-700 dark:text-teal-300 mt-1 font-medium">
              Paths
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">External References:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {analysis.metrics.externalReferences.length > 0
                ? `${analysis.metrics.externalReferences.length} URLs detected`
                : 'None'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Circular References:</span>
            <div className="flex items-center gap-2">
              {analysis.metrics.circularReferences.length === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-gray-900 dark:text-white">None detected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {analysis.metrics.circularReferences.length} detected
                  </span>
                </>
              )}
            </div>
          </div>
          {analysis.metrics.customExtensions.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Custom Extensions:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {analysis.metrics.customExtensions.slice(0, 3).join(', ')}
                {analysis.metrics.customExtensions.length > 3 && ` +${analysis.metrics.customExtensions.length - 3} more`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quality Score */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quality Score
        </h3>

        {/* Overall Grade */}
        <div className="flex items-center justify-between mb-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className={`text-6xl font-bold ${getGradeColor(analysis.qualityScore.grade)}`}>
              {analysis.qualityScore.grade}
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {getGradeLabel(analysis.qualityScore.grade)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Based on specification analysis
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {analysis.qualityScore.overall}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              / 100
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="space-y-4">
          {/* Completeness */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Completeness
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analysis.qualityScore.completeness}%
              </span>
            </div>
            <Progress.Root
              className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              value={analysis.qualityScore.completeness}
            >
              <Progress.Indicator
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-transform duration-300"
                style={{ transform: `translateX(-${100 - analysis.qualityScore.completeness}%)` }}
              />
            </Progress.Root>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Descriptions and documentation
            </div>
          </div>

          {/* Consistency */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Consistency
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analysis.qualityScore.consistency}%
              </span>
            </div>
            <Progress.Root
              className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              value={analysis.qualityScore.consistency}
            >
              <Progress.Indicator
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-transform duration-300"
                style={{ transform: `translateX(-${100 - analysis.qualityScore.consistency}%)` }}
              />
            </Progress.Root>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Naming conventions and patterns
            </div>
          </div>

          {/* Best Practices */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Best Practices
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analysis.qualityScore.bestPractices}%
              </span>
            </div>
            <Progress.Root
              className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              value={analysis.qualityScore.bestPractices}
            >
              <Progress.Indicator
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-transform duration-300"
                style={{ transform: `translateX(-${100 - analysis.qualityScore.bestPractices}%)` }}
              />
            </Progress.Root>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Industry standards adherence
            </div>
          </div>

          {/* Security */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Security
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {analysis.qualityScore.security}%
              </span>
            </div>
            <Progress.Root
              className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              value={analysis.qualityScore.security}
            >
              <Progress.Indicator
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-transform duration-300"
                style={{ transform: `translateX(-${100 - analysis.qualityScore.security}%)` }}
              />
            </Progress.Root>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Authentication and authorization
            </div>
          </div>
        </div>
      </div>

      {/* Errors */}
      {analysis.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800 p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Errors ({analysis.errors.length})
          </h3>
          <div className="space-y-2">
            {analysis.errors.map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-red-900 dark:text-red-200 font-medium">{error.message}</div>
                  {error.path && (
                    <div className="text-red-700 dark:text-red-400 text-xs mt-1">
                      Path: {error.path}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-200 dark:border-yellow-800 p-6">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Warnings ({analysis.warnings.length})
          </h3>
          <div className="space-y-2">
            {analysis.warnings.slice(0, 5).map((warning, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-900 dark:text-yellow-200">{warning.message}</div>
              </div>
            ))}
            {analysis.warnings.length > 5 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 italic">
                + {analysis.warnings.length - 5} more warnings
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

