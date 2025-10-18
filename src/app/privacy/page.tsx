'use client';

import { useCallback } from "react";

export default function PrivacyPolicyPage() {
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
      <h1 className="text-3xl font-semibold tracking-wide">Privacy Policy</h1>
      <p className="mt-4 text-sm text-white">
        Last updated on {new Date().toLocaleDateString()}
      </p>

      <section className="mt-10 space-y-8 text-sm leading-relaxed text-white">
        <article>
          <h2 className="text-lg font-semibold text-white">1. Data We Collect</h2>
          <p className="mt-3">
            We collect account details you share with Google, the content you upload,
            and analytic events generated while exploring Eagle AI Pictures. This
            information is used to power personalization and community features.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">2. How We Use Your Data</h2>
          <p className="mt-3">
            We store posts, may highlight creators across our network, and analyze
            aggregated usage to improve the experience. Your uploads remain yours—we
            do not sell personal data.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-white">3. Your Choices</h2>
          <p className="mt-3">
            You can request removal of your content or account at any time by
            contacting our team. We honor takedown requests for posts you no longer
            want featured on Eagle AI Pictures.
          </p>
        </article>
      </section>
    </main>
  );
}
