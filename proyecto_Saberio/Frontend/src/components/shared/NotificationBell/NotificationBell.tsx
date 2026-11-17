
import { useEffect, useRef, useState } from 'react'
import type { AppNotification } from '../../../types/notification'
import './NotificationBell.css'

interface NotificationBellProps {
  notifications: AppNotification[]
}

function NotificationIcon({
  type,
}: {
  type: AppNotification['type']
}) {
  const commonProps = {
    width: 23,
    height: 23,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (type) {
    case 'request':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )

    case 'success':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      )

    case 'warning':
      return (
        <svg {...commonProps}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      )

    default:
      return null
  }
}

function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cierra el panel con clic afuera o con Escape.
  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="bell__button"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <svg
          className="mi-campana"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {notifications.length > 0 && (
          <i>{notifications.length}</i>
        )}
      </button>

      {open && (
        <div className="bell__panel">
          <header>
            <h4>Notificaciones</h4>

            <button
              type="button"
              aria-label="Cerrar notificaciones"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>

          <div className="bell__list">
            {notifications.length === 0 && (
              <p className="bell__empty">
                No tienes notificaciones.
              </p>
            )}

            {notifications.map((notification) => (
              <div className="bell__item" key={notification.id}>
                <span
                  className={`bell__icon bell__icon--${notification.type}`}
                >
                  <NotificationIcon type={notification.type} />
                </span>

                <div>
                  <b>{notification.title}</b>
                  <p>{notification.text}</p>
                </div>

                <time>{notification.time}</time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
