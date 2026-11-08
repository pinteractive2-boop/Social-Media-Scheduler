import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPost,
  deletePost,
  getAccountConnectUrl,
  getConnectedAccounts,
  getCurrentUser,
  getPostStatus,
  getPosts,
  loginUser,
  logoutUser,
  registerUser,
  updatePost,
} from './api.js';

const initialForm = {
  caption: '',
  platform: 'instagram',
  accountId: '',
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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    displayName: '',
  });
  const [accounts, setAccounts] = useState([]);
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

  const loadAccounts = useCallback(async () => {
    try {
      const result = await getConnectedAccounts();
      const nextAccounts = Array.isArray(result.accounts) ? result.accounts : [];
      setAccounts(nextAccounts);
      setForm((current) => {
        const accountIsAvailable = nextAccounts.some(
          (account) =>
            account.platform === current.platform &&
            account.accountId === current.accountId &&
            account.isActive,
        );
        const defaultAccount = nextAccounts.find(
          (account) => account.platform === current.platform && account.isActive,
        );
        return {
          ...current,
          accountId: accountIsAvailable ? current.accountId : defaultAccount?.accountId || '',
        };
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const result = await getCurrentUser();
        if (!active) return;
        setUser(result.user);
        await Promise.all([loadPosts(), loadAccounts()]);
      } catch (error) {
        if (!active) return;
        setUser(null);
        if (error.status !== 401) {
          setMessage({ type: 'error', text: error.message });
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, [loadAccounts, loadPosts]);

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
      accountId: post.accountId || '',
      scheduledAt: toLocalDateTime(post.scheduledAt),
    });
    setImage(null);
    setRemoveImage(false);
    setEditingId(post._id);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePlatformChange(platform) {
    const account = accounts.find(
      (item) => item.platform === platform && item.isActive,
    );
    setForm((current) => ({
      ...current,
      platform,
      accountId: account?.accountId || '',
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setMessage(null);
    try {
      const result = authMode === 'register'
        ? await registerUser(authForm)
        : await loginUser(authForm);
      setUser(result.user);
      setAuthForm({ email: '', password: '', displayName: '' });
      await Promise.all([loadPosts(), loadAccounts()]);
      setMessage({ type: 'success', text: authMode === 'register' ? 'Account created.' : 'Signed in.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      setUser(null);
      setPosts([]);
      setAccounts([]);
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  async function connectAccount(platform) {
    const popup = window.open('about:blank', '_blank');
    try {
      const result = await getAccountConnectUrl(platform);
      if (!popup) {
        setMessage({ type: 'error', text: 'Allow pop-ups to connect your account.' });
        return;
      }
      popup.opener = null;
      popup.location.href = result.authUrl;
      setMessage({
        type: 'success',
        text: `Finish connecting ${platform === 'instagram' ? 'Instagram' : 'LinkedIn'} in the new tab, then refresh accounts here.`,
      });
    } catch (error) {
      if (popup) popup.close();
      setMessage({ type: 'error', text: error.message });
    }
  }

  async function refreshPostStatus(post) {
    try {
      const result = await getPostStatus(post._id);
      setPosts((current) =>
        current.map((item) =>
          item._id === post._id
            ? {
                ...item,
                status: result.status,
                publishedAt: result.publishedAt,
                publishingResponse: result.publishingResponse,
              }
            : item,
        ),
      );
      setMessage({ type: 'success', text: `Post status: ${result.status}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
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
    const currentPost = posts.find((post) => post._id === editingId);
    if (
      form.platform === 'instagram' &&
      !image &&
      !currentPost?.imageUrl
    ) {
      setMessage({ type: 'error', text: 'Instagram posts require an image.' });
      return;
    }
    if (!form.accountId) {
      setMessage({ type: 'error', text: 'Connect an account for the selected platform first.' });
      return;
    }

    const post = {
      caption: form.caption.trim(),
      platform: form.platform,
      accountId: form.accountId,
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
        {user ? (
          <div className="topbar-actions">
            <span className="topbar-note">{user.email}</span>
            <button type="button" className="text-button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        ) : (
          <span className="topbar-note">
            <span className="live-dot" aria-hidden="true" />
            Your publishing workspace
          </span>
        )}
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

      {authLoading ? (
        <div className="empty-state panel auth-loading">
          <span className="loader" />
          <p>Checking your account…</p>
        </div>
      ) : !user ? (
        <section className="auth-panel panel">
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h2>{authMode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-copy">
            Sign in to manage your own connected social accounts and scheduled posts.
          </p>
          <form className="post-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <>
                <label className="field-label" htmlFor="displayName">Name <span className="optional">(optional)</span></label>
                <input
                  id="displayName"
                  type="text"
                  maxLength="80"
                  value={authForm.displayName}
                  onChange={(event) => setAuthForm({ ...authForm, displayName: event.target.value })}
                  autoComplete="name"
                />
              </>
            )}
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
            />
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              minLength="8"
              maxLength="72"
              required
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
            />
            <button className="primary-button submit-button" type="submit">
              {authMode === 'register' ? 'Create account' : 'Sign in'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <button
            type="button"
            className="text-button auth-switch"
            onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
          >
            {authMode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </section>
      ) : (
      <>
      <section className="accounts-panel panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SOCIAL ACCOUNTS</p>
            <h2>Connected accounts</h2>
          </div>
          <button className="refresh-button" type="button" onClick={loadAccounts}>
            Refresh
          </button>
        </div>
        <div className="account-controls">
          <button className="secondary-button" type="button" onClick={() => connectAccount('instagram')}>
            Connect Instagram
          </button>
          <button className="secondary-button" type="button" onClick={() => connectAccount('linkedin')}>
            Connect LinkedIn
          </button>
        </div>
        <p className="publishing-note">
          Instagram requires a Business or Creator account. Zernio schedules and publishes posts on your behalf.
        </p>
        {accounts.length > 0 && (
          <ul className="account-list">
            {accounts.map((account) => (
              <li key={account.accountId}>
                <span>{account.platform === 'instagram' ? 'Instagram' : 'LinkedIn'}</span>
                <span>{account.username || account.accountId}</span>
                <StatusBadge status={account.isActive ? 'connected' : 'failed'} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  onChange={(event) => handlePlatformChange(event.target.value)}
                >
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="accountId">Connected account</label>
                <select
                  id="accountId"
                  value={form.accountId}
                  onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                  required
                >
                  <option value="">Choose an account</option>
                  {accounts
                    .filter((account) => account.platform === form.platform && account.isActive)
                    .map((account) => (
                      <option key={account.accountId} value={account.accountId}>
                        {account.username || account.accountId}
                      </option>
                    ))}
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
              <label className="field-label" htmlFor="image">Image <span className="optional">{form.platform === 'instagram' ? '(required)' : '(optional)'}</span></label>
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
            <p className="publishing-note">
              Scheduled posts are submitted to Zernio. This app checks publishing status every minute.
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
                const canEdit = post.status === 'pending';
                const canDelete = post.status === 'pending' || post.status === 'failed';
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
                      <div className="post-actions">
                        {post.providerPostId && (
                          <button type="button" className="text-button" onClick={() => refreshPostStatus(post)}>
                            Check status
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" className="icon-button" onClick={() => editPost(post)} aria-label="Edit post">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="icon-button delete-button" onClick={() => handleDelete(post)} aria-label="Delete post">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
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
      </>
   )}
     </main>
  );
}

export default App;
