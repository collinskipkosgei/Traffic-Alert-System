import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaBell,
  FaCreditCard,
  FaMapMarkedAlt,
  FaMobileAlt,
  FaMoneyBillWave,
  FaPhone,
  FaRoute,
  FaSatellite,
  FaTimes,
  FaTrafficLight,
} from 'react-icons/fa'
import { useAuth } from '../AuthContext'
import './PortalSelection.css'

const HERO_SLIDES = [
  {
    tag: 'The Traffic Alert System',
    title: 'Efficient transit with real-time traffic intelligence',
    cta: 'Get Started',
  },
  {
    tag: 'Cashless Toll Access',
    title: 'For non-stop M-Pesa toll payments on your journey',
    cta: 'Pay Toll',
  },
  {
    tag: 'Your savings on the road',
    title: 'Save time, save fuel, travel safely',
    cta: 'Explore Services',
  },
]

const PAYMENT_OPTIONS = [
  {
    icon: FaCreditCard,
    title: 'M-Pesa Payments',
    text: 'Pay toll fees securely via STK Push. Distance is tracked automatically from your live GPS — no manual entry.',
  },
  {
    icon: FaSatellite,
    title: 'GPS Journey Tracking',
    text: 'Start your journey and we measure the exact distance you cover from your location in real time.',
  },
  {
    icon: FaRoute,
    title: 'Route Suggestions',
    text: 'Tap the map to set your destination. Your live location is the starting point for smart route options.',
  },
  {
    icon: FaBell,
    title: 'Real-Time Alerts',
    text: 'Receive instant notifications about accidents, road closures, and congestion before you reach them.',
  },
]

const MODULES = [
  {
    icon: FaMobileAlt,
    title: 'Driver Dashboard',
    text: 'Access alerts, routes, toll payments, and live location tracking in one place.',
    action: 'login',
  },
  {
    icon: FaMapMarkedAlt,
    title: 'Live Map',
    text: 'See your position, nearby incidents, and route lines on an interactive map.',
    action: 'login',
  },
  {
    icon: FaMoneyBillWave,
    title: 'Toll Calculator',
    text: 'Base fee plus distance-based charges calculated from your actual journey.',
    action: 'login',
  },
  {
    icon: FaBell,
    title: 'Traffic Alerts',
    text: 'Stay informed with approved alerts from administrators across the network.',
    action: 'login',
  },
]

const NEWS = [
  {
    date: 'January 2026',
    title: 'GPS-based toll payments now live — no more manual distance entry',
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80',
  },
  {
    date: 'December 2025',
    title: 'Route suggestions upgraded with map tap-to-destination',
    image:
      'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80',
  },
  {
    date: 'November 2025',
    title: 'Unified login — one sign-in for drivers and administrators',
    image:
      'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=600&q=80',
  },
]

const TESTIMONIALS = [
  {
    quote:
      'The GPS toll tracking means I pay for exactly what I drive. No guessing kilometres anymore.',
    name: 'Mercy Kamau',
    role: 'Resident, South B',
  },
  {
    quote:
      'Route suggestions with live location saved us fuel and time on daily Kitengela–Nairobi runs.',
    name: 'Benson Timothy',
    role: 'Chairman, Rembo Classic Sacco',
  },
  {
    quote:
      'Real-time alerts helped our fleet avoid a major closure on Thika Road during morning peak.',
    name: 'Julius Mwangi',
    role: 'Administration Manager, Sunworld Safaris',
  },
]

