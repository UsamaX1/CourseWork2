export type Role = "CREATOR" | "CONSUMER";

export type LoginResponse = {
  token: string;
  user: { id: string; email: string; role: Role };
};

export type Photo = {
  id: string;
  createdAt: string;
  title: string;
  caption?: string | null;
  location?: string | null;
  people: string[];
  creator: { id: string; email: string };
  _count?: { comments: number; ratings: number };
};

export type PhotoDetail = Photo & {
  objectKey: string;
  thumbKey?: string | null;
  mimeType: string;
  byteSize: number;
  comments: Array<{ id: string; createdAt: string; text: string; user: { id: string; email: string } }>;
  ratings: Array<{ value: number; userId: string }>;
  ratingAvg: number | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://photoshare-backend-aagwfchxecd7adb9.francecentral-01.azurewebsites.net";

export function getToken(): string | null {
  return localStorage.getItem("token");
}  

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("token");
  else localStorage.setItem("token", token);
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function me(): Promise<{ user: { userId: string; role: Role; email: string } }> {
  return await apiFetch("/auth/me");
}

export async function listPhotos(params: { q?: string; location?: string; person?: string }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.location) qs.set("location", params.location);
  if (params.person) qs.set("person", params.person);
  return (await apiFetch(`/photos?${qs.toString()}`)) as { photos: Photo[] };
}

export async function getPhoto(id: string) {
  return (await apiFetch(`/photos/${encodeURIComponent(id)}`)) as { photo: PhotoDetail };
}

export async function getPhotoMedia(id: string) {
  // Use API proxy endpoints so browsers don't depend on S3/MinIO signing details.
  const base = API_BASE_URL;
  return {
    fullUrl: `${base}/photos/${encodeURIComponent(id)}/blob?kind=full`,
    thumbUrl: `${base}/photos/${encodeURIComponent(id)}/blob?kind=thumb`,
    mimeType: "image/*"
  };
}

export async function addComment(photoId: string, text: string) {
  return await apiFetch(`/photos/${encodeURIComponent(photoId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
}

export async function setRating(photoId: string, value: number) {
  return await apiFetch(`/photos/${encodeURIComponent(photoId)}/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value })
  });
}

export async function uploadPhoto(input: {
  file: File;
  title: string;
  caption?: string;
  location?: string;
  people: string[];
}) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  const form = new FormData();
  form.set(
    "meta",
    JSON.stringify({
      title: input.title,
      caption: input.caption || undefined,
      location: input.location || undefined,
      people: input.people
    })
  );
  form.set("file", input.file);
  const res = await fetch(`${API_BASE_URL}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `Upload failed (${res.status})`);
  return data as { photo: Photo };
}

export async function listCreatorPhotos() {
  return (await apiFetch("/creator/photos")) as { photos: Photo[] };
}

