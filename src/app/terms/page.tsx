export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <h1 className="text-3xl font-semibold tracking-wide">Terms of Service</h1>
      <p className="mt-4 text-sm text-neutral-400">
        Last updated on {new Date().toLocaleDateString()}
      </p>

      <section className="mt-10 space-y-8 text-sm leading-relaxed text-neutral-300">
        <article>
          <h2 className="text-lg font-semibold text-white">1. Your Content</h2>
          <p className="mt-3">
            You retain ownership of your creations. By uploading you grant AI Home
            Studios permission to display, promote, and advertise your content while
            giving proper credit.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">2. Acceptable Use</h2>
          <p className="mt-3">
            You agree to share original or licensed work, credit collaborators, and
            respect the rights of others. We remove content that violates law, harms
            our community, or infringes on third parties.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">3. Platform Changes</h2>
          <p className="mt-3">
            We may update features, run promotions, or process payments to support
            creators. These terms evolve with the product and continued use implies
            acceptance of updates.
          </p>
        </article>
      </section>
    </main>
  );
}
