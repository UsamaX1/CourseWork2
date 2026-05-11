import React, { useEffect, useMemo, useState } from "react";
import {
  addComment,
  getPhoto,
  getPhotoMedia,
  getToken,
  listCreatorPhotos,
  listPhotos,
  login,
  me,
  setRating,
  setToken,
  uploadPhoto,
  type Photo,
  type PhotoDetail,
  type Role
} from "./api";

type View = "consumer" | "creator";  

export function App() {
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "error" | "ok"; message?: string }>({
    kind: "idle"
  });
  const [session, setSession] = useState<{ email: string; role: Role } | null>(null);
  const [view, setView] = useState<View>("consumer");

  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) return;
    me()
      .then((r) => {
        setSession({ email: r.user.email, role: r.user.role });
        setView(r.user.role === "CREATOR" ? "creator" : "consumer");
      })
      .catch(() => {
        setToken(null);
      });
  }, [token]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandName">
            <span>PhotoShare</span>
          </div>
        </div>
        <div className="row wrap">
          {session ? (
            <>
              <span className="pill">{session.email}</span>
              <span className="pill">{session.role}</span>
              <button
                className="btn danger"
                onClick={() => {
                  setToken(null);
                  setSession(null);
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <span className="pill">Not logged in</span>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Account</h3>
          {!session ? (
            <LoginCard
              onLogin={(s) => {
                setSession(s);
                setView(s.role === "CREATOR" ? "creator" : "consumer");
              }}
              setStatus={setStatus}
            />
          ) : (
            <>
              <div className="tabs">
                <button className={`tab ${view === "consumer" ? "active" : ""}`} onClick={() => setView("consumer")}>
                  Consumer view
                </button>
                <button
                  className={`tab ${view === "creator" ? "active" : ""}`}
                  onClick={() => setView("creator")}
                  disabled={session.role !== "CREATOR"}
                  title={session.role !== "CREATOR" ? "Creator-only" : undefined}
                >
                  Creator view
                </button>
              </div>
              <div style={{ marginTop: 10 }} className="hint">
                Creator upload is restricted to role <b>CREATOR</b> (no public enrolment UI).
              </div>
            </>
          )}

          <div style={{ marginTop: 14 }}>
            {status.kind === "loading" && <div className="hint">Working…</div>}
            {status.kind === "error" && <div className="error">{status.message}</div>}
            {status.kind === "ok" && <div className="ok">{status.message}</div>}
          </div>
        </div>

        <div className="card">
          {view === "creator" ? (
            <CreatorUpload setStatus={setStatus} />
          ) : (
            <ConsumerGallery canInteract={!!session} setStatus={setStatus} />
          )}
        </div>
      </div>
    </div>
  );
}

function LoginCard(props: {
  onLogin: (s: { email: string; role: Role }) => void;
  setStatus: React.Dispatch<React.SetStateAction<{ kind: "idle" | "loading" | "error" | "ok"; message?: string }>>;
}) {
  const [email, setEmail] = useState("consumer@example.com");
  const [password, setPassword] = useState("Password123!");

  return (
    <>
      <div className="label">Email</div>
      <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="label">Password</div>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="btnRow">
        <button
          className="btn primary full"
          onClick={async () => {
            props.setStatus({ kind: "loading" });
            try {
              const r = await login(email, password);
              setToken(r.token);
              props.onLogin({ email: r.user.email, role: r.user.role });
              props.setStatus({ kind: "ok", message: "Logged in." });
            } catch (e: any) {
              props.setStatus({ kind: "error", message: e.message ?? "Login failed" });
            }
          }}
        >
          Log in
        </button>
        <div className="hint">
          Use seeded accounts:
          <br />
          `creator@example.com` / `Password123!`
          <br />
          `consumer@example.com` / `Password123!`
        </div>
      </div>
    </>
  );
}

function CreatorUpload(props: {
  setStatus: React.Dispatch<React.SetStateAction<{ kind: "idle" | "loading" | "error" | "ok"; message?: string }>>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [people, setPeople] = useState("");
  const [mine, setMine] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<PhotoDetail | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ fullUrl: string; thumbUrl: string | null } | null>(null);

  async function refreshMine() {
    try {
      const r = await listCreatorPhotos();
      setMine(r.photos);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h3>Creator upload</h3>
      <div className="label">Image file</div>
      <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="label">Title</div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="label">Caption</div>
      <textarea className="textarea" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <div className="label">Location</div>
      <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
      <div className="label">People (comma-separated)</div>
      <input className="input" value={people} onChange={(e) => setPeople(e.target.value)} />
      <div style={{ marginTop: 12 }} className="row">
        <button
          className="btn primary"
          disabled={!file || !title.trim()}
          onClick={async () => {
            props.setStatus({ kind: "loading" });
            try {
              await uploadPhoto({
                file: file!,
                title: title.trim(),
                caption: caption.trim() || undefined,
                location: location.trim() || undefined,
                people: people
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              });
              setFile(null);
              setTitle("");
              setCaption("");
              setLocation("");
              setPeople("");
              await refreshMine();
              props.setStatus({ kind: "ok", message: "Uploaded photo." });
            } catch (e: any) {
              props.setStatus({ kind: "error", message: e.message ?? "Upload failed" });
            }
          }}
        >
          Upload
        </button>
        <button className="btn" onClick={() => refreshMine()}>
          Refresh my uploads
        </button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        Upload stores media in S3-compatible storage and generates a thumbnail.
      </div>

      <div style={{ marginTop: 12 }} className="gallery">
        {mine.map((p) => (
          <PhotoThumb
            key={p.id}
            photo={p}
            onOpen={async () => {
              props.setStatus({ kind: "loading" });
              try {
                const detail = await getPhoto(p.id);
                const media = await getPhotoMedia(p.id);
                setSelected(detail.photo);
                setSelectedMedia({ fullUrl: media.fullUrl, thumbUrl: media.thumbUrl });
                props.setStatus({ kind: "idle" });
              } catch (e: any) {
                props.setStatus({ kind: "error", message: e.message ?? "Failed to open photo" });
              }
            }}
          />
        ))}
      </div>

      {selected && selectedMedia && (
        <PhotoModal
          canInteract={false}
          photo={selected}
          media={selectedMedia}
          onClose={() => {
            setSelected(null);
            setSelectedMedia(null);
          }}
          onMutate={async () => {
            const detail = await getPhoto(selected.id);
            setSelected(detail.photo);
          }}
          setStatus={props.setStatus}
        />
      )}
    </>
  );
}

function ConsumerGallery(props: {
  canInteract: boolean;
  setStatus: React.Dispatch<React.SetStateAction<{ kind: "idle" | "loading" | "error" | "ok"; message?: string }>>;
}) {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [person, setPerson] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<PhotoDetail | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ fullUrl: string; thumbUrl: string | null } | null>(null);

  async function refresh() {
    props.setStatus({ kind: "loading" });
    try {
      const r = await listPhotos({ q: q.trim() || undefined, location: location.trim() || undefined, person: person.trim() || undefined });
      setPhotos(r.photos);
      props.setStatus({ kind: "ok", message: `Loaded ${r.photos.length} photo(s).` });
    } catch (e: any) {
      props.setStatus({ kind: "error", message: e.message ?? "Failed to load photos" });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="row space wrap">
        <h3>Consumer browse/search</h3>
        <button className="btn" onClick={() => refresh()}>
          Refresh
        </button>
      </div>
      <div className="row wrap">
        <input className="input" placeholder="Search title/caption…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" placeholder="Filter location…" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input className="input" placeholder="Filter person…" value={person} onChange={(e) => setPerson(e.target.value)} />
        <button className="btn primary" onClick={() => refresh()}>
          Apply
        </button>
      </div>

      <div style={{ marginTop: 12 }} className="gallery">
        {photos.map((p) => (
          <PhotoThumb
            key={p.id}
            photo={p}
            onOpen={async () => {
              props.setStatus({ kind: "loading" });
              try {
                const detail = await getPhoto(p.id);
                const media = await getPhotoMedia(p.id);
                setSelected(detail.photo);
                setSelectedMedia({ fullUrl: media.fullUrl, thumbUrl: media.thumbUrl });
                props.setStatus({ kind: "idle" });
              } catch (e: any) {
                props.setStatus({ kind: "error", message: e.message ?? "Failed to open photo" });
              }
            }}
          />
        ))}
      </div>

      {selected && selectedMedia && (
        <PhotoModal
          canInteract={props.canInteract}
          photo={selected}
          media={selectedMedia}
          onClose={() => {
            setSelected(null);
            setSelectedMedia(null);
          }}
          onMutate={async () => {
            const detail = await getPhoto(selected.id);
            setSelected(detail.photo);
          }}
          setStatus={props.setStatus}
        />
      )}
    </>
  );
}

function PhotoThumb(props: { photo: Photo; onOpen: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    getPhotoMedia(props.photo.id)
      .then((m) => setThumb(m.thumbUrl ?? m.fullUrl))
      .catch(() => setThumb(null));
  }, [props.photo.id]);

  return (
    <div className="thumb" onClick={props.onOpen} role="button" tabIndex={0}>
      {thumb ? <img src={thumb} alt={props.photo.title} /> : <div style={{ padding: 14 }} className="hint">Loading…</div>}
      <div className="meta">
        <div className="title">{props.photo.title}</div>
        <div className="sub">
          <span className="metaLine">
            {props.photo.location ? props.photo.location : "No location"}
          </span>
          <span className="dot">•</span>
          <span className="metaLine">{props.photo._count?.comments ?? 0} comments</span>
          <span className="dot">•</span>
          <span className="metaLine">{props.photo._count?.ratings ?? 0} ratings</span>
        </div>
      </div>
    </div>
  );
}

function PhotoModal(props: {
  canInteract: boolean;
  photo: PhotoDetail;
  media: { fullUrl: string; thumbUrl: string | null };
  onClose: () => void;
  onMutate: () => Promise<void>;
  setStatus: React.Dispatch<React.SetStateAction<{ kind: "idle" | "loading" | "error" | "ok"; message?: string }>>;
}) {
  const [comment, setComment] = useState("");
  const [rating, setRatingValue] = useState(5);

  return (
    <div className="modalBackdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="igHeader">
          <div className="igUser">
            <div className="avatar" aria-hidden="true">
              <div className="avatarInner" />
            </div>
            <div>
              <div className="igUserName">{props.photo.creator.email}</div>
              <div className="igMeta">
                {props.photo.location ? props.photo.location : "No location"} ·{" "}
                {props.photo.ratingAvg ? `Avg ${props.photo.ratingAvg.toFixed(2)}` : "No ratings"}
              </div>
            </div>
          </div>
          <button className="btn" onClick={props.onClose}>
            Close
          </button>
        </div>
        <div className="modalBody">
          <div className="modalImg">
            <img src={props.media.fullUrl} alt={props.photo.title} />
          </div>
          <div className="modalSide">
            <div style={{ fontWeight: 800, fontSize: 14 }}>{props.photo.title}</div>
            {props.photo.caption ? (
              <div style={{ marginTop: 8, color: "rgba(255,255,255,.86)", lineHeight: 1.4 }}>{props.photo.caption}</div>
            ) : (
              <div className="hint" style={{ marginTop: 8 }}>
                No caption.
              </div>
            )}
            {props.photo.people?.length ? (
              <div style={{ marginTop: 10 }} className="row wrap">
                {props.photo.people.map((p) => (
                  <span key={p} className="pill">
                    {p}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 14 }} className="card">
              <h3>Comments</h3>
              {props.photo.comments.length === 0 ? <div className="hint">No comments yet.</div> : null}
              {props.photo.comments.map((c) => (
                <div key={c.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="hint" style={{ fontWeight: 700 }}>{c.user.email}</div>
                  <div style={{ marginTop: 2, lineHeight: 1.35 }}>{c.text}</div>
                </div>
              ))}
              <div className="label">Add a comment</div>
              <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} disabled={!props.canInteract} />
              <div style={{ marginTop: 10 }} className="row">
                <button
                  className="btn primary"
                  disabled={!props.canInteract || !comment.trim()}
                  onClick={async () => {
                    props.setStatus({ kind: "loading" });
                    try {
                      await addComment(props.photo.id, comment.trim());
                      setComment("");
                      await props.onMutate();
                      props.setStatus({ kind: "ok", message: "Comment added." });
                    } catch (e: any) {
                      props.setStatus({ kind: "error", message: e.message ?? "Failed to add comment" });
                    }
                  }}
                >
                  Post
                </button>
                {!props.canInteract ? <span className="hint">Log in as consumer to comment/rate.</span> : null}
              </div>
            </div>

            <div style={{ marginTop: 14 }} className="card">
              <h3>Rate</h3>
              <div className="row wrap">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRatingValue(Number(e.target.value))}
                  disabled={!props.canInteract}
                  style={{ maxWidth: 120 }}
                />
                <button
                  className="btn primary"
                  disabled={!props.canInteract}
                  onClick={async () => {
                    props.setStatus({ kind: "loading" });
                    try {
                      await setRating(props.photo.id, rating);
                      await props.onMutate();
                      props.setStatus({ kind: "ok", message: "Rating saved." });
                    } catch (e: any) {
                      props.setStatus({ kind: "error", message: e.message ?? "Failed to save rating" });
                    }
                  }}
                >
                  Save rating
                </button>
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                Ratings are stored in Postgres; photo list/detail responses are cached in Redis briefly for scalability.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

