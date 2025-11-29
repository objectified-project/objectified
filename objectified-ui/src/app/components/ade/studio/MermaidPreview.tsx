'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mermaid from 'mermaid';
import { AlertCircle } from 'lucide-react';

interface MermaidPreviewProps {
  code: string;
  projectSlug?: string;
  versionSlug?: string;
  onSvgReady?: (hasSvg: boolean) => void;
}

export interface MermaidPreviewRef {
  exportSVG: () => void;
  exportPNG: () => void;
  hasSvg: () => boolean;
}

const MermaidPreview = forwardRef<MermaidPreviewRef, MermaidPreviewProps>(
  ({ code, projectSlug = 'diagram', versionSlug = '1-0-0', onSvgReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });
  }, []);

  useEffect(() => {
    if (!code || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        setError(null);
        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
        onSvgReady?.(true);
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        setError(err.message || 'Failed to render diagram');
        setSvg('');
        onSvgReady?.(false);
      }
    };

    renderDiagram();
  }, [code, onSvgReady]);

  // Expose export functions to parent component
  useImperativeHandle(ref, () => ({
    exportSVG: handleExportSVG,
    exportPNG: handleExportPNG,
    hasSvg: () => !!svg,
  }));

  const handleExportSVG = () => {
    if (!svg) return;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectSlug}-${versionSlug}-diagram.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = async () => {
    if (!svg) return;

    try {
      // Create an image from the SVG
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Create a canvas and draw the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size with some padding
        canvas.width = img.width + 40;
        canvas.height = img.height + 40;

        if (ctx) {
          // Fill with white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the image centered with padding
          ctx.drawImage(img, 20, 20);

          // Convert to PNG and download
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = pngUrl;
              link.download = `${projectSlug}-${versionSlug}-diagram.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(pngUrl);
            }
          }, 'image/png');
        }

        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (err) {
      console.error('PNG export error:', err);
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-6 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Diagram Rendering Error
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Please check your Mermaid syntax and try again
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto p-8 flex items-center justify-center bg-white dark:bg-gray-900"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

MermaidPreview.displayName = 'MermaidPreview';

export default MermaidPreview;

