import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTestUser } from './helpers';

const EDITION = '00000000-0000-4000-8000-000000000001';
const R_POG = '20000000-0000-4000-8000-000000000001';
const R_AYU = '20000000-0000-4000-8000-000000000002';

const RUN = process.env.SUPABASE_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('leaderboard_view jersey scoring', () => {
  let player: Awaited<ReturnType<typeof createTestUser>>;
  let a: ReturnType<typeof createAdminClient>;

  beforeAll(async () => {
    player = await createTestUser('player');
    a = createAdminClient();
    await a.from('jersey_picks').delete().eq('user_id', player.userId);
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
  });

  afterAll(async () => {
    await a.from('jersey_picks').delete().eq('user_id', player.userId);
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
    await player.cleanup();
  });

  it('awards 100 pts when both jersey picks match published winners', async () => {
    await a.from('jersey_picks').insert([
      { user_id: player.userId, edition_id: EDITION, kind: 'points', rider_id: R_POG },
      { user_id: player.userId, edition_id: EDITION, kind: 'white',  rider_id: R_AYU },
    ]);
    await a.from('final_classifications').insert([
      { edition_id: EDITION, kind: 'points_jersey', position: 1, rider_id: R_POG, status: 'published' },
      { edition_id: EDITION, kind: 'white_jersey',  position: 1, rider_id: R_AYU, status: 'published' },
    ]);
    const { data } = await a.from('leaderboard_view').select('jersey_points').eq('user_id', player.userId);
    expect(data?.[0]?.jersey_points).toBe(100);
  });

  it('awards 50 pts when only one jersey matches', async () => {
    await a.from('jersey_picks').delete().eq('user_id', player.userId);
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
    await a.from('jersey_picks').insert([
      { user_id: player.userId, edition_id: EDITION, kind: 'points', rider_id: R_POG },
      { user_id: player.userId, edition_id: EDITION, kind: 'white',  rider_id: R_POG }, // wrong on purpose
    ]);
    await a.from('final_classifications').insert([
      { edition_id: EDITION, kind: 'points_jersey', position: 1, rider_id: R_POG, status: 'published' },
      { edition_id: EDITION, kind: 'white_jersey',  position: 1, rider_id: R_AYU, status: 'published' },
    ]);
    const { data } = await a.from('leaderboard_view').select('jersey_points').eq('user_id', player.userId);
    expect(data?.[0]?.jersey_points).toBe(50);
  });

  it('awards 0 pts when neither matches', async () => {
    await a.from('jersey_picks').delete().eq('user_id', player.userId);
    await a.from('final_classifications').delete().eq('edition_id', EDITION);
    await a.from('jersey_picks').insert([
      { user_id: player.userId, edition_id: EDITION, kind: 'points', rider_id: R_AYU },
      { user_id: player.userId, edition_id: EDITION, kind: 'white',  rider_id: R_POG },
    ]);
    await a.from('final_classifications').insert([
      { edition_id: EDITION, kind: 'points_jersey', position: 1, rider_id: R_POG, status: 'published' },
      { edition_id: EDITION, kind: 'white_jersey',  position: 1, rider_id: R_AYU, status: 'published' },
    ]);
    const { data } = await a.from('leaderboard_view').select('jersey_points').eq('user_id', player.userId);
    expect(data?.[0]?.jersey_points).toBe(0);
  });
});
