export type SignalDisposable = () => void;

/**
 * SIGTERM / SIGINT → cancel in-flight import once. Multiple signals are ignored after the first.
 */
export function installRunnerSignals(onSignal: () => void | Promise<void>): SignalDisposable {
  let fired = false;
  const handler = () => {
    if (fired) return;
    fired = true;
    void Promise.resolve(onSignal()).catch(() => {});
  };

  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);

  return () => {
    process.off('SIGTERM', handler);
    process.off('SIGINT', handler);
  };
}
