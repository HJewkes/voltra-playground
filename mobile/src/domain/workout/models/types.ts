/**
 * Shared types for workout models.
 *
 * These are hardware-agnostic - they describe exercise movement,
 * not how any particular device reports data.
 */

export enum MovementPhase {
  IDLE = 0,
  CONCENTRIC = 1, // Lifting/pulling phase (muscle shortening)
  HOLD = 2, // Isometric hold / transition at top of rep
  ECCENTRIC = 3, // Lowering phase (muscle lengthening)
}

/**
 * Human-readable phase names for UI display.
 */
export const PhaseNames: Record<MovementPhase, string> = {
  [MovementPhase.IDLE]: 'Ready',
  [MovementPhase.CONCENTRIC]: 'Lifting',
  [MovementPhase.ECCENTRIC]: 'Lowering',
  [MovementPhase.HOLD]: 'Hold',
};
