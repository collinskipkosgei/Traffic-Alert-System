import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaCheckCircle, FaExclamationCircle, FaMapMarkerAlt, FaSpinner } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { locationService, mpesaService, paymentService } from '../services/api'
import { useAuth } from '../AuthContext'
import { addJourneySegment, formatCoordsLabel, type LatLng } from '../utils/geo'
import './TollPayment.css'

type Tx = {
  transactionId: string
  status: 'pending' | 'completed' | 'failed'
  paymentMethod?: 'mpesa' | 'cash'
  mpesaReceiptNumber?: string
  checkoutRequestID?: string
  /** Set when polling stops without a success/failure from M-Pesa */
  pendingStale?: boolean
  failureReason?: string
}

const STATUS_LABEL: Record<Tx['status'], string> = {
  pending: 'Pending',
  failed: 'Failed',
  completed: 'Successful',
}

type PaymentHistoryEntry = {
  checkoutRequestID: string
  paymentMethod?: 'mpesa' | 'cash'
  amountKes: number
  tollId: string
  tollName: string
  vehicleRegistration: string
  routeFrom: string
  routeTo: string
  distanceKm: string
  mpesaReceiptNumber?: string
  paidAt: string
  /** Defaults to completed for rows saved before this field existed */
  status?: 'completed' | 'failed' | 'pending'
  failureReason?: string
  /** When status is pending: usually timeout without final M-Pesa result */
  pendingNote?: string
  rating?: number
  review?: string
  reviewedAt?: string
}

const HISTORY_PREFIX = 'tas_mpesa_payment_history_v1'
const GLOBAL_REVIEWS_KEY = 'tas_global_payment_reviews_v1'

function historyStorageKey(email: string | undefined) {
  return `${HISTORY_PREFIX}_${email || 'guest'}`
}

function loadHistory(email: string | undefined): PaymentHistoryEntry[] {
  try {
    const raw = localStorage.getItem(historyStorageKey(email))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => {
      const r = row as PaymentHistoryEntry
      return {
        ...r,
        status: r.status ?? 'completed',
        paymentMethod: r.paymentMethod ?? 'mpesa',
      }
    })
  } catch {
    return []
  }
}

function saveHistory(email: string | undefined, entries: PaymentHistoryEntry[]) {
  localStorage.setItem(historyStorageKey(email), JSON.stringify(entries))
}

function loadGlobalReviews(): PaymentHistoryEntry[] {
  try {
    const raw = localStorage.getItem(GLOBAL_REVIEWS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as PaymentHistoryEntry[]
  } catch {
    return []
  }
}

function saveGlobalReviews(entries: PaymentHistoryEntry[]) {
  localStorage.setItem(GLOBAL_REVIEWS_KEY, JSON.stringify(entries))
}

/** Daraja often returns the receipt inside CallbackMetadata.Item, not as a top-level field. */
function extractMpesaReceiptFromStatusPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const d = payload as Record<string, unknown>
  const top = d.MpesaReceiptNumber
  if (top != null && String(top).trim() !== '') return String(top)

  const meta = d.CallbackMetadata as { Item?: unknown } | undefined
  if (meta?.Item != null) {
    const items = Array.isArray(meta.Item) ? meta.Item : [meta.Item]
    for (const item of items) {
      if (item && typeof item === 'object' && 'Name' in item && 'Value' in item) {
        const o = item as { Name: string; Value: unknown }
        if (o.Name === 'MpesaReceiptNumber' || o.Name === 'ReceiptNo') {
          if (o.Value != null && String(o.Value).trim() !== '') return String(o.Value)
        }
      }
    }
  }

  const rpWrap = d.ResultParameters as { ResultParameter?: unknown } | undefined
  if (rpWrap?.ResultParameter != null) {
    const list = Array.isArray(rpWrap.ResultParameter)
      ? rpWrap.ResultParameter
      : [rpWrap.ResultParameter]
    for (const p of list) {
      if (p && typeof p === 'object' && 'Name' in p && 'Value' in p) {
        const x = p as { Name: string; Value: unknown }
        if (x.Name === 'MpesaReceiptNumber' || x.Name === 'ReceiptNo') {
          if (x.Value != null && String(x.Value).trim() !== '') return String(x.Value)
        }
      }
    }
  }

  return undefined
}

