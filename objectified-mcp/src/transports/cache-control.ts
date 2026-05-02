import type { ServerResponse } from 'node:http';

/** Ensures Cache-Control: no-store on every outbound HTTP response (MCP-1.2). */
export function attachCacheControlNoStore(res: ServerResponse): void {
  const ensure = (): void => {
    if (!res.headersSent) {
      res.setHeader('Cache-Control', 'no-store');
    }
  };

  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<ServerResponse['writeHead']>) => {
    ensure();
    return origWriteHead(...args);
  }) as ServerResponse['writeHead'];

  const origEnd = res.end.bind(res);
  res.end = ((...args: Parameters<ServerResponse['end']>) => {
    ensure();
    return origEnd(...args);
  }) as ServerResponse['end'];
}
