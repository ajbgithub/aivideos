'use client';

import { useCallback } from "react";

export default function TermsOfServicePage() {
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <button
        type="button"
        onClick={handleBack}
        className="mb-6 inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
      >
        ← Back
      </button>
      <h1 className="text-3xl font-semibold tracking-wide">Terms of Service</h1>
      <p className="mt-4 text-sm text-white">
        Last updated on {new Date().toLocaleDateString()}
      </p>

      <section className="mt-10 space-y-8 text-sm leading-relaxed text-white">
        <article>
          <h2 className="text-lg font-semibold text-white">1. Your Content</h2>
          <p className="mt-3">
            You retain ownership of your creations. By uploading you grant Eagle AI
            Pictures permission to display, promote, and advertise your content while
            giving proper credit.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">2. Acceptable Use</h2>
          <p className="mt-3">
            You agree to share original or licensed work, credit collaborators, and
            respect the rights of others. We remove content that violates U.S. law, is harmful or in poor taste
            for our community, or infringes on third parties.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">3. Platform Changes</h2>
          <p className="mt-3">
            We may update features, run promotions, or process payments to support
            the organization and creators. These terms evolve with the product and continued use implies
            acceptance of updates.
          </p>
        </article>
      </section>
    </main>
  );
}
