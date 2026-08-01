import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Camera, CheckCheck, ChevronLeft, CircleMinus, Flashlight, Flag, Heart, Image, Mic, MoreVertical, Pencil, Phone, Search, Smile, Sparkles, Star, Trash2, Video, X } from 'lucide-react'
import { gsap } from 'gsap'

type Speaker = 'friend' | 'you'

type ChatItem =
  | { id: string; kind: 'separator'; text: string }
  | { id: string; kind: 'timestamp'; text: string }
  | { id: string; kind: 'status'; text: string }
  | { id: string; kind: 'seen' }
  | { id: string; kind: 'image'; from: Speaker; src: string; alt: string; time?: string }
  | { id: string; kind: 'message'; from: Speaker; text: string; time?: string; montage?: boolean }

type Scene = 'intro' | 'chat' | 'ending' | 'finale'

const QUOTES = [
  'Friends are the family we choose.',
  "Real friendships don't need daily conversations.",
  'Distance never breaks true friendships.',
  'The best friends make ordinary days legendary.',
  'Some people stay home, no matter how far they are.',
]

const MONTAGE_MESSAGES = [
  'Reached home?',
  '😂😂😂',
  'Send memes.',
  'Call me.',
  'Outside.',
  'Happy Birthday!',
  'Thank you.',
  'Congratulations!',
  'Take care.',
  'Miss you.',
  'Brooooo.',
  'waitingggggg',
  'Done.',
  'Fuck you',
  'dammmn bro',
  'LOL.',
  'Really?',
  'Are you there?',
  'Good night.',
  'Okay.',
  'Come fast.',
  'Where?',
  'Alive?',
  'meet up?',
  'Need chai?',
  'yesssss',
  '😂',
]

const FINAL_LINES = [
  'Dear Best Friend,',
  'Life gets busy.',
  'Chats become shorter.',
  'Meetups become fewer.',
  'But some people never become distant.',
  'Thank you for always being there.',
  'HAPPY FRIENDSHIP DAY ❤️',
]

const UNAVAILABLE_TOAST_TEXT = 'you can not do this'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type UnavailableToastAnchor = 'chat' | 'intro-left' | 'intro-right' | 'chat-top-right' | 'chat-bottom-right'