async function resolveReceiptAfterSuccess(
  checkoutRequestID: string,
  initialPayload: unknown,
): Promise<string | undefined> {
  let receipt =
    extractMpesaReceiptFromStatusPayload(initialPayload) ??
    (initialPayload as { MpesaReceiptNumber?: string })?.MpesaReceiptNumber
  if (receipt) return String(receipt)

  for (const delayMs of [1800, 3200]) {
    await new Promise((r) => setTimeout(r, delayMs))
    try {
      const res = await mpesaService.checkStatus(checkoutRequestID)
      receipt =
        extractMpesaReceiptFromStatusPayload(res.data) ??
        (res.data as { MpesaReceiptNumber?: string })?.MpesaReceiptNumber
      if (receipt) return String(receipt)
    } catch {
      /* status call failed; try next delay */
    }
  }
  return undefined
}

export default function TollPayment() {
  const { user } = useAuth()
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([])
  const historyRecordedCheckoutIdsRef = useRef<Set<string>>(new Set())
  const serverRecordedCheckoutIdsRef = useRef<Set<string>>(new Set())
  const [paymentData, setPaymentData] = useState({
    tollId: '',
    tollName: '',
    paymentMethod: 'mpesa' as 'mpesa' | 'cash',
    phoneNumber: '',
    amount: '',
    vehicleRegistration: '',
    route: {
      from: '',
      to: '',
    },
  })
  const [paymentMode, setPaymentMode] = useState<'quick' | 'live'>('quick')
  const [journeyActive, setJourneyActive] = useState(false)
  const [trackedDistanceKm, setTrackedDistanceKm] = useState(0)
  const [journeyOrigin, setJourneyOrigin] = useState<LatLng | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [startingJourney, setStartingJourney] = useState(false)
  const lastJourneyPointRef = useRef<LatLng | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [transaction, setTransaction] = useState<Tx | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState('')

  const tolls = [
    {
      id: 'nrb_exp_1',
      name: 'Nairobi Expressway - Mlolongo to Westlands',
      baseFee: 1,
      perKm: 1,
      entryLabel: 'Mlolongo Entry',
      exitLabel: 'Westlands Exit',
    },
    {
      id: 'nrb_exp_2',
      name: 'Nairobi Expressway - Westlands to Mlolongo',
      baseFee: 80,
      perKm: 18,
      entryLabel: 'Westlands Entry',
      exitLabel: 'Mlolongo Exit',
    },
    {
      id: 'nrb_exp_3',
      name: 'Nairobi Expressway - JKIA to Westlands',
      baseFee: 100,
      perKm: 20,
      entryLabel: 'JKIA Entry',
      exitLabel: 'Westlands Exit',
    },
    {
      id: 'msa_corr_1',
      name: 'Mombasa-Mariakani Corridor',
      baseFee: 60,
      perKm: 15,
      entryLabel: 'Mombasa Entry',
      exitLabel: 'Mariakani Exit',
    },
  ]

  const selectedToll = useMemo(
    () => tolls.find((t) => t.id === paymentData.tollId) || null,
    [paymentData.tollId],
  )

  const computedAmount = useMemo(() => {
    if (!selectedToll) return 0
    if (trackedDistanceKm <= 0) return selectedToll.baseFee
    return Math.round(selectedToll.baseFee + trackedDistanceKm * selectedToll.perKm)
  }, [selectedToll, trackedDistanceKm])

  const trackedDistanceLabel = trackedDistanceKm.toFixed(2)

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  function stopJourneyTracking() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  async function startJourney() {
    if (!paymentData.tollId) {
      toast.error('Please select a toll road first')
      return
    }
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported on this device')
      return
    }

    setStartingJourney(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const start: LatLng = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        const selected = tolls.find((t) => t.id === paymentData.tollId)

        setJourneyOrigin(start)
        setTrackedDistanceKm(0)
        lastJourneyPointRef.current = start
        setJourneyActive(true)
        setPaymentData((prev) => ({
          ...prev,
          route: {
            from: formatCoordsLabel(start),
            to: selected?.exitLabel || prev.route.to,
          },
        }))

        void locationService.update({
          latitude: start.latitude,
          longitude: start.longitude,
          isActive: true,
        })

        stopJourneyTracking()
        watchIdRef.current = navigator.geolocation.watchPosition(
          (nextPosition) => {
            const next: LatLng = {
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
            }

            setTrackedDistanceKm((current) => {
              const updated = addJourneySegment(current, lastJourneyPointRef.current, next)
              lastJourneyPointRef.current = updated.previous
              return updated.totalKm
            })

            void locationService.update({
              latitude: next.latitude,
              longitude: next.longitude,
              isActive: true,
            })
          },
          (geoError) => {
            setLocationError(geoError.message || 'Lost GPS signal during journey')
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
        )

        toast.success('Journey started. Distance is now tracked from your live location.')
        setStartingJourney(false)
      },
      (geoError) => {
        setLocationError(geoError.message || 'Unable to access your location')
        toast.error('Allow location access to start your journey')
        setStartingJourney(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  }

  function endJourney() {
    stopJourneyTracking()
    setJourneyActive(false)
    toast.success(`Journey ended. Distance covered: ${trackedDistanceLabel} km`)
  }

  useEffect(() => {
    const rows = loadHistory(user?.email)
    setPaymentHistory(rows)
    historyRecordedCheckoutIdsRef.current = new Set(rows.map((r) => r.checkoutRequestID))
  }, [user?.email])

  useEffect(() => {
    if (!transaction?.checkoutRequestID) return
    const id = transaction.checkoutRequestID
    if (historyRecordedCheckoutIdsRef.current.has(id)) return
    if (transaction.status === 'pending' && !transaction.pendingStale) return

    const paidAt = new Date().toISOString()
    const base = {
      checkoutRequestID: id,
      paymentMethod: transaction.paymentMethod ?? 'mpesa',
      amountKes: computedAmount,
      tollId: paymentData.tollId,
      tollName: paymentData.tollName,
      vehicleRegistration: paymentData.vehicleRegistration,
      routeFrom: paymentData.route.from,
      routeTo: paymentData.route.to,
      distanceKm: trackedDistanceLabel,
      paidAt,
    }

    let entry: PaymentHistoryEntry | null = null
    if (transaction.status === 'completed') {
      entry = {
        ...base,
        status: 'completed',
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      }
    } else if (transaction.status === 'failed') {
      entry = {
        ...base,
        status: 'failed',
        failureReason: transaction.failureReason,
      }
    } else if (transaction.status === 'pending' && transaction.pendingStale) {
      entry = {
        ...base,
        status: 'pending',
        pendingNote:
          'No final status from M-Pesa before timeout. Check your SMS or balance, or try paying again.',
      }
    }

    if (!entry) return

    historyRecordedCheckoutIdsRef.current.add(id)
    const prev = loadHistory(user?.email)
    const existingIndex = prev.findIndex((p) => p.checkoutRequestID === id)
    if (existingIndex >= 0) {
      // If receipt arrives after initial save, backfill it into existing history row.
      if (
        transaction.status === 'completed' &&
        transaction.mpesaReceiptNumber &&
        !prev[existingIndex].mpesaReceiptNumber
      ) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          mpesaReceiptNumber: transaction.mpesaReceiptNumber,
        }
        saveHistory(user?.email, updated)
        setPaymentHistory(updated)
        return
      }
      setPaymentHistory(prev)
      return
    }
    const next = [entry, ...prev].slice(0, 50)
    saveHistory(user?.email, next)
    setPaymentHistory(next)

    if (!serverRecordedCheckoutIdsRef.current.has(id)) {
      serverRecordedCheckoutIdsRef.current.add(id)
      void paymentService.recordPayment(entry).catch(() => {
        serverRecordedCheckoutIdsRef.current.delete(id)
      })
    }
  }, [
    transaction,
    user?.email,
    computedAmount,
    paymentData.tollId,
    paymentData.tollName,
    paymentData.vehicleRegistration,
    paymentData.route.from,
    paymentData.route.to,
    trackedDistanceLabel,
  ])

  const formatPaidAt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  const hasReviewForCurrentTransaction = useMemo(() => {
    const id = transaction?.checkoutRequestID
    if (!id) return false
    const row = paymentHistory.find((h) => h.checkoutRequestID === id)
    return Boolean(row?.rating || row?.review)
  }, [transaction?.checkoutRequestID, paymentHistory])

  const handleTollSelect = (toll: {
    id: string
    name: string
    entryLabel: string
    exitLabel: string
  }) => {
    if (journeyActive) {
      toast.error('End your current journey before selecting a different toll route')
      return
    }

    setPaymentData((prev) => ({
      ...prev,
      tollId: toll.id,
      tollName: toll.name,
      route: {
        from: paymentMode === 'quick' ? toll.entryLabel : prev.route.from,
        to: toll.exitLabel,
      },
    }))
  }

  const handlePaymentModeChange = (mode: 'quick' | 'live') => {
    if (mode === paymentMode) return

    if (mode === 'quick' && journeyActive) {
      stopJourneyTracking()
      setJourneyActive(false)
      setJourneyOrigin(null)
      setTrackedDistanceKm(0)
      lastJourneyPointRef.current = null
    }

    setPaymentMode(mode)

    if (mode === 'quick' && paymentData.tollId) {
      const toll = tolls.find((t) => t.id === paymentData.tollId)
      if (toll) {
        setPaymentData((prev) => ({
          ...prev,
          route: {
            from: toll.entryLabel,
            to: toll.exitLabel,
          },
        }))
      }
    } else if (mode === 'live') {
      setPaymentData((prev) => ({
        ...prev,
        route: {
          from: journeyOrigin ? formatCoordsLabel(journeyOrigin) : '',
          to: tolls.find((t) => t.id === prev.tollId)?.exitLabel || prev.route.to,
        },
      }))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.startsWith('route.')) {
      const routeField = name.split('.')[1] as 'from' | 'to'
      setPaymentData((prev) => ({
        ...prev,
        route: { ...prev.route, [routeField]: value },
      }))
    } else {
      setPaymentData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const pollMpesaStatus = (checkoutRequestID: string) => {
    let tries = 0
    const interval = window.setInterval(() => {
      void (async () => {
        tries += 1
        try {
          const res = await mpesaService.checkStatus(checkoutRequestID)
          const data = res.data as {
            ResultCode?: string | number
            ResultDesc?: string
            CheckoutRequestID?: string
            MpesaReceiptNumber?: string
            CallbackMetadata?: unknown
          }

          // 0 = success
          if (`${data.ResultCode}` === '0') {
            window.clearInterval(interval)
            const receipt = await resolveReceiptAfterSuccess(checkoutRequestID, res.data)
            setTransaction({
              transactionId: checkoutRequestID,
              checkoutRequestID,
              status: 'completed',
              paymentMethod: 'mpesa',
              mpesaReceiptNumber: receipt,
            })
            toast.success(
              receipt
                ? `Payment completed. M-Pesa receipt: ${receipt}`
                : 'Payment completed successfully!',
            )
          } else if (`${data.ResultCode}` === '1032' || `${data.ResultCode}` === '2001') {
            // 1032: cancelled by user, 2001: invalid initiator/password-related auth issues
            window.clearInterval(interval)
            setTransaction({
              transactionId: checkoutRequestID,
              checkoutRequestID,
              status: 'failed',
              paymentMethod: 'mpesa',
              failureReason: data.ResultDesc,
            })
            toast.error(data.ResultDesc || 'Payment failed. Please try again.')
          } else if (tries >= 12) {
            // Poll for ~36 seconds, then stop.
            window.clearInterval(interval)
            setTransaction((prev) =>
              prev && prev.checkoutRequestID === checkoutRequestID
                ? { ...prev, pendingStale: true }
                : prev,
            )
            toast('STK push sent. If pending, check your phone and retry status later.')
          }
        } catch {
          // errors are toasted by interceptor
        }
      })()
    }, 3000)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!paymentData.tollId) {
      toast.error('Please select a toll road')
      return
    }
    if (paymentMode === 'live' && (!journeyOrigin || trackedDistanceKm <= 0)) {
      toast.error('Start your journey first so we can track the distance you actually cover')
      return
    }
    if (paymentData.paymentMethod === 'mpesa' && !paymentData.phoneNumber) {
      toast.error('Please enter M-Pesa phone number')
      return
    }

    setLoading(true)
    try {
      if (paymentData.paymentMethod === 'cash') {
        const cashTxId = `CASH-${Date.now().toString(36).toUpperCase()}`
        setTransaction({
          transactionId: cashTxId,
          checkoutRequestID: cashTxId,
          status: 'completed',
          paymentMethod: 'cash',
        })
        toast.success('Cash payment recorded successfully.')
        return
      }

      const response = await mpesaService.stkPush({
        phoneNumber: paymentData.phoneNumber,
        amount: computedAmount,
        accountReference: paymentData.vehicleRegistration || paymentData.tollId,
        transactionDesc: `${paymentData.tollName} ${paymentData.route.from} -> ${paymentData.route.to} (${trackedDistanceLabel}km)`,
        paymentDetails: {
          tollId: paymentData.tollId,
          tollName: paymentData.tollName,
          vehicleRegistration: paymentData.vehicleRegistration,
          routeFrom: paymentData.route.from,
          routeTo: paymentData.route.to,
          distanceKm: trackedDistanceKm,
        },
      })

      const checkoutRequestID = response.data?.checkoutRequestID as string | undefined
      if (!checkoutRequestID) {
        toast.error('STK push request did not return checkout id.')
        return
      }

      setTransaction({
        transactionId: checkoutRequestID,
        checkoutRequestID,
        status: 'pending',
        paymentMethod: 'mpesa',
      })
      toast.success('STK Push sent! Check your phone and enter M-Pesa PIN.')
      pollMpesaStatus(checkoutRequestID)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewSubmit = (e: FormEvent) => {
    e.preventDefault()
    const txId = transaction?.checkoutRequestID
    if (!txId) {
      toast.error('No paid transaction found to review.')
      return
    }
    if (transaction?.status !== 'completed') {
      toast.error('You can only review after a successful payment.')
      return
    }
    if (!reviewText.trim()) {
      toast.error('Please write a short review before submitting.')
      return
    }

    const previous = loadHistory(user?.email)
    const next = previous.map((entry) =>
      entry.checkoutRequestID === txId
        ? {
            ...entry,
            rating: ratingValue,
            review: reviewText.trim(),
            reviewedAt: new Date().toISOString(),
          }
        : entry,
    )

    saveHistory(user?.email, next)
    setPaymentHistory(next)

    const reviewedEntry = next.find((entry) => entry.checkoutRequestID === txId)
    if (reviewedEntry) {
      const globalReviews = loadGlobalReviews()
      const existingIndex = globalReviews.findIndex((entry) => entry.checkoutRequestID === txId)
      const updatedGlobal =
        existingIndex >= 0
          ? globalReviews.map((entry, idx) => (idx === existingIndex ? reviewedEntry : entry))
          : [reviewedEntry, ...globalReviews]
      saveGlobalReviews(updatedGlobal.slice(0, 200))
    }

    void paymentService
      .submitReview({
        checkoutRequestID: txId,
        rating: ratingValue,
        review: reviewText.trim(),
      })
      .then(() => {
        toast.success('Thanks! Your rating and review have been saved.')
      })
  }

  return (
    <div className="toll-payment">
      <div className="payment-container">
        <div className="payment-header">
          <h1>Pay Toll</h1>
          <p>
            Select a toll road and pay the base fee, or track your live journey for distance-based
            billing
          </p>
          <p className="muted" style={{ marginTop: 6 }}>
            Signed in as: <strong>{user?.email}</strong>
          </p>
        </div>

        <div className="payment-grid">
          <div className="toll-selection">
            <h2>Select Toll Road</h2>
            <div className="toll-list">
              {tolls.map((toll) => (
                <div
                  key={toll.id}
                  className={`toll-card ${paymentData.tollId === toll.id ? 'selected' : ''}`}
                  onClick={() => handleTollSelect(toll)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toll-info">
                    <h3>{toll.name}</h3>
                    <p className="toll-rate">
                      Base KES {toll.baseFee} + KES {toll.perKm}/km
                    </p>
                  </div>
                  {paymentData.tollId === toll.id && <FaCheckCircle className="check-icon" />}
                </div>
              ))}
            </div>
          </div>

          <div className="payment-form">
            <h2>Payment Details</h2>

            <div className="form-group payment-mode-section">
              <label>How would you like to pay?</label>
              <div className="payment-method-options">
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="paymentMode"
                    value="quick"
                    checked={paymentMode === 'quick'}
                    onChange={() => handlePaymentModeChange('quick')}
                  />
                  Quick pay (toll only)
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="paymentMode"
                    value="live"
                    checked={paymentMode === 'live'}
                    onChange={() => handlePaymentModeChange('live')}
                  />
                  Live journey tracking
                </label>
              </div>
              <p className="payment-mode-hint">
                {paymentMode === 'quick'
                  ? 'Pay the base toll fee right away — no GPS or journey start required.'
                  : 'Start your journey to bill based on the distance you actually drive.'}
              </p>
            </div>

            {paymentMode === 'live' ? (
            <div className="journey-panel">
              <div className="journey-panel-header">
                <FaMapMarkerAlt />
                <div>
                  <strong>Journey Tracking</strong>
                  <p>Distance is measured from your live GPS once you start driving — no manual entry.</p>
                </div>
              </div>

              <div className="journey-stats">
                <div className="journey-stat">
                  <span>Status</span>
                  <strong>{journeyActive ? 'Tracking live' : 'Not started'}</strong>
                </div>
                <div className="journey-stat">
                  <span>Distance covered</span>
                  <strong>{trackedDistanceLabel} km</strong>
                </div>
                <div className="journey-stat">
                  <span>Origin</span>
                  <strong>{journeyOrigin ? formatCoordsLabel(journeyOrigin) : 'Waiting to start'}</strong>
                </div>
              </div>

              <div className="journey-actions">
                {!journeyActive ? (
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={startJourney}
                    disabled={!paymentData.tollId || startingJourney}
                  >
                    {startingJourney ? 'Getting location…' : 'Start Journey'}
                  </button>
                ) : (
                  <button type="button" className="btn btnDanger" onClick={endJourney}>
                    End Journey
                  </button>
                )}
              </div>

              {locationError ? <div className="journey-error">{locationError}</div> : null}
            </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Payment Method</label>
                <div className="payment-method-options">
                  <label className="payment-method-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="mpesa"
                      checked={paymentData.paymentMethod === 'mpesa'}
                      onChange={handleChange}
                    />
                    M-Pesa
                  </label>
                  <label className="payment-method-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentData.paymentMethod === 'cash'}
                      onChange={handleChange}
                    />
                    Cash
                  </label>
                </div>
              </div>

              {paymentData.paymentMethod === 'mpesa' ? (
                <div className="form-group">
                  <label>M-Pesa Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    placeholder="e.g 07XXXXXXXX"
                    value={paymentData.phoneNumber}
                    onChange={handleChange}
                    required={paymentData.paymentMethod === 'mpesa'}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Cash Collection Note</label>
                  <input type="text" value="Cash received at toll booth" readOnly />
                </div>
              )}

              <div className="form-group">
                <label>Vehicle Registration</label>
                <input
                  type="text"
                  name="vehicleRegistration"
                  value={paymentData.vehicleRegistration}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{paymentMode === 'live' ? 'From (live start point)' : 'From (toll entry)'}</label>
                  <input
                    type="text"
                    name="route.from"
                    placeholder={
                      paymentMode === 'live'
                        ? 'Set automatically when journey starts'
                        : 'Set when toll route is selected'
                    }
                    value={paymentData.route.from}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>To (toll exit)</label>
                  <input
                    type="text"
                    name="route.to"
                    placeholder="Set when toll route is selected"
                    value={paymentData.route.to}
                    readOnly
                  />
                </div>
              </div>

              <div className="payment-summary">
                <div className="summary-row">
                  <span>Base + Distance Charge:</span>
                  <span className="amount">KES {computedAmount}</span>
                </div>
                <div className="summary-row">
                  <span>{paymentData.paymentMethod === 'mpesa' ? 'Transaction Fee:' : 'Cash Handling Fee:'}</span>
                  <span>KES 0</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span className="total-amount">KES {computedAmount}</span>
                </div>
                <div className="summary-row">
                  <span>Formula:</span>
                  <span>
                    {selectedToll
                      ? paymentMode === 'quick'
                        ? `KES ${selectedToll.baseFee} base fee (no journey tracking)`
                        : `KES ${selectedToll.baseFee} + (${trackedDistanceLabel} km × ${selectedToll.perKm})`
                      : 'Select toll road'}
                  </span>
                </div>
              </div>

              <button type="submit" disabled={loading} className="pay-button">
                {loading ? (
                  <>
                    <FaSpinner className="spinner" /> Processing...
                  </>
                ) : (
                  <>{paymentData.paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Record Cash Payment'}</>
                )}
              </button>
            </form>

            {transaction ? (
              <div
                className={`payment-status-card payment-status-card--${transaction.status}`}
                role="region"
                aria-label="Payment status"
              >
                <div className="payment-status-heading">
                  <span className="payment-status-heading-label">Payment status</span>
                  <span className={`payment-status-pill payment-status-pill--${transaction.status}`}>
                    {STATUS_LABEL[transaction.status]}
                  </span>
                </div>

                {transaction.status === 'pending' && (
                  <div className="payment-status-body payment-status-body--pending">
                    <FaSpinner className="spinner payment-status-pending-icon" aria-hidden />
                    <h3 className="payment-status-title">Waiting for M-Pesa</h3>
                    <p className="payment-status-text">
                      Checking your payment. Approve the STK prompt on your phone or enter your M-Pesa PIN.
                    </p>
                    {transaction.pendingStale ? (
                      <p className="payment-status-hint">
                        No final response yet. Check your M-Pesa SMS or balance, or try paying again if needed.
                      </p>
                    ) : null}
                    <p className="payment-status-checkout">
                      Checkout ID: {transaction.checkoutRequestID || transaction.transactionId}
                    </p>
                  </div>
                )}

                {transaction.status === 'failed' && (
                  <div className="payment-status-body payment-status-body--failed">
                    <FaExclamationCircle className="payment-status-failed-icon" aria-hidden />
                    <h3 className="payment-status-title">Payment failed</h3>
                    {transaction.failureReason ? (
                      <p className="payment-status-failure-reason">{transaction.failureReason}</p>
                    ) : null}
                    <p className="payment-status-text">
                      Review your details above and tap <strong>Pay with M-Pesa</strong> to try again.
                    </p>
                    <p className="payment-status-checkout">
                      Checkout ID: {transaction.checkoutRequestID || transaction.transactionId}
                    </p>
                  </div>
                )}

                {transaction.status === 'completed' && (
                  <div className="payment-success payment-status-success-block">
                    <FaCheckCircle className="success-icon" />
                    <h3>Payment Successful!</h3>
                    <p className="payment-success-amount">
                      Amount paid: <strong>KES {computedAmount}</strong>
                    </p>
                    {transaction.paymentMethod === 'cash' ? (
                      <p className="payment-success-receipt-fallback">
                        Payment method: Cash. Keep your printed/manual receipt for reconciliation.
                      </p>
                    ) : transaction.mpesaReceiptNumber ? (
                      <div className="mpesa-receipt-box" role="status" aria-live="polite">
                        <div className="mpesa-receipt-label">M-Pesa receipt number</div>
                        <div className="mpesa-receipt-value">{transaction.mpesaReceiptNumber}</div>
                      </div>
                    ) : (
                      <p className="payment-success-receipt-fallback">
                        Your M-Pesa receipt number will also appear in your M-Pesa SMS.
                      </p>
                    )}
                    <p className="payment-success-meta">
                      Reference: {transaction.checkoutRequestID || transaction.transactionId}
                    </p>
                    <p className="payment-success-note">
                      This payment is listed in your activity below (successful, failed, and pending outcomes).
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {transaction?.status === 'completed' && !hasReviewForCurrentTransaction ? (
              <section className="review-card" aria-label="Rate and review your payment experience">
                <h3>Rate and Review</h3>
                <p className="review-card-intro">
                  Share your experience now that payment is complete.
                </p>
                <form onSubmit={handleReviewSubmit}>
                  <div className="form-group">
                    <label htmlFor="rating">Rating (1 to 5)</label>
                    <select
                      id="rating"
                      value={ratingValue}
                      onChange={(e) => setRatingValue(Number(e.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} Star{n > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="review">Review</label>
                    <textarea
                      id="review"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      placeholder="Tell us about your payment experience..."
                      required
                    />
                  </div>
                  <button type="submit" className="review-button">
                    Submit Review
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        </div>

        {paymentHistory.length > 0 && (
          <section className="payment-history" aria-labelledby="payment-history-heading">
            <h2 id="payment-history-heading">Payment activity</h2>
            <p className="payment-history-intro">
              Successful, failed, and timed-out pending attempts on this device (same browser profile).
            </p>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Toll</th>
                    <th scope="col">Route</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Details</th>
                    <th scope="col">Method</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Review</th>
                    <th scope="col">M-Pesa receipt</th>
                    <th scope="col">Checkout ID</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((row) => {
                    const st = row.status ?? 'completed'
                    return (
                      <tr key={row.checkoutRequestID}>
                        <td>{formatPaidAt(row.paidAt)}</td>
                        <td>
                          <span className={`history-status-pill history-status-pill--${st}`}>
                            {st === 'completed' ? 'Successful' : st === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                        </td>
                        <td className="history-amount">KES {row.amountKes}</td>
                        <td>{row.tollName}</td>
                        <td>
                          {row.routeFrom} → {row.routeTo}
                        </td>
                        <td>{row.vehicleRegistration}</td>
                        <td className="history-details">
                          {st === 'completed'
                            ? '—'
                            : st === 'failed'
                              ? row.failureReason || '—'
                              : row.pendingNote || 'Timed out waiting for M-Pesa'}
                        </td>
                        <td>{row.paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'}</td>
                        <td>{row.rating ? `${row.rating}/5` : '—'}</td>
                        <td className="history-review">{row.review || '—'}</td>
                        <td>{row.mpesaReceiptNumber || '—'}</td>
                        <td className="history-checkout">{row.checkoutRequestID}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

