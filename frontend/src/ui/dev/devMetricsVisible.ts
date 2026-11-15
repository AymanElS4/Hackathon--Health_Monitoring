/**
 * Whether the dev metrics overlay and the 3D fps meter are on (T095). On in the Vite dev server
 * (`isDev`, from `import.meta.env.DEV`) and, in any build, with `?dev=metrics`. The demo URL without
 * that parameter shows neither.
 */
export function devMetricsVisible(search: string, isDev: boolean): boolean {
  if (isDev) return true;
  return new URLSearchParams(search).getAll('dev').includes('metrics');
}
