"use client";

import {
  CATEGORY_OPTIONS,
  INITIAL_VIDEOS,
  type StoredVideo,
  type VideoSource,
} from "@/data/initialVideos";
import { ShareIcon } from "@/components/icons/ShareIcon";
import { supabase } from "@/lib/supabaseClient";
import { mapDatabaseVideo } from "@/lib/mapDatabaseVideo";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import Image from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type User = {
  name: string;
  email: string;
  createdAt: string;
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

type FeedbackEntry = {
  id: string;
  text: string;
  createdAt: string;
};

type ProfileData = {
  fullName: string;
  interests: string;
  desiredMedia: string;
  collaborationInterest: "Y" | "N" | "";
  feedback: FeedbackEntry[];
};
type ProfileDetailsInput = Omit<ProfileData, "feedback">;
type ProfileVideoUpdate = {
  title: string;
  description: string;
  categories: string[];
  videoLink: string;
  newFile: File | null;
};

const CATEGORIES = ["All", ...CATEGORY_OPTIONS];
const DEFAULT_UPLOAD_CATEGORIES: string[] = [CATEGORY_OPTIONS[0]];
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 500; // 500 MB
const PROFILE_STORAGE_PREFIX = "eagle-profile-";
const DEFAULT_PROFILE_DATA: ProfileData = {
  fullName: "",
  interests: "",
  desiredMedia: "",
  collaborationInterest: "",
  feedback: [],
};
const ROTATING_LABELS = [
  "AI Videos",
  "AI Films",
  "AI Podcasts",
  "AI TV",
  "AI Music Videos",
];

function createFeedbackEntry(text: string): FeedbackEntry {
  return {
    id: `feedback-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`,
    text,
    createdAt: new Date().toISOString(),
  };
}

const initialVideos: Video[] = INITIAL_VIDEOS.map((video) => ({ ...video }));

const ADMIN_EMAIL = "mbamoveteam@gmail.com";

export default function Home() {
  const router = useRouter();
  const [seedVideos, setSeedVideos] = useState<Video[]>(initialVideos);
  const [uploadedVideos, setUploadedVideos] = useState<Video[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [authPromptContext, setAuthPromptContext] =
    useState<"upload" | "profile">("upload");
  const [authError, setAuthError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profileData, setProfileData] =
    useState<ProfileData>(DEFAULT_PROFILE_DATA);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const toolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileStorageKey = useMemo(
    () => (user?.email ? `${PROFILE_STORAGE_PREFIX}${user.email}` : null),
    [user?.email]
  );
  const effectiveProfileName = useMemo(() => {
    const trimmedProfileName = profileData.fullName.trim();

    if (trimmedProfileName) {
      return trimmedProfileName;
    }

    const fallbackName = user?.name?.trim();

    if (fallbackName) {
      return fallbackName;
    }

    return "Creator";
  }, [profileData.fullName, user?.name]);
  const profileInitial = useMemo(
    () => (effectiveProfileName ? effectiveProfileName.charAt(0).toUpperCase() : "C"),
    [effectiveProfileName]
  );
  const rotatingLabel = useMemo(() => {
    if (ROTATING_LABELS.length === 0) {
      return "";
    }

    const index = rotatingIndex % ROTATING_LABELS.length;
    return ROTATING_LABELS[index];
  }, [rotatingIndex]);
  const myUploads = useMemo(() => {
    if (!user?.email) {
      return [];
    }

    return uploadedVideos.filter(
      (video) => video.uploader.email === user.email
    );
  }, [uploadedVideos, user?.email]);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (ROTATING_LABELS.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRotatingIndex((previous) => (previous + 1) % ROTATING_LABELS.length);
    }, 3500);

    return () => {
      window.clearInterval(intervalId);
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
    if (!user || !profileStorageKey) {
      setProfileData(DEFAULT_PROFILE_DATA);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(profileStorageKey);

      if (storedValue) {
        const parsed = JSON.parse(storedValue) as Partial<ProfileData>;
        setProfileData({
          ...DEFAULT_PROFILE_DATA,
          ...parsed,
          fullName:
            (parsed.fullName as string | undefined)?.trim() ||
            user.name ||
            "",
          interests:
            (parsed.interests as string | undefined) ?? DEFAULT_PROFILE_DATA.interests,
          desiredMedia:
            (parsed.desiredMedia as string | undefined) ??
            DEFAULT_PROFILE_DATA.desiredMedia,
          collaborationInterest:
            (parsed.collaborationInterest as ProfileData["collaborationInterest"]) ??
            DEFAULT_PROFILE_DATA.collaborationInterest,
          feedback: Array.isArray(parsed.feedback)
            ? (parsed.feedback as FeedbackEntry[]).slice(0, 5)
            : DEFAULT_PROFILE_DATA.feedback,
        });
        return;
      }
    } catch {
      // Ignore malformed data and fall back to defaults.
    }

    setProfileData({
      ...DEFAULT_PROFILE_DATA,
      fullName: user.name,
    });
  }, [profileStorageKey, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !profileStorageKey || !user) {
      return;
    }

    window.localStorage.setItem(
      profileStorageKey,
      JSON.stringify(profileData)
    );
  }, [profileData, profileStorageKey, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!showToolsPanel) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const menuNode = toolsMenuRef.current;
      const buttonNode = toolsButtonRef.current;

      if (
        menuNode &&
        !menuNode.contains(target) &&
        buttonNode &&
        !buttonNode.contains(target)
      ) {
        setShowToolsPanel(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowToolsPanel(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showToolsPanel]);

  useEffect(() => {
    if (!user) {
      setProfileMenuOpen(false);
      setShowProfilePanel(false);
      setProfileData(DEFAULT_PROFILE_DATA);
      setShowToolsPanel(false);
    }
  }, [user]);

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
    let isMounted = true;

    const loadPosts = async () => {
      setIsLoadingPosts(true);
      setPostError(null);

      const { data, error } = await supabase
        .from("videos")
        .select(
          "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
        )
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      setIsLoadingPosts(false);

      if (error) {
        setPostError(error.message);
        return;
      }

      if (!data) {
        setUploadedVideos([]);
        return;
      }

      const mapped = data
        .map(mapDatabaseVideo)
        .filter((item): item is Video => Boolean(item));

      setUploadedVideos(mapped);
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

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
    setShowUploadForm(false);
    setProfileMenuOpen(false);
    setShowProfilePanel(false);
    setProfileData(DEFAULT_PROFILE_DATA);
    setShowToolsPanel(false);
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
      setProfileMenuOpen((previous) => !previous);
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
      const shareUrl = `${baseUrl}/video/${encodeURIComponent(video.id)}`;
      const clipboardText = `Hey, check out this video on Eagle AI Pictures! ${shareUrl}`;

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

  const handleSaveProfileDetails = useCallback(
    (details: ProfileDetailsInput) => {
      setProfileData((previous) => ({
        ...previous,
        fullName: details.fullName.trim(),
        interests: details.interests,
        desiredMedia: details.desiredMedia,
        collaborationInterest:
          details.collaborationInterest === "Y" ||
          details.collaborationInterest === "N"
            ? details.collaborationInterest
            : "",
      }));
    },
    []
  );

  const handleFullNameChange = useCallback((nextName: string) => {
    setProfileData((previous) => ({
      ...previous,
      fullName: nextName,
    }));
  }, []);

  const handleAddFeedback = useCallback((feedbackText: string) => {
    const trimmed = feedbackText.trim();

    if (!trimmed) {
      return;
    }

    setProfileData((previous) => {
      if (previous.feedback.length >= 5) {
        return previous;
      }

      return {
        ...previous,
        feedback: [createFeedbackEntry(trimmed), ...previous.feedback],
      };
    });
  }, []);

  const handleRemoveFeedback = useCallback((feedbackId: string) => {
    setProfileData((previous) => ({
      ...previous,
      feedback: previous.feedback.filter((entry) => entry.id !== feedbackId),
    }));
  }, []);

  const handleUploadSubmit = useCallback(
    async (
      payload: UploadPayload
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Please sign in to upload." };
      }

      try {
        const hasFile = Boolean(payload.videoFile);
        const hasLink = Boolean(payload.videoLink.trim());

        if (!hasFile && !hasLink) {
          return { success: false, error: "Add a link or upload a file." };
        }

        const trimmedFullName = payload.fullName.trim();
        const displayName = trimmedFullName || user.name;
        let source: VideoSource = "external";
        let videoUrl: string | null = null;
        let storageObjectPath: string | null = null;

        if (payload.videoFile) {
          const file = payload.videoFile;
          const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
          const extension = extensionMatch ? `.${extensionMatch[1]}` : "";
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const safeBaseName = baseName
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/(^-|-$)/g, "");
          const uniqueSuffix = `${Date.now()}`;
          const pathSegments = [
            user.email,
            `${safeBaseName || "upload"}-${uniqueSuffix}${extension}`,
          ]
            .join("/")
            .replace(/[^a-zA-Z0-9./_-]/g, "");
          storageObjectPath = pathSegments;

          const { error: uploadError } = await supabase.storage
            .from("ai_videos")
            .upload(storageObjectPath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });

          if (uploadError) {
            return { success: false, error: uploadError.message };
          }

          const {
            data: { publicUrl },
          } = supabase.storage
            .from("ai_videos")
            .getPublicUrl(storageObjectPath);

          videoUrl = publicUrl;
          source = "file";
        } else if (hasLink) {
          const { url, source: derivedSource } = normaliseLink(
            payload.videoLink.trim()
          );
          videoUrl = url;
          source = derivedSource;
        }

        if (!videoUrl) {
          return { success: false, error: "Unable to determine a video URL." };
        }

        const insertPayload = {
          title: payload.title.trim() || null,
          description: payload.description.trim() || null,
          video_url: videoUrl,
          source,
          storage_object_path: storageObjectPath,
          categories: payload.categories.slice(0, 3),
          full_name: trimmedFullName || null,
          view_count: 0,
          is_top_rated: false,
          uploader_name: displayName,
          uploader_email: user.email,
        };

        const { data, error } = await supabase
          .from("videos")
          .insert(insertPayload)
          .select(
            "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
          )
          .maybeSingle();

        if (error) {
          return { success: false, error: error.message };
        }

        const mapped = data ? mapDatabaseVideo(data) : null;

        if (!mapped) {
          return {
            success: false,
            error:
              "Upload succeeded but the post could not be loaded. Please refresh.",
          };
        }

        setUploadedVideos((previousVideos) => [mapped, ...previousVideos]);
        setShowUploadForm(false);

        return { success: true };
      } catch (unknownError) {
        return {
          success: false,
          error:
            unknownError instanceof Error
              ? unknownError.message
              : "Unexpected error while uploading. Please try again.",
        };
      }
    },
    [user]
  );

  const handleUpdateVideoDetails = useCallback(
    async (
      video: Video,
      updates: ProfileVideoUpdate
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return {
          success: false,
          error: "Please sign in to manage your uploads.",
        };
      }

      const trimmedTitle = updates.title.trim();
      const trimmedDescription = updates.description.trim();
      const sanitizedCategories = updates.categories
        .filter(Boolean)
        .slice(0, 3);
      const trimmedLink = updates.videoLink.trim();

      if (updates.newFile && trimmedLink) {
        return {
          success: false,
          error: "Choose either a new file or a video link, not both.",
        };
      }

      let nextVideoUrl = video.url;
      let nextSource: VideoSource = video.source;
      let nextStorageObjectPath: string | null =
        video.storageObjectPath ?? null;
      const previousStoragePath = video.storageObjectPath ?? null;
      let newlyUploadedPath: string | null = null;

      try {
        if (updates.newFile) {
          if (updates.newFile.size > MAX_FILE_SIZE_BYTES) {
            return {
              success: false,
              error: "Video file must be 500 MB or smaller.",
            };
          }

          const extensionMatch = updates.newFile.name.match(/\.([a-zA-Z0-9]+)$/);
          const extension = extensionMatch ? `.${extensionMatch[1]}` : "";
          const baseName = updates.newFile.name.replace(/\.[^/.]+$/, "");
          const safeBaseName = baseName
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/(^-|-$)/g, "");
          const uniqueSuffix = `${Date.now()}`;
          const storagePath = [
            user.email,
            `${safeBaseName || "upload"}-${uniqueSuffix}${extension}`,
          ]
            .join("/")
            .replace(/[^a-zA-Z0-9./_-]/g, "");

          const { error: uploadError } = await supabase.storage
            .from("ai_videos")
            .upload(storagePath, updates.newFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: updates.newFile.type || "application/octet-stream",
            });

          if (uploadError) {
            return {
              success: false,
              error: uploadError.message,
            };
          }

          newlyUploadedPath = storagePath;
          nextStorageObjectPath = storagePath;
          const {
            data: { publicUrl },
          } = supabase.storage.from("ai_videos").getPublicUrl(storagePath);
          nextVideoUrl = publicUrl;
          nextSource = "file";
        } else if (trimmedLink) {
          const { url, source: derivedSource } = normaliseLink(trimmedLink);
          nextVideoUrl = url;
          nextSource = derivedSource;
          nextStorageObjectPath = null;
        }

        const { data, error } = await supabase
          .from("videos")
          .update({
            title: trimmedTitle || null,
            description: trimmedDescription || null,
            categories: sanitizedCategories,
            full_name: effectiveProfileName,
            uploader_name: effectiveProfileName,
            video_url: nextVideoUrl,
            source: nextSource,
            storage_object_path: nextStorageObjectPath,
          })
          .eq("id", video.id)
          .select(
            "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, uploader_name, uploader_email, created_at"
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        const mapped = data ? mapDatabaseVideo(data) : null;

        if (!mapped) {
          throw new Error(
            "Unable to refresh the updated video. Please reload."
          );
        }

        setUploadedVideos((previous) =>
          previous.map((item) => (item.id === video.id ? mapped : item))
        );
        setSeedVideos((previous) =>
          previous.map((item) => (item.id === video.id ? mapped : item))
        );

        if (updates.newFile && previousStoragePath && previousStoragePath !== nextStorageObjectPath) {
          void supabase.storage
            .from("ai_videos")
            .remove([previousStoragePath]);
        }

        if (!updates.newFile && trimmedLink && previousStoragePath) {
          void supabase.storage
            .from("ai_videos")
            .remove([previousStoragePath]);
        }

        return { success: true };
      } catch (unknownError) {
        if (newlyUploadedPath) {
          void supabase.storage
            .from("ai_videos")
            .remove([newlyUploadedPath])
            .catch(() => undefined);
        }

        return {
          success: false,
          error:
            unknownError instanceof Error
              ? unknownError.message
              : "Unable to update this video right now.",
        };
      }
    },
    [effectiveProfileName, user]
  );

  const handleDeleteVideo = useCallback(
    async (video: Video): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from("videos")
          .delete()
          .eq("id", video.id);

        if (error) {
          throw error;
        }

        setUploadedVideos((previous) =>
          previous.filter((item) => item.id !== video.id)
        );
        setSeedVideos((previous) =>
          previous.filter((item) => item.id !== video.id)
        );

        if (video.storageObjectPath) {
          void supabase.storage
            .from("ai_videos")
            .remove([video.storageObjectPath])
            .catch(() => undefined);
        }

        return { success: true };
      } catch (unknownError) {
        return {
          success: false,
          error:
            unknownError instanceof Error
              ? unknownError.message
              : "Unable to delete this video right now.",
        };
      }
    },
    []
  );

  const allVideos = useMemo(
    () => [...uploadedVideos, ...seedVideos],
    [uploadedVideos, seedVideos]
  );
  const regularVideos = useMemo(
    () => allVideos.filter((video) => !video.isTopRated),
    [allVideos]
  );
  const videosToDisplay = useMemo(() => {
    if (selectedCategory === "All") {
      return regularVideos;
    }

    return regularVideos.filter((video) => video.categories.includes(selectedCategory));
  }, [regularVideos, selectedCategory]);
  const topRatedVideos = useMemo(() => {
    const featured = allVideos.filter((video) => video.isTopRated);

    if (selectedCategory === "All") {
      return featured;
    }

    return featured.filter((video) =>
      video.categories.includes(selectedCategory)
    );
  }, [allVideos, selectedCategory]);
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

  const handleToggleTopRated = useCallback(
    async (video: Video) => {
      if (!isAdmin) {
        return;
      }

      const nextValue = !video.isTopRated;
      setPostError(null);

      const isUploadedVideo = uploadedVideos.some(
        (item) => item.id === video.id
      );

      if (isUploadedVideo) {
        const { error } = await supabase
          .from("videos")
          .update({ is_top_rated: nextValue })
          .eq("id", video.id);

        if (error) {
          setPostError("Failed to update Top Rated status. Try again.");
          return;
        }

        setUploadedVideos((previousVideos) =>
          previousVideos.map((item) =>
            item.id === video.id ? { ...item, isTopRated: nextValue } : item
          )
        );
        return;
      }

      setSeedVideos((previousVideos) =>
        previousVideos.map((item) =>
          item.id === video.id ? { ...item, isTopRated: nextValue } : item
        )
      );
    },
    [isAdmin, uploadedVideos]
  );

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {shareNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white shadow-lg backdrop-blur">
            {shareNotice}
          </div>
        </div>
      ) : null}
      <header className="flex flex-col gap-8 px-10 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <div className="relative inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAboutDialog(true)}
              className="mt-2 inline-flex items-center text-xs uppercase tracking-[0.6em] text-white transition hover:text-blue-200"
            >
              Eagle AI Pictures
            </button>
            <button
              type="button"
              ref={toolsButtonRef}
              onClick={() => setShowToolsPanel((previous) => !previous)}
              className="flex items-center justify-center rounded-full border border-white/20 bg-white/[0.08] p-1.5 transition hover:border-blue-300 hover:bg-white/[0.14]"
              aria-label="Show recommended AI tools"
              aria-haspopup="true"
              aria-expanded={showToolsPanel}
            >
              <Image
                src="/favicon.ico"
                alt="Eagle AI Pictures emblem"
                width={36}
                height={36}
                className="rounded"
                priority
              />
            </button>
            {showToolsPanel ? (
              <div
                ref={toolsMenuRef}
                className="absolute left-full top-1/2 z-30 ml-4 w-64 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/90 p-4 text-sm text-white shadow-2xl backdrop-blur"
              >
                <h3 className="text-base font-semibold text-white">
                  Great AI tools we like
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-white/90">
                  <li>• Google Flow</li>
                  <li>• Suno AI</li>
                  <li>• Grok</li>
                  <li>• 11Labs</li>
                </ul>
              </div>
            ) : null}
          </div>
          <h1
            className="mt-3 whitespace-nowrap text-4xl font-semibold tracking-wide text-white sm:text-5xl"
            aria-live="polite"
          >
            {rotatingLabel}
          </h1>
          <p className="mt-3 text-sm text-white">
            Highlighting the work of AI creators in one place.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:items-end">
          <div
            className="relative"
            ref={isAuthenticated ? profileMenuRef : undefined}
          >
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-lg font-semibold uppercase text-white transition hover:border-white"
                  aria-haspopup="true"
                  aria-expanded={profileMenuOpen}
                  aria-label="Open profile options"
                >
                  {profileInitial}
                </button>
                {profileMenuOpen ? (
                  <div className="absolute right-0 top-14 w-52 rounded-2xl border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShowProfilePanel(true);
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        router.push("/subscription");
                      }}
                      className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Subscription
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleGoogleSignOut();
                      }}
                      className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </>
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
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-[11px] tracking-[0.3em] text-white">
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
              <h2 className="text-xs uppercase tracking-[0.6em] text-white">
                Top Rated
              </h2>
              <p className="text-sm text-white">
                Curated features highlighted for the community.
              </p>
            </div>
            {isAdmin ? (
              <p className="text-xs text-white">
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
                  onOpen={() => router.push(`/video/${video.id}`)}
                  onShare={() => handleShareVideo(video)}
                  isAdmin={isAdmin}
                  onToggleTopRated={() => handleToggleTopRated(video)}
                />
              ))}
            </div>
          ) : selectedCategory === "All" ? (
            <p className="mt-6 text-sm text-white">
              No videos have been featured yet. Admins can promote favorites from
              the video details panel.
            </p>
          ) : null}
        </section>
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-[0.6em] text-white">
            Community
          </h2>
          <p className="mt-2 text-sm text-white">
            Fresh uploads and discoveries from across Eagle AI Pictures.
          </p>
        </section>
        <section className="space-y-6">
          {postError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}
          {isLoadingPosts ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white">
              Loading community posts...
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {videosToDisplay.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onOpen={() => router.push(`/video/${video.id}`)}
                onShare={() => handleShareVideo(video)}
                isAdmin={isAdmin}
                onToggleTopRated={() => handleToggleTopRated(video)}
              />
            ))}
          </div>
          {!isLoadingPosts && videosToDisplay.length === 0 ? (
            <p className="text-sm text-white">
              No community posts yet. Be the first to upload your AI-powered creation.
            </p>
          ) : null}
        </section>
      </main>

      {showProfilePanel && user ? (
        <ProfilePanel
          user={user}
          onClose={() => setShowProfilePanel(false)}
          profileDetails={{
            fullName: profileData.fullName,
            interests: profileData.interests,
            desiredMedia: profileData.desiredMedia,
            collaborationInterest: profileData.collaborationInterest,
          }}
          feedback={profileData.feedback}
          onSaveProfile={handleSaveProfileDetails}
          onFullNameChange={handleFullNameChange}
          onAddFeedback={handleAddFeedback}
          onRemoveFeedback={handleRemoveFeedback}
          videos={myUploads}
          onUpdateVideo={handleUpdateVideoDetails}
          onDeleteVideo={handleDeleteVideo}
        />
      ) : null}

      {showUploadForm && user ? (
        <UploadModal
          onClose={() => setShowUploadForm(false)}
          onSubmit={handleUploadSubmit}
          user={user}
          categories={CATEGORY_OPTIONS}
          profileFullName={effectiveProfileName}
          onFullNameChange={handleFullNameChange}
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
      createdAt: authUser.created_at ?? new Date().toISOString(),
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
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

function UploadModal({
  onClose,
  onSubmit,
  user,
  categories,
  profileFullName,
  onFullNameChange,
}: {
  onClose: () => void;
  onSubmit: (
    payload: UploadPayload
  ) => Promise<{ success: boolean; error?: string }>;
  user: User;
  categories: readonly string[];
  profileFullName: string;
  onFullNameChange: (fullName: string) => void;
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
    fullName: profileFullName || user.name,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasVideoLink = Boolean(formState.videoLink.trim());
  const hasVideoFile = Boolean(formState.videoFile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormState((previous) => ({
      ...previous,
      fullName: profileFullName || user.name,
    }));
  }, [profileFullName, user.name]);

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
      setError("Video file must be 500 MB or smaller.");
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
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      setError("Video file must be 500 MB or smaller.");
      return;
    }

    if (!hasAgreed) {
      setError(
        "Please acknowledge the redistribution statement before uploading."
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        ...formState,
        videoLink: formState.videoLink.trim(),
        fullName: formState.fullName.trim(),
      });

      if (!result.success) {
        setError(result.error ?? "Unable to share video right now.");
        return;
      }

      setFormState({
        title: "",
        description: "",
        videoLink: "",
        videoFile: null,
        categories: [...initialCategorySelection],
        fullName: profileFullName || user.name,
      });
      setHasAgreed(false);
    } catch {
      setError("Something went wrong while sharing your video. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            <p className="mt-2 text-sm text-white">
              Signed in as {user.email}. This address will be displayed with your video.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 p-2 text-sm text-white transition hover:border-white hover:text-white"
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
              onChange={(event) => {
                const nextValue = event.target.value;
                setFormState((prev) => ({
                  ...prev,
                  fullName: nextValue,
                }));
                onFullNameChange(nextValue);
              }}
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
                        ? "border-blue-500 bg-blue-500/20 text-white"
                        : "border-white/10 bg-white/[0.04] text-white hover:border-white/30"
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
            <span className="text-xs text-white">
              Paste a link to feature your hosted video. Adding a link disables file uploads.
            </span>
          </label>

          <div className="flex items-center gap-4">
            <span className="text-sm text-white">or</span>
            <label className="flex w-full flex-col gap-3 text-sm">
              Upload a video file (max 500 MB)
              <input
                type="file"
                accept="video/*"
                onChange={handleFileInputChange}
                className="cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-10 text-center text-white transition hover:border-white"
                disabled={hasVideoLink}
                ref={fileInputRef}
              />
              <span className="text-xs text-white">
                Uploads are disabled when a video link is provided.
              </span>
            </label>
          </div>

          <label className="flex items-start gap-3 text-xs text-white">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(event) => setHasAgreed(event.target.checked)}
              className="mt-1 size-4 cursor-pointer rounded border border-white/20 bg-white/[0.02]"
            />
            <span>
              By uploading to this site, I acknowledge this work as my own, and credit
              other artists where appropriate. I acknowledge Eagle AI Pictures may
              republish and reference my work with its network, but that the organization
              does not claim ownership or copyright of my work.
            </span>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <p className="text-xs text-white">
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
              disabled={!hasAgreed || isSubmitting}
              className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-500"
            >
              {isSubmitting ? "Sharing..." : "Share video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ProfilePanelProps = {
  user: User;
  onClose: () => void;
  profileDetails: ProfileDetailsInput;
  feedback: FeedbackEntry[];
  onSaveProfile: (details: ProfileDetailsInput) => void;
  onFullNameChange: (fullName: string) => void;
  onAddFeedback: (text: string) => void;
  onRemoveFeedback: (id: string) => void;
  videos: Video[];
  onUpdateVideo: (
    video: Video,
    updates: ProfileVideoUpdate
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteVideo: (video: Video) => Promise<{ success: boolean; error?: string }>;
};

function ProfilePanel({
  user,
  onClose,
  profileDetails,
  feedback,
  onSaveProfile,
  onFullNameChange,
  onAddFeedback,
  onRemoveFeedback,
  videos,
  onUpdateVideo,
  onDeleteVideo,
}: ProfilePanelProps) {
  const [draft, setDraft] = useState<ProfileDetailsInput>({ ...profileDetails });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

  useEffect(() => {
    setDraft({ ...profileDetails });
  }, [profileDetails]);

  useEffect(() => {
    if (videos.length === 0) {
      setCurrentUploadIndex(0);
      return;
    }

    setCurrentUploadIndex((previous) =>
      Math.min(previous, Math.max(0, videos.length - 1))
    );
  }, [videos.length]);

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedFullName = draft.fullName.trim();

    if (!trimmedFullName) {
      setErrorMessage("Add your full name before saving.");
      setStatusMessage(null);
      return;
    }

    const normalizedInterest =
      draft.collaborationInterest === "Y" || draft.collaborationInterest === "N"
        ? draft.collaborationInterest
        : "";

    onSaveProfile({
      fullName: trimmedFullName,
      interests: draft.interests,
      desiredMedia: draft.desiredMedia,
      collaborationInterest: normalizedInterest,
    });
    onFullNameChange(trimmedFullName);
    setErrorMessage(null);
    setStatusMessage("Profile saved.");
  };

  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = feedbackDraft.trim();

    if (!trimmed) {
      setFeedbackError("Share your feedback before submitting.");
      return;
    }

    if (feedback.length >= 5) {
      setFeedbackError("You can record up to five feedback submissions.");
      return;
    }

    onAddFeedback(trimmed);
    setFeedbackDraft("");
    setFeedbackError(null);
  };

  const hasUploads = videos.length > 0;
  const currentVideo = hasUploads ? videos[currentUploadIndex] : null;

  const goToPreviousUpload = () => {
    setCurrentUploadIndex((previous) =>
      previous > 0 ? previous - 1 : previous
    );
  };

  const goToNextUpload = () => {
    setCurrentUploadIndex((previous) =>
      previous < videos.length - 1 ? previous + 1 : previous
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-black px-8 py-10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Your Profile</h2>
            <p className="mt-2 text-sm text-white">Signed in as {user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-white transition hover:border-white hover:bg-white/10"
            aria-label="Close profile window"
          >
            ✕
          </button>
        </div>

        <section className="mt-8">
          <form
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            onSubmit={handleProfileSubmit}
          >
            <label className="flex flex-col gap-2 text-sm text-white md:col-span-2">
              Your full name
              <input
                value={draft.fullName}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    fullName: event.target.value,
                  }));
                  setStatusMessage(null);
                  setErrorMessage(null);
                }}
                placeholder="Jordan Smith"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                maxLength={100}
                autoComplete="name"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-white md:col-span-2">
              What are your AI interests?
              <textarea
                value={draft.interests}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((previous) => ({
                    ...previous,
                    interests: nextValue,
                  }));
                  setStatusMessage(null);
                }}
                placeholder="Share the topics, tools, or collaborations that inspire you."
                className="min-h-[96px] resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-white md:col-span-2">
              What types of media would you like to see on the site?
              <textarea
                value={draft.desiredMedia}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft((previous) => ({
                    ...previous,
                    desiredMedia: nextValue,
                  }));
                  setStatusMessage(null);
                }}
                placeholder="Let us know which shows, films, or experiences you want."
                className="min-h-[96px] resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-white max-w-xs">
              Are you interested in monetizing your content with Eagle AI Pictures? (Y/N)
              <select
                value={draft.collaborationInterest}
                onChange={(event) => {
                  const nextValue =
                    event.target.value === "Y" || event.target.value === "N"
                      ? (event.target.value as "Y" | "N")
                      : "";
                  setDraft((previous) => ({
                    ...previous,
                    collaborationInterest: nextValue,
                  }));
                  setStatusMessage(null);
                }}
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">Select</option>
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </label>

            <div className="flex items-center justify-end gap-4 md:col-span-2">
              {errorMessage ? (
                <p className="text-sm font-medium text-red-400">{errorMessage}</p>
              ) : null}
              {statusMessage ? (
                <p className="text-sm font-medium text-emerald-300">
                  {statusMessage}
                </p>
              ) : null}
              <button
                type="submit"
                className="rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                Save profile
              </button>
            </div>
          </form>
        </section>

        <section className="mt-10">
          <h3 className="text-lg font-semibold text-white">
            Could we ask you to provide us with feedback?
          </h3>
          <form className="mt-4 space-y-4" onSubmit={handleFeedbackSubmit}>
            <textarea
              value={feedbackDraft}
              onChange={(event) => {
                setFeedbackDraft(event.target.value);
                setFeedbackError(null);
              }}
              placeholder="Share ideas, requests, or observations for the Eagle AI Pictures team."
              className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
            {feedbackError ? (
              <p className="text-sm font-medium text-red-400">{feedbackError}</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white">
              <span>{feedback.length} / 5 submissions recorded</span>
              <button
                type="submit"
                className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-blue-500"
                disabled={feedback.length >= 5}
              >
                Record feedback
              </button>
            </div>
          </form>
          <div className="mt-6 space-y-4">
            {feedback.length === 0 ? (
              <p className="text-sm text-white">
                No feedback submissions yet. Share a note to help us improve.
              </p>
            ) : (
              feedback.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white"
                >
                  <p>{entry.text}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white">
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFeedback(entry.id)}
                      className="rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">My Uploads</h3>
              <p className="mt-2 text-sm text-white">
                Manage the videos published under {user.email}.
              </p>
            </div>
            {hasUploads ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPreviousUpload}
                  disabled={currentUploadIndex === 0}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/20"
                  aria-label="View previous upload"
                >
                  ←
                </button>
                <span className="text-sm text-white">
                  {currentUploadIndex + 1} / {videos.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextUpload}
                  disabled={currentUploadIndex === videos.length - 1}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/20"
                  aria-label="View next upload"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-6">
            {currentVideo ? (
              <ProfileUploadEditor
                key={currentVideo.id}
                video={currentVideo}
                categories={CATEGORY_OPTIONS}
                onUpdateVideo={(updates) => onUpdateVideo(currentVideo, updates)}
                onDeleteVideo={() => onDeleteVideo(currentVideo)}
              />
            ) : (
              <p className="text-sm text-white">
                You have not published any videos yet. Upload to see them here.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type ProfileUploadEditorProps = {
  video: Video;
  categories: readonly string[];
  onUpdateVideo: (
    updates: ProfileVideoUpdate
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteVideo: () => Promise<{ success: boolean; error?: string }>;
};

function ProfileUploadEditor({
  video,
  categories,
  onUpdateVideo,
  onDeleteVideo,
}: ProfileUploadEditorProps) {
  const [formState, setFormState] = useState<{
    title: string;
    description: string;
    categories: string[];
  }>({
    title: video.title ?? "",
    description: video.description ?? "",
    categories: [...video.categories],
  });
  const [mediaLink, setMediaLink] = useState(
    video.source === "file" ? "" : video.url
  );
  const [newFile, setNewFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const createdAtDisplay = useMemo(
    () => new Date(video.createdAt).toLocaleString(),
    [video.createdAt]
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormState({
      title: video.title ?? "",
      description: video.description ?? "",
      categories: [...video.categories],
    });
    setMediaLink(video.source === "file" ? "" : video.url);
    setNewFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFormError(null);
    setFormSuccess(null);
    setMetadataExpanded(false);
    setMediaExpanded(false);
  }, [video]);

  useEffect(() => {
    if (!formSuccess) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFormSuccess(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [formSuccess]);

  useEffect(() => {
    if (formError) {
      setMetadataExpanded(true);
      setMediaExpanded(true);
    }
  }, [formError]);

  const handleToggleCategory = (category: string) => {
    setFormState((previous) => {
      const alreadySelected = previous.categories.includes(category);

      if (alreadySelected) {
        setFormError(null);
        setFormSuccess(null);
        return {
          ...previous,
          categories: previous.categories.filter((item) => item !== category),
        };
      }

      if (previous.categories.length >= 3) {
        setFormError("Select up to three categories.");
        return previous;
      }

      setFormError(null);
      setFormSuccess(null);
      return {
        ...previous,
        categories: [...previous.categories, category],
      };
    });
  };

  const handleMediaLinkChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMediaLink(event.target.value);
    setNewFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFormError(null);
    setFormSuccess(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("Video file must be 500 MB or smaller.");
      event.target.value = "";
      return;
    }

    setNewFile(file);
    if (file) {
      setMediaLink("");
    }
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setFormSuccess(null);

    if (formState.categories.length === 0) {
      setFormError("Select at least one category.");
      setIsSaving(false);
      return;
    }

    if (mediaLink.trim() && newFile) {
      setFormError("Choose either a video link or a new file, not both.");
      setIsSaving(false);
      return;
    }

    const result = await onUpdateVideo({
      title: formState.title,
      description: formState.description,
      categories: formState.categories,
      videoLink: mediaLink,
      newFile,
    });

    if (!result.success) {
      setFormError(result.error ?? "Unable to save changes.");
      setIsSaving(false);
      return;
    }

    setFormSuccess("Saved.");
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Delete this upload? This action cannot be undone."
      );
      if (!confirmed) {
        return;
      }
    }

    setIsDeleting(true);
    setFormError(null);
    setFormSuccess(null);

    const result = await onDeleteVideo();

    if (!result.success) {
      setFormError(result.error ?? "Unable to delete this upload.");
      setIsDeleting(false);
    }
  };

  const categoriesPreview =
    formState.categories.length > 0
      ? formState.categories.join(", ")
      : "No categories selected yet.";
  const trimmedDescription = formState.description.trim();
  const descriptionPreview = trimmedDescription
    ? trimmedDescription.length > 160
      ? `${trimmedDescription.slice(0, 160)}…`
      : trimmedDescription
    : "Add a description when you are ready.";
  const currentMediaSummary =
    video.source === "file"
      ? "Uploaded file"
      : `Linked (${toTitleCase(video.source)})`;
  const pendingMediaSummary = newFile
    ? `Pending upload: ${newFile.name}`
    : mediaLink.trim()
    ? `Pending link: ${mediaLink.trim()}`
    : null;

  return (
    <form
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-white">
            {formState.title.trim() || "Untitled Upload"}
          </h4>
          <p className="text-xs text-white">{createdAtDisplay}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full bg-blue-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-blue-500"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-red-400"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/80">
        <p>
          <span className="font-semibold text-white">Current media:</span>{" "}
          {currentMediaSummary}
        </p>
        {video.source === "file" ? (
          video.storageObjectPath ? (
            <p className="mt-2 break-all text-xs text-white/60">
              Storage path: {video.storageObjectPath}
            </p>
          ) : null
        ) : (
          <p className="mt-2 break-all text-white/70">{video.url}</p>
        )}
        {pendingMediaSummary ? (
          <p className="mt-2 break-all text-emerald-300">{pendingMediaSummary}</p>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/80">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Categories
          </span>
          <p className="mt-1 text-white">{categoriesPreview}</p>
        </div>
        <div className="mt-4">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Description
          </span>
          <p className="mt-1 text-white">{descriptionPreview}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setMetadataExpanded((previous) => !previous)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
            aria-expanded={metadataExpanded}
          >
            Edit metadata
            <span>{metadataExpanded ? "−" : "+"}</span>
          </button>
          {metadataExpanded ? (
            <div className="space-y-4 border-t border-white/10 p-4">
              <label className="flex flex-col gap-2 text-sm text-white">
                Title
                <input
                  value={formState.title}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFormState((previous) => ({
                      ...previous,
                      title: nextValue,
                    }));
                    setFormSuccess(null);
                  }}
                  placeholder="Update your title"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                  maxLength={80}
                />
              </label>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                  Categories (choose up to 3)
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const isSelected = formState.categories.includes(category);
                    return (
                      <button
                        key={`${video.id}-${category}`}
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-500/20 text-white"
                            : "border-white/15 bg-white/[0.04] text-white hover:border-white/40"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-2 text-sm text-white">
                Description
                <textarea
                  value={formState.description}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFormState((previous) => ({
                      ...previous,
                      description: nextValue,
                    }));
                    setFormSuccess(null);
                  }}
                  placeholder="Edit the story behind your video"
                  className="min-h-[96px] resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                  rows={4}
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setMediaExpanded((previous) => !previous)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
            aria-expanded={mediaExpanded}
          >
            Update media
            <span>{mediaExpanded ? "−" : "+"}</span>
          </button>
          {mediaExpanded ? (
            <div className="space-y-4 border-t border-white/10 p-4">
              <label className="flex flex-col gap-2 text-sm text-white">
                Video link (YouTube, Instagram, TikTok, or file URL)
                <input
                  value={mediaLink}
                  onChange={handleMediaLinkChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                  disabled={Boolean(newFile)}
                />
              </label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/70">or</span>
                <label className="flex w-full flex-col gap-3 text-sm text-white">
                  Upload a new video file (max 500 MB)
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-10 text-center text-white transition hover:border-white"
                    disabled={Boolean(mediaLink.trim())}
                    ref={fileInputRef}
                  />
                  {newFile ? (
                    <span className="text-xs text-white/70">
                      Selected file: {newFile.name}
                    </span>
                  ) : null}
                </label>
              </div>
              <p className="text-xs text-white/60">
                Adding a link replaces any uploaded file. Uploading a new file will
                overwrite your current media.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {formError ? (
        <p className="mt-4 text-sm font-medium text-red-400">{formError}</p>
      ) : null}
      {formSuccess ? (
        <p className="mt-4 text-sm font-medium text-emerald-300">
          {formSuccess}
        </p>
      ) : null}
    </form>
  );
}

function VideoCard({
  video,
  onOpen,
  onShare,
  isAdmin,
  onToggleTopRated,
}: {
  video: Video;
  onOpen: () => void;
  onShare: () => void;
  isAdmin: boolean;
  onToggleTopRated?: () => void;
}) {
  const displayTitle = video.title ?? "Untitled Upload";
  const displayName = video.fullName ?? toTitleCase(video.uploader.name);

  return (
    <article
      className={`relative flex cursor-pointer flex-col rounded-3xl border ${
        video.isTopRated ? "border-blue-500" : "border-white/10"
      } bg-white/[0.04] p-5 transition hover:border-blue-500`}
      onClick={onOpen}
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
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white">
          {displayName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {video.categories.map((category) => (
            <span
              key={`${video.id}-${category}`}
              className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white"
            >
              {category}
            </span>
          ))}
        </div>
        {isAdmin && onToggleTopRated ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleTopRated();
            }}
            className={`mt-4 inline-flex items-center rounded-full border px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
              video.isTopRated
                ? "border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                : "border-white/20 text-white hover:border-blue-500 hover:text-white"
            }`}
          >
            {video.isTopRated ? "Remove Top Rated" : "Feature Top Rated"}
          </button>
        ) : null}
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
        <p className="mt-3 text-sm text-white">{description}</p>
        {errorMessage ? (
          <p className="mt-4 text-xs font-semibold text-red-400">{errorMessage}</p>
        ) : null}
        <p className="mt-4 text-xs text-white">
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
        <p className="mt-4 text-sm text-white">
          Welcome to the picture! We&apos;re a place for creators and enjoyers, using AI
          to inspire and tell stories.
        </p>
        <p className="mt-4 text-sm italic text-white">
          “Make things that move people.”
        </p>
        <p className="mt-4 text-sm text-white">
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
