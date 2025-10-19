import {
  INITIAL_VIDEOS,
  type StoredVideo,
} from "@/data/initialVideos";
import { mapDatabaseVideo } from "@/lib/mapDatabaseVideo";
import { supabase } from "@/lib/supabaseClient";

const VIDEO_FIELDS =
  "id, title, description, video_url, source, storage_object_path, categories, full_name, view_count, is_top_rated, top_rated_override, uploader_name, uploader_email, created_at";

export async function getVideoByIdServer(
  id: string
): Promise<StoredVideo | null> {
  const seedMatch = INITIAL_VIDEOS.find((item) => item.id === id);

  if (seedMatch) {
    return seedMatch;
  }

  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return mapDatabaseVideo(data);
}

export { VIDEO_FIELDS as VIDEO_SELECT_FIELDS };
