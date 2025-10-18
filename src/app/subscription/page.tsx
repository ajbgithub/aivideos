'use client';

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LoadState = "loading" | "loaded" | "unauthenticated" | "error";

export default function SubscriptionPage() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error || !data.user?.email) {
          setStatus("unauthenticated");
          return;
        }

        setUserEmail(data.user.email);
        setAccountCreatedAt(data.user.created_at ?? new Date().toISOString());
        setUserId(data.user.id ?? null);
        setStatus("loaded");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleJoinWaitlist = useCallback(async () => {
    if (!userEmail) {
      setErrorMessage("Sign in to join the waitlist.");
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from("subscription_waitlist")
        .upsert(
          {
            user_email: userEmail,
            user_id: userId,
          },
          { onConflict: "user_email" }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage("Thank you, we have you down!");
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error
          ? unknownError.message
          : "We couldn't add you to the waitlist right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [userEmail, userId]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-white">
        <p className="text-sm text-white/80">Loading subscription details…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-white">
        <h1 className="text-3xl font-semibold tracking-wide">Subscription</h1>
        <p className="mt-4 text-sm text-white/80">
          Sign in to manage your subscription preferences and join the premium
          waitlist.
        </p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-white">
        <h1 className="text-3xl font-semibold tracking-wide">Subscription</h1>
        <p className="mt-4 text-sm text-white/80">
          We couldn&apos;t load your subscription details. Please refresh the page.
        </p>
      </main>
    );
  }

  const createdDateDisplay = accountCreatedAt
    ? new Date(accountCreatedAt).toLocaleDateString()
    : "today";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <h1 className="text-3xl font-semibold tracking-wide">Subscription</h1>
      <p className="mt-4 text-sm text-white">
        You are currently enjoying our free tier as of {createdDateDisplay}.
      </p>

      <section className="mt-10 space-y-5 text-sm leading-relaxed text-white">
        <p>
          Do you want to become a premium subscriber for{" "}
          <span className="font-semibold">$4.99</span> a month and access the site&apos;s
          best original content?
        </p>
        <p>Join our waitlist by clicking below!</p>
      </section>

      {successMessage ? (
        <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleJoinWaitlist}
        className="mt-8 inline-flex items-center rounded-full bg-blue-500 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-blue-500"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Submitting…" : "Join the Premium Waitlist"}
      </button>
    </main>
  );
}
