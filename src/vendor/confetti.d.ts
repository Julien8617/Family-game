export interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  shapes?: string[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
  useWorker?: boolean;
  resize?: boolean;
}

export interface ConfettiCannon {
  (options?: ConfettiOptions): Promise<void> | null;
  reset(): void;
}

interface ConfettiDefault extends ConfettiCannon {
  create(canvas: HTMLCanvasElement | null, globalOptions?: ConfettiOptions): ConfettiCannon;
}

declare const confetti: ConfettiDefault;

export default confetti;
export declare const create: ConfettiDefault['create'];
