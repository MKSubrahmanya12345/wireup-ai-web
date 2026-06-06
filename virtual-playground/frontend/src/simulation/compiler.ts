const DEFAULT_API_BASE = 'http://localhost:5000/api';
const FALLBACK_COMPILE_ENDPOINT = 'http://localhost:5001/api/compile';

const resolvePrimaryCompileEndpoint = () => {
  const apiBase = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');
  return `${apiBase}/compile`;
};

const readErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  return String(data?.error || data?.message || `Compile request failed (${response.status})`);
};

export const compileSketch = async (sketch: string, fqbn = 'arduino:avr:uno') => {
  // ??$$$ newer code: Use primary backend for compilation, falling back to 5001 only in development
  const endpoints = [
    resolvePrimaryCompileEndpoint(),
    ...(import.meta.env.DEV ? [FALLBACK_COMPILE_ENDPOINT] : [])
  ];
  let lastError = 'Compilation request failed';

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ sketch, fqbn })
      });

      if (!response.ok) {
        lastError = await readErrorMessage(response);
        continue;
      }

      const data = await response.json();
      const hex = String(data?.hex || '').trim();

      if (!hex) {
        lastError = String(data?.error || 'Compilation succeeded without firmware output');
        continue;
      }

      return hex;
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }

  throw new Error(lastError);
};