function App() {
  const [now, setNow] = useState(() => new Date())
  const [unavailableToastAnchor, setUnavailableToastAnchor] = useState<UnavailableToastAnchor>('chat')
  const [scene, setScene] = useState<Scene>('intro')
  const [items, setItems] = useState<ChatItem[]>([])
  const [typing, setTyping] = useState<{ from: Speaker; text?: string } | null>(null)
  const [montageGlow, setMontageGlow] = useState(0)
  const [endingTypingCount, setEndingTypingCount] = useState(0)
  const [finalLineCount, setFinalLineCount] = useState(0)
  const [showSparkles, setShowSparkles] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [toast, setToast] = useState('')
  const [cursor, setCursor] = useState({ x: -100, y: -100 })
  const [showIntroNotification, setShowIntroNotification] = useState(false)

  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const phoneRef = useRef<HTMLDivElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const activeRunIdRef = useRef(0)
  const showProfileRef = useRef(false)

  const particles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 7}s`,
      duration: `${7 + Math.random() * 8}s`,
      size: 2 + Math.floor(Math.random() * 5),
      opacity: 0.2 + Math.random() * 0.35,
    }))
  }, [])

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setCursor({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const chatBody = chatBodyRef.current
    if (!chatBody) return
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' })
  }, [items, typing, finalLineCount])

  useEffect(() => {
    if (!phoneRef.current || scene !== 'finale') return
    gsap.to(phoneRef.current, {
      scale: 0.94,
      duration: 1.5,
      ease: 'power3.out',
    })
  }, [scene])

  useEffect(() => {
    if (scene !== 'chat' || runningRef.current) return

    runningRef.current = true
    const runId = ++activeRunIdRef.current
    void runStory(runId)
  }, [scene])

  useEffect(() => {
    if (scene !== 'intro') {
      setShowIntroNotification(false)
      return
    }

    const timer = window.setTimeout(() => {
      setShowIntroNotification(true)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [scene])

  useEffect(() => {
    showProfileRef.current = showProfile
  }, [showProfile])

  const ensureAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current
    const AudioContextImpl = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextImpl) return null
    const ctx = new AudioContextImpl()
    audioCtxRef.current = ctx
    return ctx
  }

  const playNotification = () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(780, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.14)

    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.17)
  }

  const vibrateSoft = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(16)
    }
  }

  const pushItem = (item: ChatItem) => {
    setItems((prev) => [...prev, item])
  }

  const waitForUnpaused = async () => {
    while (showProfileRef.current) {
      await wait(120)
    }
  }

  const pauseAwareWait = async (ms: number) => {
    let remaining = ms
    while (remaining > 0) {
      await waitForUnpaused()
      const chunk = Math.min(80, remaining)
      await wait(chunk)
      remaining -= chunk
    }
  }

  const showTyping = async (from: Speaker, duration = 1000, text = 'typing...') => {
    await waitForUnpaused()
    setTyping({ from, text })
    await pauseAwareWait(duration)
    setTyping(null)
  }

  const launchConfetti = (amount = 140) => {
    confetti({
      particleCount: amount,
      spread: 90,
      origin: { y: 0.68 },
      colors: ['#4ade80', '#22d3ee', '#60a5fa', '#f9fafb'],
      scalar: 1.05,
      ticks: 260,
    })
  }

  const addMessage = async (
    from: Speaker,
    text: string,
    options?: { time?: string; delay?: number; montage?: boolean; incoming?: boolean },
  ) => {
    await waitForUnpaused()
    pushItem({
      id: `${Date.now()}-${Math.random()}`,
      kind: 'message',
      from,
      text,
      time: options?.time,
      montage: options?.montage,
    })

    if (options?.incoming ?? from === 'friend') {
      playNotification()
      vibrateSoft()
    }

    await pauseAwareWait(options?.delay ?? 720)
  }

  const addSeparator = async (text: string) => {
    await waitForUnpaused()
    pushItem({ id: `${Date.now()}-${Math.random()}`, kind: 'separator', text })
    await pauseAwareWait(540)
  }

  const addStatus = async (text: string, delay = 680) => {
    await waitForUnpaused()
    pushItem({ id: `${Date.now()}-${Math.random()}`, kind: 'status', text })
    await pauseAwareWait(delay)
  }

  const addImage = async (from: Speaker, src: string, alt: string, options?: { time?: string; delay?: number }) => {
    await waitForUnpaused()
    pushItem({
      id: `${Date.now()}-${Math.random()}`,
      kind: 'image',
      from,
      src,
      alt,
      time: options?.time,
    })

    await pauseAwareWait(options?.delay ?? 720)
  }

  const runStory = async (runId: number) => {
    const isRunActive = () => activeRunIdRef.current === runId

    await addSeparator('3 Years Ago')
    if (!isRunActive()) return
    await addMessage('friend', 'Hey 👋', { time: '9:14 PM' })
    if (!isRunActive()) return
    await addMessage('you', 'You free?', { time: '9:15 PM' })
    if (!isRunActive()) return
    await addMessage('friend', 'Bro...')
    if (!isRunActive()) return
    await addMessage('friend', 'Where are you?')
    if (!isRunActive()) return
    await addMessage('you', 'Coming.')
    if (!isRunActive()) return
    await addMessage('friend', 'How long?')
    if (!isRunActive()) return
    await addMessage('you', '5 mins.')
    if (!isRunActive()) return
    await waitForUnpaused()
    pushItem({ id: `${Date.now()}-${Math.random()}`, kind: 'seen' })
    await pauseAwareWait(1200)
    if (!isRunActive()) return
    await addMessage('friend', 'Still coming? 😂')
    if (!isRunActive()) return

    await addSeparator('Last Year')
    if (!isRunActive()) return
    await addMessage('friend', 'Hungry?')
    if (!isRunActive()) return
    await addMessage('you', 'Always.')
    if (!isRunActive()) return
    await addMessage('friend', 'Tea?')
    if (!isRunActive()) return
    await addMessage('you', 'Always.')
    if (!isRunActive()) return
    await addMessage('friend', 'Biryani?')
    if (!isRunActive()) return
    await addMessage('you', 'Say less.')
    if (!isRunActive()) return

    await addSeparator('10 Months Back')
    if (!isRunActive()) return
    await addMessage('friend', 'Need help.')
    if (!isRunActive()) return
    await showTyping('you', 1000)
    if (!isRunActive()) return
    await addMessage('you', 'Location?')
    if (!isRunActive()) return

    await addSeparator('3 Months Back')
    if (!isRunActive()) return
    await addMessage('friend', 'Failed my exam.')
    await pauseAwareWait(1000)
    if (!isRunActive()) return
    await showTyping('you', 1200)
    if (!isRunActive()) return
    await addMessage('you', "We'll figure it out.")
    if (!isRunActive()) return
    await addMessage('you', "I'm with you.")
    if (!isRunActive()) return

    await addSeparator('2 Months Back')
    if (!isRunActive()) return
    await addMessage('friend', 'Got the job!!')
    if (!isRunActive()) return
    await addStatus('🎉', 650)
    if (!isRunActive()) return
    launchConfetti(90)
    await addMessage('you', 'I knew you would ❤️')
    if (!isRunActive()) return
    await addMessage('you', 'Celebration time!!')
    if (!isRunActive()) return

    await addSeparator('Late Night')
    if (!isRunActive()) return
    await addMessage('friend', 'You awake?')
    if (!isRunActive()) return
    await waitForUnpaused()
    pushItem({ id: `${Date.now()}-${Math.random()}`, kind: 'timestamp', text: '2:47 AM' })
    await pauseAwareWait(500)
    if (!isRunActive()) return
    await showTyping('you', 820)
    if (!isRunActive()) return
    await addMessage('you', 'Yeah.')
    if (!isRunActive()) return
    await addMessage('you', "What's up?")
    if (!isRunActive()) return
    await addMessage('friend', 'Need to tell you something.')
    if (!isRunActive()) return
    await showTyping('friend', 920)
    if (!isRunActive()) return
    await addStatus('Deleting...', 640)
    if (!isRunActive()) return
    await showTyping('friend', 930)
    if (!isRunActive()) return
    await addStatus('Deleting...', 680)
    if (!isRunActive()) return
    await addStatus('Finally...', 760)
    if (!isRunActive()) return
    await addMessage('friend', 'Nothing.')
    if (!isRunActive()) return
    await showTyping('you', 920)
    if (!isRunActive()) return
    await addMessage('you', "I'm listening anyway.")
    if (!isRunActive()) return

    await addSeparator('Fast Montage')
    if (!isRunActive()) return
    for (let i = 0; i < MONTAGE_MESSAGES.length; i += 1) {
      if (!isRunActive()) return
      const montageText = MONTAGE_MESSAGES[i]
      if (!montageText) continue
      const delay = Math.max(86, 340 - i * 16)
      const from: Speaker = i % 2 === 0 ? 'friend' : 'you'
      await addMessage(from, montageText, { delay, montage: true, incoming: from === 'friend' })
      if (!isRunActive()) return
      setMontageGlow((i + 1) / MONTAGE_MESSAGES.length)
    }

    if (!isRunActive()) return
    setScene('ending')
    setTyping({ from: 'friend', text: 'typing...' })
    for (let i = 0; i < 3; i += 1) {
      if (!isRunActive()) return
      setEndingTypingCount(i + 1)
      await pauseAwareWait(950)
    }

    await pauseAwareWait(1800)
    if (!isRunActive()) return
    setTyping(null)
    await addSeparator('Now')
    if (!isRunActive()) return
    await addImage('you', `${import.meta.env.BASE_URL}frndssss.jpg`, 'Happy Friendship Day artwork', { delay: 860 })
    if (!isRunActive()) return
    setScene('finale')
    launchConfetti(220)
    setShowSparkles(true)

    for (let i = 0; i < FINAL_LINES.length; i += 1) {
      if (!isRunActive()) return
      setFinalLineCount(i + 1)
      await pauseAwareWait(i === FINAL_LINES.length - 1 ? 1180 : 880)
    }
  }

  const openChat = () => {
    ensureAudio()
    setScene('chat')
  }

  const goToLanding = () => {
    activeRunIdRef.current += 1
    runningRef.current = false
    setScene('intro')
    setItems([])
    setTyping(null)
    setMontageGlow(0)
    setEndingTypingCount(0)
    setFinalLineCount(0)
    setShowSparkles(false)
    setShowProfile(false)
    setToast('')

    if (phoneRef.current) {
      gsap.to(phoneRef.current, {
        scale: 1,
        duration: 0.35,
        ease: 'power2.out',
      })
    }
  }

  const shareLove = () => {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)] ?? 'Friends are the family we choose.'
    setToast(quote)
    launchConfetti(70)
    setTimeout(() => setToast(''), 3600)
  }

  const handleUnavailableAction = (anchor: UnavailableToastAnchor = 'chat') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setUnavailableToastAnchor(anchor)
    setToast(UNAVAILABLE_TOAST_TEXT)
    toastTimerRef.current = window.setTimeout(() => {
      setToast('')
      toastTimerRef.current = null
    }, 2400)
  }

  const chatStatusTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })
  const lastSeenDate = new Date(now.getTime() - 5 * 60 * 1000)
  const lastSeenTime = lastSeenDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const lockDate = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  const lockTime = now
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?(AM|PM)$/i, '')
  const isCompactToast = toast === UNAVAILABLE_TOAST_TEXT

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030b11] text-slate-100">
      <motion.div
        className="pointer-events-none cursor-glow"
        animate={{ x: cursor.x - 140, y: cursor.y - 140 }}
        transition={{ type: 'spring', stiffness: 110, damping: 24, mass: 0.7 }}
      />

      <div className="background-gradient" style={{ opacity: 0.58 + montageGlow * 0.36 }} />
      <div className="background-noise" />

      <div className="pointer-events-none absolute inset-0">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="particle"
            style={{
              left: particle.left,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4 sm:p-8">
        <motion.div
          ref={phoneRef}
          layout
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="phone-shell w-full max-w-sm overflow-hidden rounded-[2.3rem] border border-emerald-100/15 bg-slate-950/68 shadow-2xl shadow-black/45 backdrop-blur-2xl"
        >
          {scene !== 'intro' && (
            <div className="safe-top chat-topbar border-b border-white/15">
              <div className="chat-notch" aria-hidden="true" />

              <div className="chat-status-row">
                <span className="chat-status-left">
                  <span>{chatStatusTime}</span>
                </span>
                <span className="chat-status-right">
                  <span className="chat-signal" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="chat-wifi" aria-hidden="true" />
                  <span className="chat-battery" aria-hidden="true" />
                </span>
              </div>

              <div className="chat-contact-row">
                <div className="chat-contact-left">
                  <button
                    type="button"
                    aria-label="Back to landing"
                    onClick={goToLanding}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/95 transition hover:bg-white/15"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <button type="button" onClick={() => setShowProfile(true)} className="chat-contact-trigger" aria-label="Open contact profile">
                    <div className="chat-avatar" aria-hidden="true" />

                    <div className="chat-contact-meta">
                      <p className="chat-contact-name">Best Friend </p>
                      <p className="chat-contact-subtitle">Last seen today at {lastSeenTime}</p>
                    </div>
                  </button>
                </div>

                <div className="chat-contact-actions">
                  <button type="button" aria-label="Video call" onClick={() => handleUnavailableAction('chat-top-right')} className="chat-action-btn">
                    <Video className="h-[18px] w-[18px]" />
                  </button>
                  <button type="button" aria-label="Voice call" onClick={() => handleUnavailableAction('chat-top-right')} className="chat-action-btn">
                    <Phone className="h-[18px] w-[18px]" />
                  </button>
                  <button type="button" aria-label="More options" onClick={() => handleUnavailableAction('chat-top-right')} className="chat-action-btn">
                    <MoreVertical className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {scene === 'intro' && (
              <motion.section
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="intro-wallpaper relative flex min-h-[min(86svh,760px)] flex-col items-center justify-center gap-8 overflow-hidden px-8 text-center"
              >
                <div className="lockscreen-top absolute left-0 top-0 z-20 flex w-full items-center justify-between px-7 pt-5 text-white/90">
                  <span className="text-sm font-medium tracking-wide">Airtel</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="block h-2.5 w-1 rounded-sm bg-white/90" />
                    <span className="block h-3.5 w-1 rounded-sm bg-white/90" />
                    <span className="block h-[18px] w-1 rounded-sm bg-white/90" />
                    <span className="rounded-md border border-white/65 px-1 py-[1px] text-[10px] font-semibold leading-none">50</span>
                  </div>
                </div>

                <div className="lockscreen-center absolute left-0 top-24 z-20 w-full text-center">
                  <p className="text-[1.25rem] font-medium tracking-tight text-white/90">{lockDate}</p>
                  <p className="lock-time mt-1 font-semibold leading-none text-white/95">{lockTime}</p>
                </div>

                <AnimatePresence>
                  {showIntroNotification && (
                    <motion.div
                      initial={{ opacity: 0, y: -26, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      role="button"
                      tabIndex={0}
                      onClick={openChat}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openChat()
                        }
                      }}
                      className="intro-notification absolute left-1/2 top-[42%] z-30 w-[90%] max-w-[340px] -translate-x-1/2 rounded-3xl border border-white/30 bg-slate-950/66 px-5 py-4 text-left backdrop-blur-xl"
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">New Message</p>
                      <p className="mt-2 text-xl text-slate-100">Hey, Rithvik just sent a message.</p>
                      <p className="mt-3 text-sm font-medium text-emerald-100/90">Tap to open chat</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="lockscreen-bottom absolute inset-x-0 bottom-7 z-20 flex items-center justify-between px-10">
                  <button
                    type="button"
                    aria-label="Flashlight"
                    onClick={() => handleUnavailableAction('intro-left')}
                    className="lockscreen-icon-btn"
                  >
                    <Flashlight className="h-7 w-7 text-white/90" />
                  </button>
                  <button
                    type="button"
                    aria-label="Camera"
                    onClick={() => handleUnavailableAction('intro-right')}
                    className="lockscreen-icon-btn"
                  >
                    <Camera className="h-7 w-7 text-white/90" />
                  </button>
                </div>

                <div className="home-indicator absolute bottom-2 left-1/2 z-20 h-1.5 w-36 -translate-x-1/2 rounded-full bg-white/85" />
              </motion.section>
            )}

            {(scene === 'chat' || scene === 'ending' || scene === 'finale') && (
              <motion.section
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55 }}
                className="relative min-h-[680px]"
              >
                <div
                  ref={chatBodyRef}
                  className={`chat-wallpaper custom-scroll h-[680px] overflow-y-auto px-4 pt-4 ${scene === 'finale' ? 'pb-24' : 'pb-28'}`}
                >
                  <motion.div
                    animate={{ opacity: scene === 'ending' ? 0.2 : 1 }}
                    transition={{ duration: 1.3, ease: 'easeInOut' }}
                    className="space-y-3"
                  >
                    <AnimatePresence initial={false}>
                      {items.map((item, index) => {
                        if (item.kind === 'separator') {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mx-auto my-4 w-fit rounded-full border border-[#9ecdb6]/70 bg-[#f2f8f3]/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4e7b67] shadow-sm"
                            >
                              {item.text}
                            </motion.div>
                          )
                        }

                        if (item.kind === 'timestamp') {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-center text-xs font-semibold tracking-wide text-[#7f8fa8]"
                            >
                              {item.text}
                            </motion.div>
                          )
                        }

                        if (item.kind === 'status') {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center text-xs italic font-medium tracking-wide text-[#8d8a85]"
                            >
                              {item.text}
                            </motion.div>
                          )
                        }

                        if (item.kind === 'seen') {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="ml-auto flex w-fit items-center gap-1 text-xs font-medium text-[#2f9f64]"
                            >
                              Seen <CheckCheck className="h-3.5 w-3.5" />
                            </motion.div>
                          )
                        }

                        if (item.kind === 'image') {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: item.from === 'you' ? 32 : -32, y: 8 }}
                              animate={{ opacity: 1, x: 0, y: 0 }}
                              transition={{ duration: 0.42 }}
                              className={`flex ${item.from === 'you' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className="max-w-[78%] overflow-hidden rounded-[1.65rem] shadow-lg shadow-black/10">
                                <img src={item.src} alt={item.alt} className="block h-auto w-full max-w-[290px] object-cover" />
                                {item.time && (
                                  <div className={`px-2 py-1 text-right text-[10px] ${item.from === 'you' ? 'text-[#4f6f4f]/80' : 'text-[#7a7a7a]'}`}>
                                    {item.time}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        }

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: item.from === 'you' ? 32 : -32, y: 8 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            transition={{
                              delay: item.montage ? Math.max(0.01, 0.03 * index) : 0.02,
                              duration: item.montage ? 0.24 : 0.4,
                            }}
                            className={`flex ${item.from === 'you' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={[
                                'max-w-[84%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-lg',
                                item.from === 'you'
                                  ? 'rounded-br-md border border-[#cde8a8] bg-[#dff9b8] text-[#1f2a1f] shadow-[#b4d98a]/40'
                                  : 'rounded-bl-md border border-[#e8e8e8] bg-[#fbfbfb] text-[#202124] shadow-black/10',
                                item.montage ? 'text-[13px]' : '',
                              ].join(' ')}
                            >
                              <p>{item.text}</p>
                              {item.time && (
                                <div className={`mt-1 flex items-center gap-1 text-[10px] ${item.from === 'you' ? 'justify-end text-[#4f6f4f]/80' : 'text-[#7a7a7a]'}`}>
                                  <span>{item.time}</span>
                                  {item.from === 'you' && <CheckCheck className="h-3 w-3 text-[#2fa866]" />}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>

                    {typing && scene !== 'finale' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${typing.from === 'you' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="typing-bubble">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-cyan-100/70">{typing.text ?? 'typing...'}</span>
                        </div>
                      </motion.div>
                    )}

                    {scene === 'finale' && (
                      <div className="space-y-3 pt-2">
                        <motion.div
                          initial={{ opacity: 0, x: 24, y: 8 }}
                          animate={{ opacity: 1, x: 0, y: 0 }}
                          transition={{ duration: 0.42, delay: 0.1 }}
                          className="flex justify-end"
                        >
                          <div className="max-w-[84%] rounded-3xl rounded-br-md border border-[#cde8a8] bg-[#dff9b8] px-4 py-2.5 text-sm leading-relaxed text-[#1f2a1f] shadow-lg shadow-[#b4d98a]/40">
                            <p className="whitespace-pre-line">
                              {FINAL_LINES.slice(0, finalLineCount).map((line, index) => (
                                <span key={`${line}-${index}`} className={line === 'HAPPY FRIENDSHIP DAY ❤️' ? 'font-bold' : ''}>
                                  {line}
                                  {index < finalLineCount - 1 ? <br /> : null}
                                </span>
                              ))}
                            </p>
                            {finalLineCount > 0 && (
                              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#4f6f4f]/80">
                                <span>{chatStatusTime}</span>
                                <CheckCheck className="h-3 w-3 text-[#2fa866]" />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                </div>

                {(scene === 'chat' || scene === 'ending' || scene === 'finale') && (
                  <div className="chat-composer-wrap absolute inset-x-0 bottom-3 z-30 px-2">
                    <div className="chat-composer mx-auto flex w-full max-w-[344px] items-center gap-2">
                      <div className="chat-composer-field">
                        <button type="button" aria-label="Add emoji" onClick={() => handleUnavailableAction('chat')} className="chat-composer-icon">
                          <Smile className="h-[18px] w-[18px]" />
                        </button>

                        <input
                          type="text"
                          aria-label="Type a message"
                          placeholder="Type a message"
                          readOnly
                          className={`chat-composer-input ${typing || scene === 'ending' ? 'chat-composer-input-hidden' : ''}`}
                        />

                        {(typing || scene === 'ending') && (
                          <div className="chat-composer-typing" aria-hidden="true">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="ml-2 text-[13px] font-semibold text-[#95a39d]">typing... {scene === 'ending' ? '.'.repeat(Math.max(0, endingTypingCount - 1)) : ''}</span>
                          </div>
                        )}

                        <button type="button" aria-label="Open camera" onClick={() => handleUnavailableAction('chat-bottom-right')} className="chat-composer-icon chat-composer-camera">
                          <Camera className="h-[18px] w-[18px]" />
                        </button>
                      </div>

                      <button type="button" aria-label="Voice message" onClick={() => handleUnavailableAction('chat-bottom-right')} className="chat-composer-mic">
                        <Mic className="h-[20px] w-[20px]" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              </motion.section>
            )}
          </AnimatePresence>

          {showProfile && scene !== 'intro' && (
            <div className="profile-panel absolute inset-0 z-[70] overflow-y-auto bg-white text-slate-900">
              <div className="profile-topbar">
                <button type="button" onClick={() => setShowProfile(false)} className="profile-icon-btn" aria-label="Close profile">
                  <X className="h-6 w-6" />
                </button>
                <span className="profile-title">Contact info</span>
                <button type="button" onClick={() => handleUnavailableAction('chat-top-right')} className="profile-icon-btn" aria-label="Edit contact">
                  <Pencil className="h-5 w-5" />
                </button>
              </div>

              <div className="profile-main">
                <div className="profile-avatar">B</div>
                <p className="profile-name">Best Friend</p>
                <p className="profile-number">+91 9949977120</p>

                <div className="profile-quick-actions">
                  <button type="button" onClick={() => handleUnavailableAction('chat-top-right')} className="profile-quick-btn" aria-label="Voice call">
                    <span className="profile-quick-icon"><Phone className="h-6 w-6" /></span>
                    <span>Voice</span>
                  </button>
                  <button type="button" onClick={() => handleUnavailableAction('chat-top-right')} className="profile-quick-btn" aria-label="Video call">
                    <span className="profile-quick-icon"><Video className="h-6 w-6" /></span>
                    <span>Video</span>
                  </button>
                  <button type="button" onClick={() => handleUnavailableAction('chat-top-right')} className="profile-quick-btn" aria-label="Search in chat">
                    <span className="profile-quick-icon"><Search className="h-6 w-6" /></span>
                    <span>Search</span>
                  </button>
                </div>
              </div>

              <div className="profile-section">
                <p className="profile-section-title">About</p>
                <p className="profile-about">Manners, Morals, Elegance and Class 💫</p>
              </div>

              <div className="profile-list">
                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row">
                  <Image className="h-6 w-6" />
                  <span>Media, links and docs</span>
                  <span className="profile-row-meta">1</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row">
                  <Star className="h-6 w-6" />
                  <span>Starred messages</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row">
                  <Heart className="h-6 w-6" />
                  <span>Add to favourites</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row profile-row-danger-text">
                  <CircleMinus className="h-6 w-6" />
                  <span>Clear chat</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row profile-row-danger-text">
                  <Ban className="h-6 w-6" />
                  <span>Block Best Friend</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row profile-row-danger-text">
                  <Flag className="h-6 w-6" />
                  <span>Report Best Friend</span>
                </button>

                <button type="button" onClick={() => handleUnavailableAction('chat-bottom-right')} className="profile-row profile-row-danger-text">
                  <Trash2 className="h-6 w-6" />
                  <span>Delete chat</span>
                </button>
              </div>
            </div>
          )}

          {toast && (
            <motion.div
              initial={{ opacity: 0, y: isCompactToast ? 8 : 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={[
                'absolute z-[90] text-center backdrop-blur-xl',
                isCompactToast
                  ? unavailableToastAnchor === 'intro-left'
                    ? 'bottom-20 left-11 rounded-full border border-emerald-100/35 bg-emerald-300/35 px-3 py-1 text-xs font-semibold text-emerald-50 shadow-md shadow-black/20'
                    : unavailableToastAnchor === 'intro-right'
                      ? 'bottom-20 right-11 rounded-full border border-emerald-100/35 bg-emerald-300/35 px-3 py-1 text-xs font-semibold text-emerald-50 shadow-md shadow-black/20'
                      : unavailableToastAnchor === 'chat-top-right'
                        ? 'top-[78px] right-5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-black/35'
                        : unavailableToastAnchor === 'chat-bottom-right'
                          ? 'bottom-22 right-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-black/35'
                          : 'bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-emerald-100/35 bg-emerald-300/35 px-3 py-1 text-xs font-semibold text-emerald-50 shadow-md shadow-black/20'
                  : 'bottom-8 left-1/2 w-[86%] -translate-x-1/2 rounded-2xl border border-emerald-100/25 bg-emerald-300/20 px-4 py-3 text-sm text-emerald-50',
              ].join(' ')}
            >
              {toast}
            </motion.div>
          )}
        </motion.div>
      </div>

      {showSparkles && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {Array.from({ length: 18 }, (_, i) => (
            <Sparkles
              key={`spark-${i}`}
              className="sparkle absolute text-cyan-100/70"
              style={{
                left: `${6 + Math.random() * 88}%`,
                top: `${14 + Math.random() * 72}%`,
                animationDelay: `${Math.random() * 1.8}s`,
                width: `${8 + Math.random() * 10}px`,
                height: `${8 + Math.random() * 10}px`,
              }}
            />
          ))}
        </div>
      )}
    </main>
  )
}

export default App
