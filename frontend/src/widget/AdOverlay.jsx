/**
 * AdOverlay — affiche la barre de progression de la pub,
 * le badge "Publicité", le compte à rebours et le bouton skip.
 * Rendu uniquement pendant adState === 'loading' | 'playing'.
 */
export default function AdOverlay({
  adState,
  adProgress,
  adRemaining,
  adClickUrl,
  adSkipOffset,
  canSkip,
  skipCountdown,
  onSkip,
}) {
  return (
    <div className="dv-ad-overlay">
      {/* Barre de progression orange */}
      <div className="dv-ad-bar">
        <div className="dv-ad-fill" style={{ width: `${adProgress}%` }} />
      </div>

      <div className="dv-ad-meta">
        {/* Badge "Publicité" cliquable si clickThrough défini */}
        <span className="dv-ad-badge">
          {adClickUrl
            ? <a href={adClickUrl} target="_blank" rel="noreferrer" className="dv-ad-link">Publicité</a>
            : 'Publicité'}
        </span>

        <div className="dv-ad-right">
          {/* Compte à rebours durée restante */}
          {adRemaining !== null && (
            <span className="dv-ad-remaining">
              {adState === 'loading' ? '…' : `${adRemaining}s`}
            </span>
          )}

          {/* Bouton skip — visible uniquement si skipoffset défini dans le VAST */}
          {adSkipOffset !== null && (
            <button
              className={`dv-skip-btn ${canSkip ? 'dv-skip-btn--ready' : ''}`}
              onClick={onSkip}
              disabled={!canSkip}
            >
              {canSkip ? 'Passer ›' : `Passer dans ${skipCountdown}s`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
