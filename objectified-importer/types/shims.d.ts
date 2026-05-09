/** Minimal typings so `tsc` can follow UI imports without pulling full Next types. */
declare module 'next/headers' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function cookies(): any;
}
