import { useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { isFirebaseConfigured } from '../firebase';
import { slugify, isValidSlug } from '../utils/slugify';
import { isSlugTaken } from '../utils/firebaseSync';

interface Props {
  onClose: () => void;
}

export default function GoLiveModal({ onClose }: Props) {
  const { tournamentName, liveSlug, isLive, goLive, setTournamentName } = useTournamentStore();

  const [nameInput, setNameInput] = useState(tournamentName);
  const [slug, setSlug] = useState(liveSlug ?? slugify(tournamentName));
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'publishing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleNameChange = (v: string) => {
    setNameInput(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(slugify(v) || v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugEdited(true);
  };

  const shareUrl = `${window.location.origin}/v/${slug}`;
  const canPublish = isValidSlug(slug) && nameInput.trim() !== '';

  const handlePublish = async () => {
    if (!canPublish) return;
    setStatus('checking');
    setErrorMsg('');

    // Only check for slug conflicts if this is a NEW slug (not re-publishing same one)
    if (slug !== liveSlug) {
      const taken = await isSlugTaken(slug);
      if (taken) {
        setErrorMsg(`"${slug}" is already taken — try a different name.`);
        setStatus('error');
        return;
      }
    }

    try {
      setStatus('publishing');
      setTournamentName(nameInput.trim());
      await goLive(slug);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  };

  const copyLink = () => navigator.clipboard.writeText(shareUrl);

  if (!isFirebaseConfigured) {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center space-y-4 py-2">
          <div className="text-4xl">🔧</div>
          <h2 className="text-lg font-bold text-gray-800">Firebase Not Configured</h2>
          <p className="text-sm text-gray-500 text-left">
            To enable live sharing, add your Firebase credentials to{' '}
            <code className="bg-gray-100 px-1 rounded">.env.local</code>:
          </p>
          <pre className="text-left text-xs bg-gray-900 text-green-400 rounded-xl p-3 overflow-x-auto">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...`}
          </pre>
          <p className="text-xs text-gray-400">
            See <strong>DEPLOY.md</strong> in the project root for step-by-step instructions.
          </p>
          <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-semibold">
            Close
          </button>
        </div>
      </ModalShell>
    );
  }

  if (status === 'done') {
    return (
      <ModalShell onClose={onClose}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🔴</div>
            <h2 className="text-lg font-bold text-gray-800">You're Live!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Share this link — it updates in real-time as you enter results.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">
              Read-only spectator link
            </p>
            <p className="text-sm font-mono text-gray-800 break-all">{shareUrl}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-2xl active:scale-95 transition-transform"
            >
              📋 Copy Link
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-semibold rounded-2xl"
            >
              Done
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="text-2xl mb-1">📡</div>
          <h2 className="text-lg font-bold text-gray-800">Share Live Bracket</h2>
          <p className="text-sm text-gray-500">
            Give your tournament a name — spectators open a read-only link that
            updates in real-time as you enter results.
          </p>
        </div>

        {/* Tournament name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Tournament Name
          </label>
          <input
            type="text"
            placeholder="e.g. Padel Palooza"
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            URL Slug
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
            <span className="px-3 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 py-3 shrink-0">
              /v/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="flex-1 px-3 py-3 text-sm focus:outline-none"
              placeholder="padelpalooza"
            />
          </div>
          {slug && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {shareUrl}
            </p>
          )}
          {slug && !isValidSlug(slug) && (
            <p className="text-xs text-red-500 mt-1">
              Slug must be lowercase letters, numbers, and dashes only.
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {isLive && liveSlug && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-700">
            Already live at <strong>/v/{liveSlug}</strong>. Publishing again will overwrite it.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePublish}
            disabled={!canPublish || status === 'checking' || status === 'publishing'}
            className={`flex-1 py-3.5 font-bold rounded-2xl transition-all ${
              canPublish
                ? 'bg-green-600 text-white active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {status === 'checking'
              ? 'Checking...'
              : status === 'publishing'
              ? 'Publishing...'
              : '🔴 Go Live'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-semibold rounded-2xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg px-5 pt-4 pb-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>
  );
}