export default function PortalSelection() {
  const navigate = useNavigate()
  const { doUnifiedLogin, authError, user } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [activePayCard, setActivePayCard] = useState(1)

  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin', { replace: true })
    else if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  async function onLoginSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const role = await doUnifiedLogin({ email, password })
      setShowLogin(false)
      navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  const slide = HERO_SLIDES[heroIndex]

  return (
    <div className="nePage">
      <div className="neTopBar">
        <div className="neTopBarInner">
          <span>Service Hotline</span>
          <button type="button" className="neTopBarPhone">
            <FaPhone /> +254 725 853 715
          </button>
        </div>
      </div>

      <header className="neNav">
        <div className="neNavInner">
          <button type="button" className="neBrand" onClick={() => scrollTo('home')}>
            <span className="neBrandIcon">
              <FaTrafficLight />
            </span>
            <span className="neBrandText">
              <strong>Traffic Alert</strong>
              <small>System</small>
            </span>
          </button>

          <nav className="neNavLinks">
            <button type="button" className="neNavActive" onClick={() => scrollTo('home')}>
              Home
            </button>
            <button type="button" onClick={() => scrollTo('about')}>
              About Us
            </button>
            <button type="button" onClick={() => scrollTo('services')}>
              Services
            </button>
            <button type="button" onClick={() => scrollTo('news')}>
              News & Events
            </button>
            <button type="button" onClick={() => scrollTo('contact')}>
              Contacts
            </button>
          </nav>

          <button type="button" className="neNavLogin" onClick={() => setShowLogin(true)}>
            Login
          </button>
        </div>
      </header>

      <section id="home" className="neHero">
        <div className="neHeroInner">
          <span className="neHeroTag">{slide.tag}</span>
          <h1>{slide.title}</h1>
          <button
            type="button"
            className="neHeroCta"
            onClick={() => (heroIndex === 0 ? navigate('/register') : setShowLogin(true))}
          >
            {slide.cta}
          </button>
        </div>
        <div className="neHeroControls">
          <button
            type="button"
            onClick={() => setHeroIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            Prev
          </button>
          <span className="neHeroDivider" />
          <button type="button" onClick={() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)}>
            Next
          </button>
        </div>
      </section>

      <section id="services" className="neSection">
        <div className="neContainer">
          <div className="neSectionHead neSectionHead--split">
            <div>
              <span className="neSectionLabel">Payment Options</span>
              <h2>How to pay toll fees on the Traffic Alert System</h2>
            </div>
            <p className="neSectionDesc">
              GPS journey tracking is the most accurate way to pay tolls. Start your journey and
              distance is measured from your live location — fees are calculated automatically.
              You can also use M-Pesa STK Push, cash recording, route suggestions, and real-time
              alerts.
            </p>
          </div>

          <div className="nePayCards">
            {PAYMENT_OPTIONS.map(({ icon: Icon, title, text }, index) => (
              <button
                key={title}
                type="button"
                className={`nePayCard${activePayCard === index ? ' nePayCard--active' : ''}`}
                onMouseEnter={() => setActivePayCard(index)}
                onFocus={() => setActivePayCard(index)}
                onClick={() => setShowLogin(true)}
              >
                <div className="nePayCardIcon">
                  <Icon />
                </div>
                <h4>{title}</h4>
                <p>{text}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="neSection" style={{ background: '#fff' }}>
        <div className="neContainer">
          <div className="neSectionHead">
            <span className="neSectionLabel">What you need to know</span>
            <h2>Platform features & toll rates</h2>
          </div>

          <div className="neInfoGrid">
            <div className="neInfoPanel neInfoPanel--blue">
              <h3>Distance-based toll calculation</h3>
              <p>
                Select your expressway route, start your journey, and we track every kilometre from
                your GPS. Payment = base fee + (distance covered × rate per km). No assumptions, no
                manual input.
              </p>
            </div>
            <div className="neInfoPanel neInfoPanel--map">
              <h3>Live location on the map</h3>
              <p>
                Route suggestions use your current position as origin. Tap anywhere on the map to set
                your destination and compare free vs toll routes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="neBenefits">
        <div className="neContainer neBenefitsInner">
          <div className="neBenefitsImage" aria-hidden />
          <div className="neBenefitsContent">
            <span className="neSectionLabel">Your savings on the road</span>
            <h2>Save time, save fuel, safe journey</h2>
            <p>
              Experience quicker travel times and reduced congestion with live traffic alerts and
              smart routing. Pay tolls accurately from GPS-tracked distance and spend less time
              stuck in traffic.
            </p>
          </div>
        </div>
      </section>

      <section className="neSection">
        <div className="neContainer">
          <div className="neSectionHead neSectionHead--center">
            <span className="neSectionLabel">Core modules</span>
            <h2>4 ways to use the platform</h2>
          </div>

          <div className="neModuleGrid">
            {MODULES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="neModuleCard">
                <div className="neModuleIcon">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <button type="button" className="neModuleLink" onClick={() => setShowLogin(true)}>
                  Learn More
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="neInstallBand">
        <div className="neContainer neInstallGrid">
          <div>
            <span className="neSectionLabel" style={{ color: '#93c5fd' }}>
              Get started
            </span>
            <h2>Sign in once — we route you automatically</h2>
            <p>
              One login for drivers and administrators. Enter your credentials and we&apos;ll take
              you to the right dashboard — driver tools or admin control panel.
            </p>
            <button type="button" className="neInstallCta" onClick={() => setShowLogin(true)}>
              Login Now
            </button>
          </div>
          <div className="neInstallLists">
            <ul>
              <li>For non-stop M-Pesa toll payments.</li>
              <li>GPS distance tracked automatically.</li>
              <li>Map-based route suggestions.</li>
            </ul>
            <ul>
              <li>Real-time traffic alerts.</li>
              <li>Live location sharing.</li>
              <li>Admin incident management.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="news" className="neSection">
        <div className="neContainer">
          <div className="neSectionHead">
            <span className="neSectionLabel">News and announcements</span>
            <h2>Latest news</h2>
          </div>

          <div className="neNewsGrid">
            {NEWS.map(({ date, title, image }) => (
              <article key={title} className="neNewsCard">
                <div className="neNewsImage" style={{ backgroundImage: `url(${image})` }} />
                <div className="neNewsBody">
                  <div className="neNewsDate">{date}</div>
                  <h4>{title}</h4>
                  <button type="button" className="neNewsLink" onClick={() => setShowLogin(true)}>
                    Read More
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="neTestimonials">
        <div className="neContainer">
          <div className="neSectionHead neSectionHead--center">
            <span className="neSectionLabel">Testimonials</span>
            <h2>What users of the Traffic Alert System are saying</h2>
          </div>

          <div className="neTestimonialGrid">
            {TESTIMONIALS.map(({ quote, name, role }) => (
              <blockquote key={name} className="neTestimonialCard">
                <p className="neTestimonialQuote">&ldquo;{quote}&rdquo;</p>
                <footer className="neTestimonialAuthor">
                  <strong>{name}</strong>
                  <span>{role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="neFooter">
        <div className="neContainer">
          <div className="neFooterHotlines">
            <div className="neHotlineBlock">
              <h3>Service Hotline</h3>
              <button type="button" className="neHotlineNum">
                +254 725 853 715
              </button>
            </div>
            <div className="neHotlineBlock">
              <h3>Support Email</h3>
              <a href="mailto:ckipchumba53@gmail.com" className="neHotlineNum" style={{ fontSize: '1.4rem' }}>
                ckipchumba53@gmail.com
              </a>
            </div>
          </div>

          <div className="neFooterGrid">
            <div className="neFooterBrand">
              <div className="neBrand" style={{ pointerEvents: 'none' }}>
                <span className="neBrandIcon">
                  <FaTrafficLight />
                </span>
                <span className="neBrandText">
                  <strong>Traffic Alert System</strong>
                  <small>Real-time road intelligence</small>
                </span>
              </div>
            </div>

            <div>
              <h5>Quick links</h5>
              <button type="button" onClick={() => scrollTo('home')}>
                Home
              </button>
              <button type="button" onClick={() => scrollTo('about')}>
                About Us
              </button>
              <button type="button" onClick={() => scrollTo('services')}>
                Services
              </button>
              <button type="button" onClick={() => scrollTo('contact')}>
                Contact
              </button>
            </div>

            <div>
              <h5>Account</h5>
              <button type="button" onClick={() => setShowLogin(true)}>
                Login
              </button>
              <button type="button" onClick={() => navigate('/register')}>
                Register
              </button>
              <button type="button" onClick={() => navigate('/forgot-password')}>
                Forgot Password
              </button>
            </div>

            <div>
              <h5>Where to find us</h5>
              <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
                Nairobi, Kenya
              </p>
              <p style={{ margin: 0, fontSize: 14 }}>Mon–Fri 9:00am–5:00pm</p>
            </div>
          </div>

          <div className="neFooterBottom">
            <span>© {new Date().getFullYear()} Traffic Alert System. All rights reserved.</span>
            <span>Built for safer, smarter mobility in Kenya.</span>
          </div>
        </div>
      </footer>

      {showLogin ? (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogin(false)
          }}
        >
          <div className="neLoginModal">
            <button
              type="button"
              className="neLoginClose"
              onClick={() => setShowLogin(false)}
              aria-label="Close login"
            >
              <FaTimes />
            </button>

            <div className="authLogo">
              <div className="brandIcon">
                <FaTrafficLight />
              </div>
              <div>
                <h2 className="authTitle">Welcome Back</h2>
                <p className="authSubtitle">Sign in — we&apos;ll route you to the right dashboard</p>
              </div>
            </div>

            <form onSubmit={onLoginSubmit} style={{ display: 'grid', gap: 14 }}>
              <label className="field">
                <span>Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    type={showPassword ? 'text' : 'password'}
                    style={{ paddingRight: 72 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>

              {authError ? (
                <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{authError}</div>
              ) : null}
              {error ? (
                <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{error}</div>
              ) : null}
            </form>

            <div style={{ marginTop: 18, display: 'grid', gap: 8, fontSize: 14 }}>
              <div className="muted">
                No account?{' '}
                <button
                  type="button"
                  className="linkPrimary"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => {
                    setShowLogin(false)
                    navigate('/register')
                  }}
                >
                  Create one
                </button>
              </div>
              <div className="muted">
                <button
                  type="button"
                  className="linkPrimary"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => {
                    setShowLogin(false)
                    navigate('/forgot-password')
                  }}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
