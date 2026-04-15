import type { ReactNode } from 'react'

type Props = {
  variant?: 'error' | 'info' | 'success'
  children: ReactNode
  onDismiss?: () => void
}

export function AlertBanner({ variant = 'info', children, onDismiss }: Props) {
  const cls =
    variant === 'error'
      ? 'alertBanner alertBanner--error'
      : variant === 'success'
        ? 'alertBanner alertBanner--success'
        : 'alertBanner alertBanner--info'

  return (
    <div className={cls} role="status">
      <div className="alertBanner__icon" aria-hidden>
        {variant === 'error' ? '!' : variant === 'success' ? '✓' : 'i'}
      </div>
      <div className="alertBanner__text">{children}</div>
      {onDismiss ? (
        <button type="button" className="alertBanner__dismiss" onClick={onDismiss} aria-label="Bezárás">
          ×
        </button>
      ) : null}
    </div>
  )
}
