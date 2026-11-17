
import { useMemo, useState } from 'react'
import type { Monitor, SessionRequestForm } from '../../types/monitoring'

import { filterMonitors } from '../../utils/search'
import { useToast } from '../../hooks/useToast'

import {
  monitors,
  studentNotifications,
} from '../../data/studentMock'

import DashboardLayout from '../../components/layout/DashboardLayout/DashboardLayout'
import PageHero from '../../components/layout/PageHero/PageHero'
import Card from '../../components/shared/Card/Card'
import EmptyState from '../../components/shared/EmptyState/EmptyState'
import Toast from '../../components/shared/Toast/Toast'

import SearchFilters from '../../components/estudiante/SearchFilters/SearchFilters'
import MonitorCard from '../../components/estudiante/monitorCard/monitorCard'
import RequestModal from '../../components/estudiante/RequestModal'

import './StudentSearchPage.css'

const QUICK_SUBJECTS = [
  'Cálculo',
  'Programación',
  'Álgebra',
  'Microeconomía',
]

function StudentSearchPage() {
  const { message, visible, showToast } = useToast()

  // Filtros de búsqueda
  const [query, setQuery] = useState('')
  const [queryTags, setQueryTags] = useState<string[]>([])
  const [modality, setModality] = useState('')
  const [minRating, setMinRating] = useState('')
  const [sort, setSort] = useState('best')

  // Horario seleccionado
  const [selection, setSelection] = useState<{
    monitorId: number
    slot: string
  } | null>(null)

  // Monitor y horario para reservar
  const [requesting, setRequesting] = useState<{
    monitor: Monitor
    slot: string
  } | null>(null)

  // Agregar búsqueda
  const handleQuerySubmit = (searchValue?: string) => {
    const value = (searchValue ?? query).trim()

    if (!value) return

    setQueryTags((previous) =>
      previous.some(
        (tag) => tag.toLowerCase() === value.toLowerCase()
      )
        ? previous
        : [...previous, value]
    )

    setQuery('')
  }

  // Eliminar búsqueda aplicada
  const handleRemoveQueryTag = (tag: string) => {
    setQueryTags((previous) =>
      previous.filter((item) => item !== tag)
    )
  }

  // Limpiar todos los filtros
  const clearFilters = () => {
    setQuery('')
    setQueryTags([])
    setModality('')
    setMinRating('')
    setSort('best')
    setSelection(null)
  }

  // Obtener resultados
  const results = useMemo(() => {
    return filterMonitors(monitors, {
      query: queryTags.join(' '),
      modality,
      minRating,
      sort,
    })
  }, [queryTags, modality, minRating, sort])

  // Seleccionar o deseleccionar horario
  const handleSelectSlot = (monitorId: number, slot: string) => {
    const same =
      selection?.monitorId === monitorId &&
      selection.slot === slot

    setSelection(same ? null : { monitorId, slot })
  }

  // Enviar solicitud de tutoría
  const handleSubmitRequest = (_data: SessionRequestForm) => {
    if (!requesting) return

    showToast(
      `Solicitud enviada a ${requesting.monitor.name} para ${requesting.slot} ✅`
    )

    setRequesting(null)
    setSelection(null)
  }

  return (
    <DashboardLayout
      role="estudiante"
      notifications={studentNotifications}
    >
      <div className="student-search-page">

        {/* HERO: misma estructura que las demás páginas */}
        <PageHero
          title="Encuentra tu monitor"
          description="Busca monitores por materia, tema, modalidad y disponibilidad."
        />

        {/* BUSCADOR Y FILTROS */}
        <section className="student-search-page__filters">
          <SearchFilters
            query={query}
            onQueryChange={setQuery}
            onQuerySubmit={handleQuerySubmit}
            queryTags={queryTags}
            onRemoveQueryTag={handleRemoveQueryTag}
            modality={modality}
            onModalityChange={setModality}
            minRating={minRating}
            onMinRatingChange={setMinRating}
            sort={sort}
            onSortChange={setSort}
            quickSubjects={QUICK_SUBJECTS}
          />
        </section>

        {/* RESULTADOS */}
        <section className="student-search-page__results">
          <Card
            title="Monitores disponibles"
            subtitle={`${results.length} monitor${results.length !== 1 ? 'es' : ''} encontrado${results.length !== 1 ? 's' : ''}`}
          >
            {results.length === 0 ? (
              <EmptyState
                title="No encontramos monitores"
                message="Prueba con otra búsqueda o modifica los filtros."
                actionLabel="Ver todos los monitores"
                onAction={clearFilters}
              />
            ) : (
              <div className="student-search-page__list">
                {results.map((monitor) => (
                  <MonitorCard
                    key={monitor.id}
                    monitor={monitor}
                    selectedSlot={
                      selection?.monitorId === monitor.id
                        ? selection.slot
                        : null
                    }
                    onSelectSlot={(slot) =>
                      handleSelectSlot(monitor.id, slot)
                    }
                    onReserve={() => {
                      if (selection?.monitorId === monitor.id) {
                        setRequesting({
                          monitor,
                          slot: selection.slot,
                        })
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>

      {/* MODAL DE RESERVA */}
      {requesting && (
        <RequestModal
          monitor={requesting.monitor}
          slot={requesting.slot}
          onClose={() => setRequesting(null)}
          onSubmit={handleSubmitRequest}
        />
      )}

      <Toast message={message} visible={visible} />
    </DashboardLayout>
  )
}

export default StudentSearchPage
