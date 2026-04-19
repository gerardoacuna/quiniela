import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { getUserStagePicks, getUserGcPicks, getUserJerseyPick } from '@/lib/queries/picks';
import { listActiveRiders } from '@/lib/queries/riders';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SignOutButton } from '@/components/sign-out-button';

export default async function MePage() {
  const { user, profile } = await requireProfile();
  const edition = await getActiveEdition();

  if (!edition) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold">Me</h1>
        <p className="text-sm text-muted-foreground">No active edition.</p>
        <SignOutButton />
      </div>
    );
  }

  const [stagePicks, gcPicks, jerseyPick, riders] = await Promise.all([
    getUserStagePicks(user.id, edition.id),
    getUserGcPicks(user.id, edition.id),
    getUserJerseyPick(user.id, edition.id),
    listActiveRiders(edition.id),
  ]);

  const riderById = new Map(riders.map((r) => [r.id, r]));

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Me</h1>

      <Card>
        <CardHeader>
          <CardTitle>{profile.display_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="text-muted-foreground">{profile.email ?? user.email}</div>
          <div className="text-muted-foreground capitalize">Role: {profile.role}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your picks — {edition.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold mb-1">Stages</h3>
            {stagePicks.length === 0 ? (
              <p className="text-muted-foreground">No stage picks yet.</p>
            ) : (
              <ul className="space-y-1">
                {stagePicks
                  .slice()
                  .sort((a, b) => {
                    // Sort by stage number, using the nested relation.
                    const an = (a as unknown as { stages: { number: number } }).stages.number;
                    const bn = (b as unknown as { stages: { number: number } }).stages.number;
                    return an - bn;
                  })
                  .map((p) => {
                    const stageNum = (p as unknown as { stages: { number: number } }).stages.number;
                    const rider = riderById.get(p.rider_id);
                    return (
                      <li key={p.id} className="flex justify-between">
                        <span>Stage {stageNum}</span>
                        <span>{rider?.name ?? p.rider_id}</span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <Separator />

          <section>
            <h3 className="font-semibold mb-1">GC top 3</h3>
            {gcPicks.length === 0 ? (
              <p className="text-muted-foreground">No GC picks.</p>
            ) : (
              <ul className="space-y-1">
                {gcPicks.map((p) => (
                  <li key={p.position} className="flex justify-between">
                    <span>{p.position}.</span>
                    <span>{riderById.get(p.rider_id)?.name ?? p.rider_id}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section>
            <h3 className="font-semibold mb-1">Points jersey</h3>
            {jerseyPick ? (
              <p>{riderById.get(jerseyPick.rider_id)?.name ?? jerseyPick.rider_id}</p>
            ) : (
              <p className="text-muted-foreground">No pick.</p>
            )}
          </section>
        </CardContent>
      </Card>

      <SignOutButton />
    </div>
  );
}
