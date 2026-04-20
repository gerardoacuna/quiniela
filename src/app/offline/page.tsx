export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          Reconnect to check the leaderboard or submit a pick. Picks aren&apos;t available offline.
        </p>
      </div>
    </main>
  );
}
