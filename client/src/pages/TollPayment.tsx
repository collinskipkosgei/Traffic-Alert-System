import { useState, type FormEvent } from 'react'
import { FaCheckCircle, FaSpinner } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { paymentService } from '../services/api'
import { useAuth } from '../AuthContext'
import './TollPayment.css'

type Tx = {
  transactionId: string
  status: 'pending' | 'completed' | 'failed'
  mpesaReceiptNumber?: string
}

export default function TollPayment() {
  const { user } = useAuth()
  const [paymentData, setPaymentData] = useState({
    tollId: '',
    tollName: '',
    amount: '',
    vehicleRegistration: '',
    route: {
      from: '',
      to: '',
    },
  })
  const [loading, setLoading] = useState(false)
  const [transaction, setTransaction] = useState<Tx | null>(null)

  const tolls = [
    { id: 'nrb_exp_1', name: 'Nairobi Expressway - Mlolongo to Westlands', rate: 150 },
    { id: 'nrb_exp_2', name: 'Nairobi Expressway - Westlands to Mlolongo', rate: 150 },
    { id: 'nrb_exp_3', name: 'Nairobi Expressway - JKIA to Westlands', rate: 200 },
    { id: 'msa_corr_1', name: 'Mombasa-Mariakani Corridor', rate: 100 },
  ]

  const handleTollSelect = (toll: { id: string; name: string; rate: number }) => {
    setPaymentData((prev) => ({
      ...prev,
      tollId: toll.id,
      tollName: toll.name,
      amount: String(toll.rate),
    }))
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

  const pollPaymentStatus = (transactionId: string) => {
    const interval = window.setInterval(async () => {
      try {
        const res = await paymentService.checkStatus(transactionId)
        const data = res.data as Tx
        if (data.status === 'completed') {
          window.clearInterval(interval)
          setTransaction(data)
          toast.success('Payment completed successfully!')
        } else if (data.status === 'failed') {
          window.clearInterval(interval)
          setTransaction(data)
          toast.error('Payment failed. Please try again.')
        }
      } catch {
        // errors are toasted by interceptor
      }
    }, 3000)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!paymentData.tollId || !paymentData.amount) {
      toast.error('Please select a toll road')
      return
    }

    setLoading(true)
    try {
      const response = await paymentService.initiatePayment({
        tollId: paymentData.tollId,
        tollName: paymentData.tollName,
        amount: Number(paymentData.amount),
        vehicleRegistration: paymentData.vehicleRegistration,
        route: paymentData.route,
      })

      setTransaction(response.data as Tx)
      toast.success('Payment initiated! (Simulated) Checking status...')
      pollPaymentStatus((response.data as Tx).transactionId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="toll-payment">
      <div className="payment-container">
        <div className="payment-header">
          <h1>Pay Toll</h1>
          <p>Quick and secure toll payments (simulated)</p>
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
                    <p className="toll-rate">KES {toll.rate}</p>
                  </div>
                  {paymentData.tollId === toll.id && <FaCheckCircle className="check-icon" />}
                </div>
              ))}
            </div>
          </div>

          <div className="payment-form">
            <h2>Payment Details</h2>
            <form onSubmit={handleSubmit}>
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
                  <label>From</label>
                  <input
                    type="text"
                    name="route.from"
                    placeholder="Starting point"
                    value={paymentData.route.from}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>To</label>
                  <input
                    type="text"
                    name="route.to"
                    placeholder="Destination"
                    value={paymentData.route.to}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="payment-summary">
                <div className="summary-row">
                  <span>Toll Amount:</span>
                  <span className="amount">KES {paymentData.amount || 0}</span>
                </div>
                <div className="summary-row">
                  <span>Transaction Fee:</span>
                  <span>KES 0</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span className="total-amount">KES {paymentData.amount || 0}</span>
                </div>
              </div>

              <button type="submit" disabled={loading} className="pay-button">
                {loading ? (
                  <>
                    <FaSpinner className="spinner" /> Processing...
                  </>
                ) : (
                  <>Pay with M-Pesa (Simulated)</>
                )}
              </button>
            </form>

            {transaction && transaction.status === 'completed' && (
              <div className="payment-success">
                <FaCheckCircle className="success-icon" />
                <h3>Payment Successful!</h3>
                <p>Transaction ID: {transaction.transactionId}</p>
                <p>M-Pesa Receipt: {transaction.mpesaReceiptNumber}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

