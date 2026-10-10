export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="center">
      <h1>Nat&rsquo;s Inbox</h1>
      <p className="sub">Mail and calendar in one calm place, with a daily summary of what matters.</p>
      <a className="btn" href="/auth/login">Continue with Google</a>
      {error && <p className="sub" style={{ color: "var(--hot)" }}>{error}</p>}
    </main>
  );
}
