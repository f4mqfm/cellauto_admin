import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  children?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** danger = piros megerősítő gomb */
  tone?: 'danger' | 'primary' | 'neutral'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Mégse',
  tone = 'neutral',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmClass =
    tone === 'danger' ? 'primary confirmModal__btnDanger' : tone === 'primary' ? 'primary' : 'counter'

  return (
    <div
      className="confirmModal__root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="confirmModal__backdrop" aria-hidden />
      <div
        className="confirmModal__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmModalTitle"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirmModalTitle" className="confirmModal__title">
          {title}
        </h3>
        {children ? <div className="confirmModal__body">{children}</div> : null}
        <div className="confirmModal__actions">
          <button type="button" className="counter" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={busy}>
            {busy ? 'Kérjük várj…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
