export interface Transport {
  send(move: unknown): void;
  onMove(handler: (move: unknown) => void): () => void;
  close(): void;
}
