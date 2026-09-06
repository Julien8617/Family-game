import type { Transport } from './transport';

// Un seul appareil : un coup envoyé est un coup reçu, sans détour.
// Point d'insertion du transport réseau en phase 3 — même interface, autre implémentation.
export function createLocalTransport(): Transport {
  const handlers = new Set<(move: unknown) => void>();

  return {
    send(move) {
      handlers.forEach((handler) => handler(move));
    },
    onMove(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
    },
  };
}
