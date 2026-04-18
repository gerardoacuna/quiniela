import { describe, it, expect } from 'vitest';
import { validateNoReuse, type ExistingPick } from './no-reuse';

describe('validateNoReuse', () => {
  it('allows a brand-new rider', () => {
    const existing: ExistingPick[] = [
      { stage_id: 's1', rider_id: 'pogacar', stage_status: 'published', stage_number: 5 },
    ];
    const result = validateNoReuse(existing, 's2', 'ayuso');
    expect(result.ok).toBe(true);
  });

  it('rejects picking a rider already used on another non-cancelled stage', () => {
    const existing: ExistingPick[] = [
      { stage_id: 's1', rider_id: 'pogacar', stage_status: 'upcoming', stage_number: 5 },
    ];
    const result = validateNoReuse(existing, 's2', 'pogacar');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('rider_already_used');
      expect(result.conflictingStageNumber).toBe(5);
    }
  });

  it('allows re-picking the same rider on the same stage (edit your own pick)', () => {
    const existing: ExistingPick[] = [
      { stage_id: 's1', rider_id: 'pogacar', stage_status: 'upcoming', stage_number: 3 },
    ];
    const result = validateNoReuse(existing, 's1', 'pogacar');
    expect(result.ok).toBe(true);
  });

  it('allows reusing a rider whose other pick was on a cancelled stage', () => {
    const existing: ExistingPick[] = [
      { stage_id: 's1', rider_id: 'pogacar', stage_status: 'cancelled', stage_number: 3 },
    ];
    const result = validateNoReuse(existing, 's2', 'pogacar');
    expect(result.ok).toBe(true);
  });

  it('still blocks reuse when the other stage is published (DNF does not release the rider)', () => {
    const existing: ExistingPick[] = [
      { stage_id: 's1', rider_id: 'pogacar', stage_status: 'published', stage_number: 3 },
    ];
    const result = validateNoReuse(existing, 's2', 'pogacar');
    expect(result.ok).toBe(false);
  });

  it('empty existing list always allows', () => {
    expect(validateNoReuse([], 's1', 'anyone').ok).toBe(true);
  });
});
