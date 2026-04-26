import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import type { TrafficAlert, AdminUser, AdminStats, AppSettings, ActivityLog, SystemHealth, PaymentSummary } from '../api'
import {
  getPendingAlerts,
  approveAlert,
  rejectAlert,
  deleteAlert,
  getAdminUsers,
  updateUserRole,
  updateUserSuspend,
  getAdminStats,
  getSettings,
  updateSettings,
  getActivityFeed,
  getSystemHealth,
  approveAllAlerts,
  exportAlertsCSV,
  sendTestNotification,
  getPaymentsSummary,
  exportPaymentsPDF,
} from '../api'

type Tab = 'overview' | 'incidents' | 'users' | 'payments' | 'settings'

function StatCard({ label, value, icon, color = '#2563eb' }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4, color }}>{value}</div>
      <div style={{ color: '#6c757d', fontSize: 14 }}>{label}</div>
    </div>
  )
}

function HealthDot({ status }: { status: string }) {
  const color = status === 'healthy' ? '#22c55e' : status === 'not_configured' ? '#f59e0b' : '#ef4444'
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6 }} />
}

function MiniLineChart({ data, color = '#2563eb' }: { data: { label: string; value: number }[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const points = data.map((d, i) => `${(i / (data.length - 1 || 1)) * 100},${100 - (d.value / max) * 90}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * 100
        const y = 100 - (d.value / max) * 90
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />
      })}
    </svg>
  )
}

function MiniBarChart({ data, color = '#22c55e' }: { data: { label: string; value: number }[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const w = 80 / data.length
        const h = (d.value / max) * 80
        return <rect key={i} x={10 + i * w + w * 0.1} y={100 - h} width={w * 0.8} height={h} fill={color} rx="2" />
      })}
    </svg>
  )
}

export default function AdminDashboard() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [pendingAlerts, setPendingAlerts] = useState<TrafficAlert[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [confirmApproveAll, setConfirmApproveAll] = useState(false)
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null)
  const [paymentStartDate, setPaymentStartDate] = useState('')
  const [paymentEndDate, setPaymentEndDate] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required')
      navigate('/dashboard')
      return
    }
    loadAll()
  }, [user, navigate])

  async function loadAll() {
    if (!token) return
    setLoading(true)
    try {
      const [s, p, u, cfg, act, h] = await Promise.all([
        getAdminStats(token),
        getPendingAlerts(token),
        getAdminUsers(token),
        getSettings(token),
        getActivityFeed(token),
        getSystemHealth(token),
      ])
      setStats(s)
      setPendingAlerts(p.alerts)
      setUsers(u.users)
      setSettings(cfg.settings)
      setActivity(act.logs)
      setHealth(h)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  async function refreshActivity() {
    if (!token) return
    try {
      const act = await getActivityFeed(token)
      setActivity(act.logs)
    } catch {}
  }

  async function handleApprove(id: string) {
    if (!token) return
    try {
      await approveAlert(token, id)
      toast.success('Alert approved')
      setPendingAlerts((prev) => prev.filter((a) => a._id !== id))
      if (stats) setStats({ ...stats, pendingAlerts: stats.pendingAlerts - 1 })
      refreshActivity()
    } catch {
      toast.error('Failed to approve alert')
    }
  }

  async function handleReject(id: string) {
    if (!token) return
    try {
      await rejectAlert(token, id)
      toast.success('Alert rejected')
      setPendingAlerts((prev) => prev.filter((a) => a._id !== id))
      if (stats) setStats({ ...stats, pendingAlerts: stats.pendingAlerts - 1 })
      refreshActivity()
    } catch {
      toast.error('Failed to reject alert')
    }
  }

  async function handleApproveAll() {
    if (!token || !confirmApproveAll) return
    try {
      const res = await approveAllAlerts(token)
      toast.success(res.message)
      setPendingAlerts([])
      if (stats) setStats({ ...stats, pendingAlerts: 0 })
      refreshActivity()
      setConfirmApproveAll(false)
    } catch {
      toast.error('Failed to approve all alerts')
    }
  }

  async function handleExportCSV() {
    if (!token) return
    try {
      const blob = await exportAlertsCSV(token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch {
      toast.error('Failed to export CSV')
    }
  }

  async function handleTestNotification() {
    if (!token) return
    try {
      const res = await sendTestNotification(token)
      toast.success(res.message)
    } catch (err: any) {
      console.error('Test notification error:', err)
      toast.error('Failed to send test notification: ' + (err?.message || 'Unknown error'))
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    try {
      await deleteAlert(token, id)
      toast.success('Alert deleted')
      setPendingAlerts((prev) => prev.filter((a) => a._id !== id))
    } catch {
      toast.error('Failed to delete alert')
    }
  }

  async function toggleRole(u: AdminUser) {
    if (!token) return
    const next = u.role === 'admin' ? 'user' : 'admin'
    try {
      await updateUserRole(token, u._id, next)
      toast.success(`Role updated to ${next}`)
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, role: next } : x)))
    } catch {
      toast.error('Failed to update role')
    }
  }

  async function toggleSuspend(u: AdminUser) {
    if (!token) return
    try {
      await updateUserSuspend(token, u._id, !u.suspended)
      toast.success(u.suspended ? 'User unsuspended' : 'User suspended')
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, suspended: !u.suspended } : x)))
    } catch {
      toast.error('Failed to update suspension')
    }
  }

  async function saveSettings() {
    if (!token || !settings) return
    try {
      await updateSettings(token, settings)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  async function loadPaymentSummary() {
    if (!token) {
      toast.error('Not authenticated')
      return
    }
    try {
      const summary = await getPaymentsSummary(token, paymentStartDate || undefined, paymentEndDate || undefined)
      setPaymentSummary(summary)
    } catch (error) {
      console.error('Payment summary error:', error)
      toast.error(`Failed to load payment data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function handleExportPaymentsPDF() {
    if (!token) return
    try {
      const blob = await exportPaymentsPDF(token, paymentStartDate || undefined, paymentEndDate || undefined)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payment_report_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Payment report downloaded')
    } catch (error) {
      toast.error('Failed to export PDF')
    }
  }

  useEffect(() => {
    if (tab === 'payments' && token) {
      loadPaymentSummary()
    }
  }, [tab, token, paymentStartDate, paymentEndDate])

  const tabBtn = (key: Tab, label: string, badge?: number) => (
    <button
      key={key}
      className="btn"
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? '#2563eb' : 'transparent',
        color: tab === key ? '#fff' : '#93c5fd',
        border: '1px solid #2563eb',
        marginRight: 8,
      }}
    >
      {label}{badge !== undefined && badge > 0 && ` (${badge})`}
    </button>
  )

  if (loading && !stats) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Admin Dashboard</h1>
        <div className="muted">Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => navigate('/admin/active-drivers')}>View Live Map →</button>
          <button className="btn" onClick={loadAll}>↻ Refresh</button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontWeight: 600, marginRight: 8 }}>Quick Actions:</span>
          {confirmApproveAll ? (
            <>
              <span className="muted">Approve all pending?</span>
              <button className="btn" style={{ background: '#22c55e', borderColor: '#22c55e' }} onClick={handleApproveAll}>Yes, Approve All</button>
              <button className="btn" onClick={() => setConfirmApproveAll(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirmApproveAll(true)} disabled={!pendingAlerts.length}>
              ✓ Approve All Pending ({pendingAlerts.length})
            </button>
          )}
          <button className="btn" onClick={handleExportCSV}>↓ Export CSV</button>
          <button className="btn" onClick={handleTestNotification}>🔔 Test Notification</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        {tabBtn('overview', 'Overview')}
        {tabBtn('incidents', 'Incidents', stats?.pendingAlerts)}
        {tabBtn('users', 'Users', stats?.totalUsers)}
        {tabBtn('payments', 'Payment Reports')}
        {tabBtn('settings', 'Settings')}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {/* Left Column - Stats & Charts */}
          <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <StatCard label="Total Incidents" value={stats.totalAlerts} icon="⚠️" />
              <StatCard label="Pending" value={stats.pendingAlerts} icon="📝" color="#f59e0b" />
              <StatCard label="Today" value={stats.todayAlerts} icon="📅" />
              <StatCard label="This Week" value={stats.weekAlerts} icon="📊" />
              <StatCard label="Total Users" value={stats.totalUsers} icon="👥" />
              <StatCard label="Active Users" value={stats.activeUsers} icon="✅" color="#22c55e" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 12px 0' }}>📈 Incident Trends (7 days)</h4>
                <MiniLineChart data={stats.dailyCounts.map(d => ({ label: d.date, value: d.count }))} />
              </div>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 12px 0' }}>👥 User Signups (4 weeks)</h4>
                <MiniBarChart data={stats.weeklySignups.map(d => ({ label: d.week, value: d.count }))} />
              </div>
            </div>

            {/* Pending Incidents */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0 }}>📝 Pending Incidents ({pendingAlerts.length})</h3>
              {pendingAlerts.length === 0 ? (
                <div className="muted">No pending incidents to review.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                        <th style={{ padding: '6px 8px' }}>Title</th>
                        <th style={{ padding: '6px 8px' }}>Location</th>
                        <th style={{ padding: '6px 8px' }}>Severity</th>
                        <th style={{ padding: '6px 8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingAlerts.slice(0, 5).map((a) => (
                        <tr key={a._id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                          <td style={{ padding: '6px 8px' }}>{a.title}</td>
                          <td style={{ padding: '6px 8px' }}>{a.location}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <span className={`badge badge${a.severity === 'high' ? 'Danger' : a.severity === 'medium' ? 'Warning' : 'Success'}`}>
                              {a.severity}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <button className="btn" style={{ padding: '4px 8px', marginRight: 4, fontSize: 12, background: '#22c55e', borderColor: '#22c55e' }} onClick={() => handleApprove(a._id)}>Approve</button>
                            <button className="btn btnDanger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleReject(a._id)}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pendingAlerts.length > 5 && <div className="muted" style={{ marginTop: 8 }}>+ {pendingAlerts.length - 5} more...</div>}
                </div>
              )}
            </div>

            {/* Top Locations */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0 }}>📍 Top Reported Locations</h3>
              {stats.topLocations.length === 0 ? (
                <div className="muted">No data yet.</div>
              ) : (
                <div>
                  {stats.topLocations.map((loc, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < stats.topLocations.length - 1 ? '1px solid #f1f3f5' : undefined }}>
                      <span>{loc.location}</span>
                      <span style={{ fontWeight: 600 }}>{loc.count} incidents</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Activity & Health */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* System Health */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0 }}>🖥️ System Health</h3>
              {health && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}><HealthDot status={health.checks.database} /><span>Database</span></div>
                  <div style={{ display: 'flex', alignItems: 'center' }}><HealthDot status={health.checks.googleMaps} /><span>Google Maps API</span></div>
                  <div style={{ display: 'flex', alignItems: 'center' }}><HealthDot status={health.checks.weather} /><span>Weather API</span></div>
                  <div style={{ display: 'flex', alignItems: 'center' }}><HealthDot status={health.checks.mpesa} /><span>M-Pesa</span></div>
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="card" style={{ padding: 20, flex: 1 }}>
              <h3 style={{ marginTop: 0 }}>📋 Activity Feed</h3>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {activity.length === 0 ? (
                  <div className="muted">No recent activity.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {activity.map((log) => (
                      <div key={log._id} style={{ padding: 8, background: '#f8f9fa', borderRadius: 4, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                        <div className="muted">{log.details}</div>
                        <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 2 }}>
                          {log.actorEmail || 'System'} • {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENTS TAB */}
      {tab === 'incidents' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Incident Approval Queue</h2>
          {pendingAlerts.length === 0 ? (
            <div className="muted">No pending incidents to review.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                    <th style={{ padding: '8px 12px' }}>Title</th>
                    <th style={{ padding: '8px 12px' }}>Location</th>
                    <th style={{ padding: '8px 12px' }}>Severity</th>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAlerts.map((a) => (
                    <tr key={a._id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <td style={{ padding: '8px 12px' }}>{a.title}</td>
                      <td style={{ padding: '8px 12px' }}>{a.location}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className={`badge badge${a.severity === 'high' ? 'Danger' : a.severity === 'medium' ? 'Warning' : 'Success'}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{new Date(a.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button className="btn" style={{ marginRight: 6, background: '#22c55e', borderColor: '#22c55e' }} onClick={() => handleApprove(a._id)}>Approve</button>
                        <button className="btn btnDanger" style={{ marginRight: 6 }} onClick={() => handleReject(a._id)}>Reject</button>
                        <button className="btn btnDanger" onClick={() => handleDelete(a._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>User Management</h2>
          {users.length === 0 ? (
            <div className="muted">No users found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px' }}>Role</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Joined</th>
                    <th style={{ padding: '8px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #f1f3f5', opacity: u.suspended ? 0.6 : 1 }}>
                      <td style={{ padding: '8px 12px' }}>{u.email}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className={`badge badge${u.role === 'admin' ? 'Danger' : 'Success'}`}>{u.role}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{u.suspended ? 'Suspended' : 'Active'}</td>
                      <td style={{ padding: '8px 12px' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button className="btn" style={{ marginRight: 6 }} onClick={() => toggleRole(u)}>
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button className="btn btnDanger" onClick={() => toggleSuspend(u)}>
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>💰 Payment Reports</h2>
          
          {/* Date Filter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>From</label>
              <input 
                type="date" 
                value={paymentStartDate}
                onChange={(e) => setPaymentStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>To</label>
              <input 
                type="date"
                value={paymentEndDate}
                onChange={(e) => setPaymentEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4 }}
              />
            </div>
            <button className="btn" onClick={loadPaymentSummary} style={{ marginTop: 20 }}>Filter</button>
            <button className="btn" style={{ background: '#22c55e', borderColor: '#22c55e', marginTop: 20 }} onClick={handleExportPaymentsPDF}>
              📄 Download PDF
            </button>
          </div>

          {paymentSummary ? (
            <>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{paymentSummary.totalCount}</div>
                  <div style={{ color: '#6c757d', fontSize: 13 }}>Total Payments</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#22c55e' }}>
                    KES {paymentSummary.totalAmount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ color: '#6c757d', fontSize: 13 }}>Total Amount</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    KES {paymentSummary.averagePayment.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ color: '#6c757d', fontSize: 13 }}>Average Payment</div>
                </div>
              </div>

              {/* Payment Method Breakdown */}
              <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>📊 By Payment Method</h3>
                {Object.entries(paymentSummary.methodBreakdown).map(([method, data]) => (
                  <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f3f5' }}>
                    <div>
                      <strong style={{ textTransform: 'uppercase', fontSize: 13 }}>{method}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{data.count} transactions</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      KES {data.amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div style={{ padding: 12, background: '#f0f7ff', borderRadius: 4, borderLeft: '4px solid #2563eb' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
                  ℹ️ Click "Download PDF" to generate a detailed PDF report with complete payment records, summaries, and breakdowns for your records.
                </p>
              </div>
            </>
          ) : (
            <div className="muted">Loading payment data...</div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && settings && (
        <div className="card" style={{ padding: 20, maxWidth: 600 }}>
          <h2 style={{ marginTop: 0 }}>Alert Settings</h2>
          <div style={{ marginBottom: 16 }}>
            <label className="field">
              <span className="muted">Alert Radius (km)</span>
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={settings.alertRadiusKm}
                onChange={(e) => setSettings({ ...settings, alertRadiusKm: Number(e.target.value) })}
              />
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <span className="muted" style={{ display: 'block', marginBottom: 8 }}>Severity Levels Shown</span>
            {(['low', 'medium', 'high'] as const).map((sev) => (
              <label key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.severityLevels[sev]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      severityLevels: { ...settings.severityLevels, [sev]: e.target.checked },
                    })
                  }
                />
                <span style={{ textTransform: 'capitalize' }}>{sev}</span>
              </label>
            ))}
          </div>
          <button className="btn" onClick={saveSettings}>Save Settings</button>
        </div>
      )}
    </div>
  )
}
