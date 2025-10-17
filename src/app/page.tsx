"use client";

import {
  CATEGORY_OPTIONS,
  INITIAL_VIDEOS,
  type StoredVideo,
  type VideoSource,
} from "@/data/initialVideos";
import { supabase } from "@/lib/supabaseClient";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type User = {
  name: string;
  email: string;
};

type Video = StoredVideo;

type UploadPayload = {
  title: string;
  description: string;
  videoLink: string;
  videoFile: File | null;
  categories: string[];
  fullName: string;
};

const CATEGORIES = ["All", ...CATEGORY_OPTIONS];
const DEFAULT_UPLOAD_CATEGORIES: string[] = [CATEGORY_OPTIONS[0]];
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

const initialVideos: Video[] = INITIAL_VIDEOS.map((video) => ({ ...video }));

const ADMIN_EMAIL = "mbamoveteam@gmail.com";

export default function Home() {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [authPromptContext, setAuthPromptContext] =
    useState<"upload" | "profile">("upload");
  const [authError, setAuthError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const objectUrls = useRef<Set<string>>(new Set());
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialisedSelection = useRef(false);

  useEffect(() => {
    const urls = objectUrls.current;

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const params = currentUrl.searchParams;
    const urlAction = params.get("authAction");

    if (urlAction) {
      window.sessionStorage.setItem("authAction", urlAction);
      params.delete("authAction");
    }

    const hasCode = params.has("code");
    const hasState = params.has("state");

    if (hasCode) {
      params.delete("code");
    }
    if (hasState) {
      params.delete("state");
    }

    if (urlAction || hasCode || hasState) {
      currentUrl.search = params.toString();
      window.history.replaceState({}, "", currentUrl.toString());
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncUserFromSession = (authUser: SupabaseAuthUser | null) => {
      if (!isMounted) {
        return;
      }

      if (authUser) {
        const mappedUser = mapSupabaseUser(authUser);

        if (mappedUser) {
          setUser(mappedUser);
          setAuthPrompt(false);
          setAuthError(null);

          if (typeof window !== "undefined") {
            const storedAction = window.sessionStorage.getItem("authAction");

            if (storedAction === "upload") {
              setShowUploadForm(true);
              window.sessionStorage.removeItem("authAction");
            }
          }
        }
      } else {
        setUser(null);
      }
    };

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          return;
        }

        syncUserFromSession(data.user ?? null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        syncUserFromSession(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || hasInitialisedSelection.current) {
      return;
    }

    if (!videos.length) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const videoId = params.get("video");

    if (videoId) {
      const matchingVideo = videos.find((video) => video.id === videoId);

      if (matchingVideo) {
        setSelectedVideo(matchingVideo);
      }
    }

    hasInitialisedSelection.current = true;
  }, [videos]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasInitialisedSelection.current && !selectedVideo) {
      return;
    }

    const url = new URL(window.location.toString());

    if (selectedVideo) {
      url.searchParams.set("video", selectedVideo.id);
    } else {
      url.searchParams.delete("video");
    }

    window.history.replaceState({}, "", url.toString());
  }, [selectedVideo]);

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleGoogleSignIn = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    setAuthError(null);

    const action =
      authPromptContext === "upload" ? ("upload" as const) : null;

    if (action) {
      window.sessionStorage.setItem("authAction", action);
    } else {
      window.sessionStorage.removeItem("authAction");
    }

    const redirectUrl = new URL(window.location.origin);

    if (action) {
      redirectUrl.searchParams.set("authAction", action);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (data?.url) {
      setAuthPrompt(false);
      window.location.assign(data.url);
    }
  }, [authPromptContext]);

  const handleGoogleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("authAction");
    }

    setUser(null);
    setSelectedVideo(null);
    setShowUploadForm(false);
  }, []);

  const handleUploadClick = useCallback(() => {
    if (isAuthenticated && user) {
      setShowUploadForm(true);
      return;
    }

    setAuthError(null);
    setAuthPromptContext("upload");
    setAuthPrompt(true);
  }, [isAuthenticated, user]);

  const handleProfileClick = useCallback(() => {
    if (isAuthenticated && user) {
      return;
    }

    setAuthError(null);
    setAuthPromptContext("profile");
    setAuthPrompt(true);
  }, [isAuthenticated, user]);

  const handleDismissPrompt = useCallback(() => {
    setAuthPrompt(false);
    setAuthError(null);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("authAction");
    }
  }, []);

  const showShareNotice = useCallback((message: string) => {
    setShareNotice(message);

    if (shareTimeoutRef.current) {
      clearTimeout(shareTimeoutRef.current);
    }

    shareTimeoutRef.current = setTimeout(() => {
      setShareNotice(null);
      shareTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleShareVideo = useCallback(
    async (video: Video) => {
      if (typeof window === "undefined") {
        return;
      }

      const baseUrl = window.location.origin;
      const useRuntimeModal =
        video.source === "file" || video.url.startsWith("blob:");
      const shareUrl = useRuntimeModal
        ? `${baseUrl}${window.location.pathname}?video=${encodeURIComponent(video.id)}`
        : `${baseUrl}/video/${encodeURIComponent(video.id)}`;
      const clipboardText = `Hey, check out this video on aihomestudios! ${shareUrl}`;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(clipboardText);
          showShareNotice("Share link copied!");
        } else {
          throw new Error("Clipboard API unavailable");
        }
      } catch {
        window.prompt("Copy this link and share it:", clipboardText);
      }
    },
    [showShareNotice]
  );

  const handleUploadSubmit = useCallback(
    (payload: UploadPayload) => {
      if (!user || (!payload.videoFile && !payload.videoLink)) {
        return;
      }

      const nextVideos = [...videos];
      const now = new Date().toISOString();
      const trimmedFullName = payload.fullName.trim();
      const displayName = trimmedFullName || user.name;

      if (payload.videoFile) {
        const objectUrl = URL.createObjectURL(payload.videoFile);
        objectUrls.current.add(objectUrl);

        nextVideos.unshift({
          id: `upload-${Date.now()}`,
          title: payload.title || undefined,
          description: payload.description || undefined,
          url: objectUrl,
          source: "file",
          uploader: {
            name: displayName,
            email: user.email,
          },
          createdAt: now,
          viewCount: 0,
          isTopRated: false,
          categories: [...payload.categories],
          fullName: trimmedFullName || undefined,
        });
      } else if (payload.videoLink) {
        const { url, source } = normaliseLink(payload.videoLink);

        nextVideos.unshift({
          id: `link-${Date.now()}`,
          title: payload.title || undefined,
          description: payload.description || undefined,
          url,
          source,
          uploader: {
            name: displayName,
            email: user.email,
          },
          createdAt: now,
          viewCount: 0,
          isTopRated: false,
          categories: [...payload.categories],
          fullName: trimmedFullName || undefined,
        });
      }

      setVideos(nextVideos);
      setShowUploadForm(false);
    },
    [user, videos]
  );

  const regularVideos = useMemo(
    () => videos.filter((video) => !video.isTopRated),
    [videos]
  );
  const videosToDisplay = useMemo(() => {
    if (selectedCategory === "All") {
      return regularVideos;
    }

    return regularVideos.filter((video) => video.categories.includes(selectedCategory));
  }, [regularVideos, selectedCategory]);
  const topRatedVideos = useMemo(
    () => videos.filter((video) => video.isTopRated),
    [videos]
  );
  const promptCopy = useMemo(() => {
    if (authPromptContext === "profile") {
      return {
        title: "Create your account",
        description:
          "Create an account with us through Google Sign On to upload videos, access premium features, and curate your feed.",
        confirmLabel: "Continue with Google",
      };
    }

    return {
      title: "Upload with Google",
      description:
        "Create an account with us through Google Sign On to upload videos and share your latest work with the community.",
      confirmLabel: "Continue with Google",
    };
  }, [authPromptContext]);

  const handleToggleTopRated = useCallback((videoId: string) => {
    setVideos((previousVideos) => {
      const updatedVideos = previousVideos.map((video) =>
        video.id === videoId ? { ...video, isTopRated: !video.isTopRated } : video
      );
      const refreshedSelection =
        updatedVideos.find((video) => video.id === videoId) ?? null;

      setSelectedVideo((current) =>
        current?.id === videoId ? refreshedSelection : current
      );

      return updatedVideos;
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {shareNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white shadow-lg backdrop-blur">
            {shareNotice}
          </div>
        </div>
      ) : null}
      <header className="flex items-start justify-between px-10 py-10">
        <div>
          <button
            type="button"
            onClick={() => setShowAboutDialog(true)}
            className="mt-2 inline-flex items-center text-xs uppercase tracking-[0.6em] text-neutral-500 transition hover:text-white"
          >
            AI Home Studios
          </button>
          <h1 className="mt-3 whitespace-nowrap text-4xl font-semibold tracking-wide text-white sm:text-5xl">
            AI Videos
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
            Highlighting the work of AI creators in one place
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-medium uppercase">
                {user.name.charAt(0)}
              </div>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium tracking-wide transition hover:bg-white hover:text-black"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleProfileClick}
              className="flex size-12 items-center justify-center rounded-full border border-white/20 transition hover:border-white"
              aria-label="Open profile menu"
            >
              <ProfileIcon />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-10 pb-16">
        <div className="mb-12 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center rounded-full bg-blue-500 px-8 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-500/40 transition hover:bg-blue-400"
          >
            Upload Your AI Videos
          </button>
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-[11px] tracking-[0.3em] text-neutral-400">
            Categories
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs font-semibold tracking-[0.1em] text-white focus:border-blue-500 focus:outline-none"
              aria-label="Filter videos by category"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category} className="bg-black text-white">
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="mb-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-[0.6em] text-neutral-500">
                Top Rated
              </h2>
              <p className="text-sm text-neutral-400">
                Curated features highlighted for the community.
              </p>
            </div>
            {isAdmin ? (
              <p className="text-xs text-neutral-500">
                Select a video to feature or remove it from Top Rated.
              </p>
            ) : null}
          </div>
          {topRatedVideos.length > 0 ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {topRatedVideos.map((video) => (
                <VideoCard
                  key={`top-${video.id}`}
                  video={video}
                  isActive={selectedVideo?.id === video.id}
                  onSelect={() => setSelectedVideo(video)}
                  onShare={() => handleShareVideo(video)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-500">
              No videos have been featured yet. Admins can promote favorites from
              the video details panel.
            </p>
          )}
        </section>
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-[0.6em] text-neutral-500">
            Community
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Fresh uploads and discoveries from across AI Home Studios.
          </p>
        </section>
        <section className="flex h-[calc(100vh-240px)] gap-8">
          <div className="flex-1 overflow-hidden">
            <div className="grid h-full grid-cols-1 gap-6 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {videosToDisplay.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isActive={selectedVideo?.id === video.id}
                  onSelect={() => setSelectedVideo(video)}
                  onShare={() => handleShareVideo(video)}
                />
              ))}
            </div>
          </div>

          {selectedVideo ? (
            <aside className="hidden w-full max-w-sm flex-col rounded-3xl border border-white/10 bg-white/[0.06] px-8 py-10 backdrop-blur md:flex">
              <span className="text-xs uppercase tracking-[0.4em] text-neutral-500">
                Featured video
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-wide">
                {selectedVideo.title ?? "Untitled Upload"}
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                {selectedVideo.fullName ?? toTitleCase(selectedVideo.uploader.name)}
              </p>
              {selectedVideo.uploader.email ? (
                <p className="text-xs text-neutral-500">
                  {selectedVideo.uploader.email}
                </p>
              ) : null}
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500">
                {selectedVideo.viewCount.toLocaleString()} views
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedVideo.categories.map((category) => (
                  <span
                    key={`${selectedVideo.id}-${category}`}
                    className="inline-flex items-center rounded-full border border-white/10 px-4 py-1 text-[10px] uppercase tracking-[0.4em] text-neutral-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleShareVideo(selectedVideo)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
              >
                <ShareIcon small />
                Share
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleToggleTopRated(selectedVideo.id)}
                  className={`mt-6 rounded-full border px-5 py-2 text-xs font-semibold tracking-wide transition ${
                    selectedVideo.isTopRated
                      ? "border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                      : "border-white/20 text-neutral-300 hover:border-blue-500 hover:text-white"
                  }`}
                >
                  {selectedVideo.isTopRated
                    ? "Remove from Top Rated"
                    : "Feature in Top Rated"}
                </button>
              ) : null}
              {selectedVideo.description ? (
                <p className="mt-6 text-sm leading-relaxed text-neutral-300">
                  {selectedVideo.description}
                </p>
              ) : null}
              <p className="mt-auto text-xs uppercase tracking-[0.3em] text-neutral-500">
                {new Date(selectedVideo.createdAt).toLocaleDateString()}
              </p>
            </aside>
          ) : (
            <aside className="hidden w-full max-w-sm flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.04] text-neutral-500 md:flex">
              <p className="px-12 text-center text-sm leading-relaxed">
                Select any video tile to see who created it and the story behind
                the upload.
              </p>
            </aside>
          )}
        </section>
      </main>

      {showUploadForm && user ? (
        <UploadModal
          onClose={() => setShowUploadForm(false)}
          onSubmit={handleUploadSubmit}
          user={user}
          categories={CATEGORY_OPTIONS}
        />
      ) : null}

      {authPrompt ? (
        <PromptDialog
          onDismiss={handleDismissPrompt}
          onConfirm={handleGoogleSignIn}
          title={promptCopy.title}
          description={promptCopy.description}
          confirmLabel={promptCopy.confirmLabel}
          errorMessage={authError}
        />
      ) : null}
      {showAboutDialog ? (
        <AboutDialog onClose={() => setShowAboutDialog(false)} />
      ) : null}
    </div>
  );
}

function mapSupabaseUser(authUser: SupabaseAuthUser): User | null {
  const email = authUser.email;

  if (!email) {
    return null;
  }

  const metadata = authUser.user_metadata as
    | Record<string, unknown>
    | undefined;

  const rawName =
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined);

  const cleanedName = rawName?.trim();

  if (cleanedName) {
    return {
      email,
      name: cleanedName,
    };
  }

  const emailHandle = email.split("@")[0] ?? "Creator";
  const formattedHandle = emailHandle
    .replace(/[._-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .join(" ");

  return {
    email,
    name: formattedHandle
      ? toTitleCase(formattedHandle)
      : "Creator",
  };
}

function UploadModal({
  onClose,
  onSubmit,
  user,
  categories,
}: {
  onClose: () => void;
  onSubmit: (payload: UploadPayload) => void;
  user: User;
  categories: readonly string[];
}) {
  const defaultCategories =
    DEFAULT_UPLOAD_CATEGORIES.filter((category) =>
      categories.includes(category)
    );
  const initialCategorySelection =
    defaultCategories.length > 0
      ? [...defaultCategories]
      : [...categories].slice(0, Math.min(3, categories.length));
  const [formState, setFormState] = useState<UploadPayload>({
    title: "",
    description: "",
    videoLink: "",
    videoFile: null,
    categories: [...initialCategorySelection],
    fullName: user.name,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const hasVideoLink = Boolean(formState.videoLink.trim());
  const hasVideoFile = Boolean(formState.videoFile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleCategory = (category: string) => {
    setFormState((prev) => {
      const alreadySelected = prev.categories.includes(category);

      if (alreadySelected) {
        const nextCategories = prev.categories.filter((item) => item !== category);
        setError(null);
        return { ...prev, categories: nextCategories };
      }

      if (prev.categories.length >= 3) {
        setError("Choose up to three categories.");
        return prev;
      }

      setError(null);
      return { ...prev, categories: [...prev.categories, category] };
    });
  };

  const handleLinkInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setError(null);

    setFormState((prev) => ({
      ...prev,
      videoLink: nextValue,
      videoFile: nextValue ? null : prev.videoFile,
    }));

    if (nextValue && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && nextFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Video file must be 1 GB or smaller.");
      event.target.value = "";
      return;
    }

    setError(null);
    setFormState((prev) => ({
      ...prev,
      videoFile: nextFile,
      videoLink: nextFile ? "" : prev.videoLink,
    }));

    if (nextFile && linkInputRef.current) {
      linkInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setHasAgreed(false);
    setError(null);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formState.categories.length === 0) {
      setError("Choose at least one category.");
      return;
    }

    if (formState.videoFile && formState.videoLink.trim()) {
      setError("Choose either a video link or a video file, not both.");
      return;
    }

    if (!formState.videoFile && !formState.videoLink.trim()) {
      setError("Choose a video file or provide a trusted link.");
      return;
    }

    if (formState.videoFile && formState.videoFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Video file must be 1 GB or smaller.");
      return;
    }

    if (!hasAgreed) {
      setError(
        "Please acknowledge the redistribution statement before uploading."
      );
      return;
    }

    setError(null);
    onSubmit({
      ...formState,
      videoLink: formState.videoLink.trim(),
      fullName: formState.fullName.trim(),
    });
    setFormState({
      title: "",
      description: "",
      videoLink: "",
      videoFile: null,
      categories: [...initialCategorySelection],
      fullName: user.name,
    });
    setHasAgreed(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-6"
      onClick={handleClose}
    >
      <div
        className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-black px-6 py-10 shadow-2xl sm:px-10 sm:py-12 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-wide">
              Upload Your AI Video
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Signed in as {user.email}. This address will be displayed with your video.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 p-2 text-sm text-neutral-400 transition hover:border-white hover:text-white"
            aria-label="Close upload form"
          >
            ✕
          </button>
        </div>

        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            Your full name
            <input
              value={formState.fullName}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }))
              }
              placeholder="Jordan Smith"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              maxLength={100}
              autoComplete="name"
            />
          </label>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Title
              <input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="Give your video a name"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                maxLength={80}
              />
              </label>

            <label className="flex flex-col gap-2 text-sm">
              Description
              <textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Share how you created it"
                className="min-h-[96px] resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            Categories (choose up to 3)
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((category) => {
                const isSelected = formState.categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleToggleCategory(category)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/20 text-blue-200"
                        : "border-white/10 bg-white/[0.04] text-neutral-200 hover:border-white/30"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-3 text-sm">
            Video link (YouTube, Instagram, TikTok, or file URL)
            <input
              value={formState.videoLink}
              onChange={handleLinkInputChange}
              placeholder="https://www.youtube.com/watch?v=..."
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              disabled={hasVideoFile}
              ref={linkInputRef}
            />
            <span className="text-xs text-neutral-500">
              Paste a link to feature your hosted video. Adding a link disables file uploads.
            </span>
          </label>

          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">or</span>
            <label className="flex w-full flex-col gap-3 text-sm">
              Upload a video file (max 1 GB)
              <input
                type="file"
                accept="video/*"
                onChange={handleFileInputChange}
                className="cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-10 text-center text-neutral-400 transition hover:border-white"
                disabled={hasVideoLink}
                ref={fileInputRef}
              />
              <span className="text-xs text-neutral-500">
                Uploads are disabled when a video link is provided.
              </span>
            </label>
          </div>

          <label className="flex items-start gap-3 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(event) => setHasAgreed(event.target.checked)}
              className="mt-1 size-4 cursor-pointer rounded border border-white/20 bg-white/[0.02]"
            />
            <span>
              By uploading to this site, I acknowledge this work as my own, and credit
              other artists where appropriate. I acknowledge AI Home Studios may
              republish and reference my work with its network, but that the organization
              does not claim ownership or copyright of my work.
            </span>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <p className="text-xs text-neutral-500">
            By continuing you agree to our{" "}
            <a
              href="/privacy"
              className="text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-200"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="/terms"
              className="text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-200"
            >
              Terms of Service
            </a>
            .
          </p>

          <div className="flex justify-end gap-4 text-sm">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-white/10 px-6 py-3 transition hover:border-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasAgreed}
              className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-500"
            >
              Share video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoCard({
  video,
  isActive,
  onSelect,
  onShare,
}: {
  video: Video;
  isActive: boolean;
  onSelect: () => void;
  onShare: () => void;
}) {
  const displayTitle = video.title ?? "Untitled Upload";
  const displayName = video.fullName ?? toTitleCase(video.uploader.name);

  return (
    <article
      className={`relative flex cursor-pointer flex-col rounded-3xl border ${
        isActive ? "border-blue-500" : "border-white/10"
      } bg-white/[0.04] p-5 transition hover:border-blue-500`}
      onClick={onSelect}
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {video.source === "youtube" || video.source === "instagram" ? (
          <iframe
            src={video.url}
            title={video.title ?? "Embedded video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : video.source === "tiktok" ? (
          <iframe
            src={video.url}
            title={video.title ?? "TikTok video"}
            className="h-full w-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            controls
            playsInline
            preload="metadata"
            className="h-full w-full"
            src={video.url}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            draggable={false}
          />
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onShare();
        }}
        className="absolute bottom-4 right-4 flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-white hover:bg-white/20"
        aria-label="Share video link"
      >
        <ShareIcon />
      </button>
      <div className="mt-4">
        {video.isTopRated ? (
          <span className="text-[10px] uppercase tracking-[0.4em] text-blue-400">
            Top Rated
          </span>
        ) : null}
        <h3 className="mt-3 text-lg font-medium">{displayTitle}</h3>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-neutral-500">
          {displayName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {video.categories.map((category) => (
            <span
              key={`${video.id}-${category}`}
              className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-neutral-300"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function PromptDialog({
  onDismiss,
  onConfirm,
  title,
  description,
  confirmLabel,
  errorMessage,
}: {
  onDismiss: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  errorMessage?: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-black px-8 py-10 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-semibold tracking-wide">{title}</h3>
        <p className="mt-3 text-sm text-neutral-400">{description}</p>
        {errorMessage ? (
          <p className="mt-4 text-xs font-semibold text-red-400">{errorMessage}</p>
        ) : null}
        <p className="mt-4 text-xs text-neutral-500">
          By continuing you agree to our{" "}
          <a
            href="/privacy"
            className="text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-200"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="/terms"
            className="text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-200"
          >
            Terms of Service
          </a>
          . We store post information, may advertise, and process payments in service of
          creators while never claiming ownership of your work.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-white/10 px-6 py-3 transition hover:border-white"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400"
          >
            <GoogleIcon small />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-black px-8 py-10 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-semibold tracking-wide">About Us</h3>
        <p className="mt-4 text-sm text-neutral-300">
          Welcome to the studio! We&apos;re here to highlight AI content in a quickly
          evolving entertainment space.
        </p>
        <p className="mt-4 text-sm text-neutral-300">
          —{" "}
          <a
            href="https://www.linkedin.com/in/andrewjbilden/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 hover:text-blue-200"
          >
            Andrew J. Bilden
          </a>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 inline-flex items-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 12.75c2.347 0 4.25-1.903 4.25-4.25S14.347 4.25 12 4.25 7.75 6.153 7.75 8.5 9.653 12.75 12 12.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 19.75v-.5a4.75 4.75 0 0 1 4.75-4.75h3.5a4.75 4.75 0 0 1 4.75 4.75v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ small = false }: { small?: boolean }) {
  const sizeClass = small ? "size-3" : "size-4";

  return (
    <svg
      className={sizeClass}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.5 5.5L20.5 10.5L15.5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 10.5H10.5C7.73858 10.5 5.5 12.7386 5.5 15.5V18.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon({ small = false }: { small?: boolean }) {
  const sizeClass = small ? "size-5" : "size-6";

  return (
    <svg
      className={sizeClass}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.2273C21.6 11.4364 21.5273 10.8727 21.3691 10.2909H12V13.8727H17.4218C17.3127 14.7545 16.7273 16.1182 15.3782 17.0636L15.3591 17.1891L18.4536 19.5136L18.6682 19.5364C20.6227 17.7818 21.6 15.2545 21.6 12.2273Z"
        fill="#4285F4"
      />
      <path
        d="M11.9999 21.6C14.759 21.6 17.0817 20.6909 18.6681 19.5364L15.3781 17.0636C14.5672 17.6182 13.4636 18.0091 11.9999 18.0091C9.30445 18.0091 7.01808 16.2545 6.19999 13.8545L6.0809 13.8645L2.86717 16.2818L2.82446 16.3909C4.39717 19.6636 7.91808 21.6 11.9999 21.6Z"
        fill="#34A853"
      />
      <path
        d="M6.2 13.8545C5.98364 13.2727 5.85636 12.6454 5.85636 12C5.85636 11.3545 5.98364 10.7273 6.18909 10.1455L6.18364 10.0127L2.93273 7.55908L2.82455 7.60908C2.11273 9.01817 1.70909 10.4636 1.70909 12C1.70909 13.5363 2.11273 14.9818 2.82455 16.3909L6.2 13.8545Z"
        fill="#FBBC05"
      />
      <path
        d="M11.9999 5.99089C13.799 5.99089 15.0145 6.76544 15.7045 7.41817L18.7317 4.58181C17.0708 3.00908 14.759 2 11.9999 2C7.91808 2 4.39717 3.93635 2.82446 7.20908L6.189 10.1454C7.01808 7.74536 9.30445 5.99089 11.9999 5.99089Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function normaliseLink(input: string): { url: string; source: VideoSource } {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com") || host === "youtu.be") {
      const id =
        url.searchParams.get("v") ||
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop();

      if (id) {
        return {
          url: `https://www.youtube.com/embed/${id}`,
          source: "youtube",
        };
      }
    }

    if (host.includes("instagram.com")) {
      return {
        url: `${url.origin}${url.pathname.replace(/\/$/, "")}/embed`,
        source: "instagram",
      };
    }

    if (host.includes("tiktok.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const videoIndex = segments.findIndex((segment) => segment === "video");
      const videoId =
        videoIndex >= 0 && segments[videoIndex + 1]
          ? segments[videoIndex + 1]
          : null;

      if (videoId) {
        return {
          url: `https://www.tiktok.com/embed/${videoId}`,
          source: "tiktok",
        };
      }
    }

    return { url: input, source: "external" };
  } catch {
    return { url: input, source: "external" };
  }
}

function toTitleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
