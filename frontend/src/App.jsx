import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPost, deletePost, getPosts, updatePost } from './api.js';

const initialForm = {
  caption: '',
  platform: 'instagram',
  scheduledAt: '',
};
const maxImageSize = 4 * 1024 * 1024;

function toLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return 'Not published yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function safeImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status || 'unknown'}`}>
      <span className="status-dot" aria-hidden="true" />
      {status || 'unknown'}
    </span>
  );
}

function App() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPosts();
      setPosts(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const orderedPosts = useMemo(
    () =>
      [...posts].sort(
        (first, second) =>
          new Date(first.scheduledAt).getTime() -
          new Date(second.scheduledAt).getTime(),
      ),
    [posts],
  );

  function resetForm() {
    setForm(initialForm);
    setImage(null);
    setRemoveImage(false);
    setEditingId(null);
  }

  function editPost(post) {
    setForm({
      caption: post.caption || '',
      platform: post.platform || 'instagram',
      scheduledAt: toLocalDateTime(post.scheduledAt),
    });
    setImage(null);
    setRemoveImage(false);
    setEditingId(post._id);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleImageChange(event) {
    const selectedImage = event.target.files?.[0] || null;
    if (!selectedImage) {
      setImage(null);
      return;
    }

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(selectedImage.type)) {
      event.target.value = '';
      setImage(null);
      setMessage({ type: 'error', text: 'Choose a JPG, PNG, or WEBP image.' });
      return;
    }

    if (selectedImage.size > maxImageSize) {
      event.target.value = '';
      setImage(null);
      setMessage({ type: 'error', text: 'Image must be 4 MB or smaller for Vercel upload.' });
      return;
    }

    setImage(selectedImage);
    setRemoveImage(false);
    setMessage(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    if (!form.scheduledAt) {
      setMessage({ type: 'error', text: 'Choose a scheduled date and time.' });
      return;
    }

    const post = {
      caption: form.caption.trim(),
      platform: form.platform,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updatePost(editingId, post, image, removeImage);
        setMessage({ type: 'success', text: 'Post updated.' });
      } else {
        await createPost(post, image);
        setMessage({ type: 'success', text: 'Post scheduled.' });
      }
      resetForm();
      await loadPosts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post) {
    if (!window.confirm('Delete this pending post?')) return;

    setMessage(null);
    try {
      const result = await deletePost(post._id);
      setMessage({
        type: result.warning ? 'error' : 'success',
        text: result.warning || 'Post deleted.',
      });
      await loadPosts();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Social Scheduler home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v12.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V5.75Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path d="M8 7.5h8M8 11h5M8 14.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>social<span className="brand-light">scheduler</span></span>
        </a>
        <span className="topbar-note">
          <span className="live-dot" aria-hidden="true" />
          Your publishing workspace
        </span>
      </header>

      <section className="intro">
        <p className="eyebrow">PLAN · SCHEDULE · PUBLISH</p>
        <h1>Make room for<br /><span>good content.</span></h1>
        <p className="intro-copy">
          Keep your social posts organized and ready for their moment.
        </p>
      </section>

      {message && (
        <div className={`notice notice-${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button
            type="button"
            className="notice-close"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="workspace">
        <section className="composer panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingId ? 'POST DETAILS' : 'NEW POST'}</p>
              <h2>{editingId ? 'Edit your post' : 'Create a post'}</h2>
            </div>
            {editingId && (
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="post-form">
            <label className="field-label" htmlFor="caption">Caption</label>
            <textarea
              id="caption"
              value={form.caption}
              onChange={(event) => setForm({ ...form, caption: event.target.value })}
              placeholder="What would you like to share?"
              rows="5"
              required
            />
            <div className="field-meta">
              <span>Write a caption that feels like you.</span>
              <span>{form.caption.length} characters</span>
            </div>

            <div className="form-grid">
              <div>
                <label className="field-label" htmlFor="platform">Platform</label>
                <select
                  id="platform"
                  value={form.platform}
                  onChange={(event) => setForm({ ...form, platform: event.target.value })}
                >
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="scheduledAt">Date &amp; time</label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="upload-field">
              <label className="field-label" htmlFor="image">Image <span className="optional">(optional)</span></label>
              <label className="file-picker" htmlFor="image">
                <span className="upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <strong>{image ? image.name : 'Choose an image'}</strong>
                  <small>JPG, PNG or WEBP · max 4 MB</small>
                </span>
                <span className="browse-button">Browse</span>
              </label>
              <input
                className="visually-hidden"
                id="image"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
              />
              {editingId && posts.find((post) => post._id === editingId)?.imageUrl && !image && (
                <label className="remove-image">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    onChange={(event) => setRemoveImage(event.target.checked)}
                  />
                  Remove current image
                </label>
              )}
            </div>

            <button className="primary-button submit-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Schedule post'}
              {!saving && <span aria-hidden="true">→</span>}
            </button>
            <p className="mock-note">
              Posts are saved to your schedule. Publishing is simulated by the backend.
            </p>
          </form>
        </section>

        <section className="posts-section">
          <div className="section-heading posts-heading">
            <div>
              <p className="eyebrow">YOUR CONTENT</p>
              <h2>Scheduled posts <span className="count-pill">{posts.length}</span></h2>
            </div>
            <button className="refresh-button" type="button" onClick={loadPosts} disabled={loading}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 7v5h-5M4.6 9a7.5 7.5 0 0 1 12.7-2L20 12M4 17v-5h5m10.4 3a7.5 7.5 0 0 1-12.7 2L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="empty-state panel">
              <span className="loader" />
              <p>Loading your posts…</p>
            </div>
          ) : orderedPosts.length === 0 ? (
            <div className="empty-state panel">
              <span className="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v12.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V5.75Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <h3>A clear calendar.</h3>
              <p>Your scheduled posts will show up here.</p>
            </div>
          ) : (
            <div className="post-list">
              {orderedPosts.map((post) => {
                const imageUrl = safeImageUrl(post.imageUrl);
                const canManage = post.status === 'pending';
                return (
                  <article className="post-card panel" key={post._id}>
                    <div className="post-card-top">
                      <div className="platform-label">
                        <span className={`platform-mark platform-${post.platform}`} aria-hidden="true">
                          {post.platform === 'instagram' ? 'ig' : 'in'}
                        </span>
                        <span>{post.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}</span>
                      </div>
                      <StatusBadge status={post.status} />
                    </div>
                    <div className="post-content">
                      {imageUrl && <img className="post-image" src={imageUrl} alt="Post attachment" />}
                      <p className="post-caption">{post.caption}</p>
                    </div>
                    <div className="post-card-bottom">
                      <div className="schedule-label">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h3v3H8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{formatDate(post.scheduledAt)}</span>
                      </div>
                      {canManage && (
                        <div className="post-actions">
                          <button type="button" className="icon-button" onClick={() => editPost(post)} aria-label="Edit post">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button type="button" className="icon-button delete-button" onClick={() => handleDelete(post)} aria-label="Delete post">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {post.publishingResponse?.message && (
                      <p className="publish-note">{post.publishingResponse.message}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <footer className="footer">
        <span>Made for thoughtful scheduling.</span>
        <span>Social Scheduler <span className="footer-dot">·</span> v1.0</span>
      </footer>
    </main>
  );
}

export default App;
