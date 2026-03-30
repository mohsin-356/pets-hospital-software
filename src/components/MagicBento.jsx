import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { gsap } from 'gsap'

const DEFAULT_PARTICLE_COUNT = 12
const DEFAULT_SPOTLIGHT_RADIUS = 220
const DEFAULT_GLOW_COLOR = '14, 165, 233'
const MOBILE_BREAKPOINT = 768

const defaultCardData = [
  {
    title: 'Secure Access',
    description: 'Role-based portals for staff',
    label: 'Authentication'
  },
  {
    title: 'Fast Workflows',
    description: 'Designed for busy clinics',
    label: 'Speed'
  },
  {
    title: 'Appointments',
    description: 'Track visits & schedules',
    label: 'Planning'
  },
  {
    title: 'Billing',
    description: 'Invoices & payments',
    label: 'Finance'
  },
  {
    title: 'Inventory',
    description: 'Medicines & stock control',
    label: 'Pharmacy'
  },
  {
    title: 'Reports',
    description: 'Insights & summaries',
    label: 'Analytics'
  }
]

const createParticleElement = (x, y, color) => {
  const el = document.createElement('div')
  el.className = 'pm-magic-bento__particle'
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.35);
    pointer-events: none;
    z-index: 40;
    left: ${x}px;
    top: ${y}px;
  `
  return el
}

const calculateSpotlightValues = radius => ({
  proximity: radius * 0.5,
  fadeDistance: radius * 0.75
})

const updateCardGlowProperties = (card, mouseX, mouseY, glow, radius) => {
  const rect = card.getBoundingClientRect()
  const relativeX = ((mouseX - rect.left) / rect.width) * 100
  const relativeY = ((mouseY - rect.top) / rect.height) * 100

  card.style.setProperty('--glow-x', `${relativeX}%`)
  card.style.setProperty('--glow-y', `${relativeY}%`)
  card.style.setProperty('--glow-intensity', glow.toString())
  card.style.setProperty('--glow-radius', `${radius}px`)
}

const ParticleCard = ({
  children,
  className = '',
  disableAnimations = false,
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  enableTilt = false,
  clickEffect = true,
  enableMagnetism = true
}) => {
  const cardRef = useRef(null)
  const particlesRef = useRef([])
  const timeoutsRef = useRef([])
  const isHoveredRef = useRef(false)
  const memoizedParticles = useRef([])
  const particlesInitialized = useRef(false)
  const magnetismAnimationRef = useRef(null)

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return

    const { width, height } = cardRef.current.getBoundingClientRect()
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor)
    )
    particlesInitialized.current = true
  }, [particleCount, glowColor])

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    magnetismAnimationRef.current?.kill()

    particlesRef.current.forEach(particle => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          particle.parentNode?.removeChild(particle)
        }
      })
    })
    particlesRef.current = []
  }, [])

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return

    if (!particlesInitialized.current) {
      initializeParticles()
    }

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return

        const clone = particle.cloneNode(true)
        cardRef.current.appendChild(clone)
        particlesRef.current.push(clone)

        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' })

        gsap.to(clone, {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true
        })

        gsap.to(clone, {
          opacity: 0.25,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true
        })
      }, index * 90)

      timeoutsRef.current.push(timeoutId)
    })
  }, [initializeParticles])

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return

    const element = cardRef.current

    const handleMouseEnter = () => {
      isHoveredRef.current = true
      animateParticles()

      if (enableTilt) {
        gsap.to(element, {
          rotateX: 5,
          rotateY: 5,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000
        })
      }
    }

    const handleMouseLeave = () => {
      isHoveredRef.current = false
      clearAllParticles()

      if (enableTilt) {
        gsap.to(element, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.3,
          ease: 'power2.out'
        })
      }

      if (enableMagnetism) {
        gsap.to(element, {
          x: 0,
          y: 0,
          duration: 0.3,
          ease: 'power2.out'
        })
      }
    }

    const handleMouseMove = e => {
      if (!enableTilt && !enableMagnetism) return

      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      if (enableTilt) {
        const rotateX = ((y - centerY) / centerY) * -10
        const rotateY = ((x - centerX) / centerX) * 10

        gsap.to(element, {
          rotateX,
          rotateY,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000
        })
      }

      if (enableMagnetism) {
        const magnetX = (x - centerX) * 0.05
        const magnetY = (y - centerY) * 0.05

        magnetismAnimationRef.current = gsap.to(element, {
          x: magnetX,
          y: magnetY,
          duration: 0.3,
          ease: 'power2.out'
        })
      }
    }

    const handleClick = e => {
      if (!clickEffect) return

      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height)
      )

      const ripple = document.createElement('div')
      ripple.style.cssText = `
        position: absolute;
        width: ${maxDistance * 2}px;
        height: ${maxDistance * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.25) 0%, rgba(${glowColor}, 0.12) 30%, transparent 70%);
        left: ${x - maxDistance}px;
        top: ${y - maxDistance}px;
        pointer-events: none;
        z-index: 30;
      `

      element.appendChild(ripple)

      gsap.fromTo(
        ripple,
        {
          scale: 0,
          opacity: 1
        },
        {
          scale: 1,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => ripple.remove()
        }
      )
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('click', handleClick)

    return () => {
      isHoveredRef.current = false
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('click', handleClick)
      clearAllParticles()
    }
  }, [animateParticles, clearAllParticles, disableAnimations, enableTilt, enableMagnetism, clickEffect, glowColor])

  return (
    <div
      ref={cardRef}
      className={`${className} relative overflow-hidden`}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {children}
    </div>
  )
}

const GlobalSpotlight = ({
  sectionRef,
  gridRef,
  disableAnimations = false,
  enabled = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = DEFAULT_GLOW_COLOR
}) => {
  const spotlightRef = useRef(null)

  useEffect(() => {
    if (disableAnimations || !gridRef?.current || !sectionRef?.current || !enabled) return

    const section = sectionRef.current

    const spotlight = document.createElement('div')
    spotlight.className = 'pm-magic-bento__spotlight'
    spotlight.style.cssText = `
      position: absolute;
      width: 700px;
      height: 700px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.18) 0%,
        rgba(${glowColor}, 0.10) 18%,
        rgba(${glowColor}, 0.05) 28%,
        rgba(${glowColor}, 0.03) 40%,
        rgba(${glowColor}, 0.015) 65%,
        transparent 70%
      );
      z-index: 5;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: multiply;
    `

    section.appendChild(spotlight)
    spotlightRef.current = spotlight

    const handleMouseMove = e => {
      if (!spotlightRef.current || !gridRef.current || !sectionRef.current) return

      const rect = sectionRef.current.getBoundingClientRect()
      const mouseInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom

      const cards = gridRef.current.querySelectorAll('.pm-magic-bento__card')

      if (!mouseInside) {
        gsap.to(spotlightRef.current, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.out'
        })
        cards.forEach(card => {
          card.style.setProperty('--glow-intensity', '0')
        })
        return
      }

      const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius)
      let minDistance = Infinity

      cards.forEach(card => {
        const cardRect = card.getBoundingClientRect()
        const centerX = cardRect.left + cardRect.width / 2
        const centerY = cardRect.top + cardRect.height / 2
        const distance =
          Math.hypot(e.clientX - centerX, e.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2
        const effectiveDistance = Math.max(0, distance)

        minDistance = Math.min(minDistance, effectiveDistance)

        let glowIntensity = 0
        if (effectiveDistance <= proximity) {
          glowIntensity = 1
        } else if (effectiveDistance <= fadeDistance) {
          glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity)
        }

        updateCardGlowProperties(card, e.clientX, e.clientY, glowIntensity, spotlightRadius)
      })

      gsap.to(spotlightRef.current, {
        left: e.clientX - rect.left,
        top: e.clientY - rect.top,
        duration: 0.1,
        ease: 'power2.out'
      })

      const targetOpacity =
        minDistance <= proximity ? 0.9 : minDistance <= fadeDistance ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.9 : 0

      gsap.to(spotlightRef.current, {
        opacity: targetOpacity,
        duration: targetOpacity > 0 ? 0.18 : 0.35,
        ease: 'power2.out'
      })
    }

    const handleMouseLeave = () => {
      gridRef.current?.querySelectorAll('.pm-magic-bento__card').forEach(card => {
        card.style.setProperty('--glow-intensity', '0')
      })
      if (spotlightRef.current) {
        gsap.to(spotlightRef.current, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.out'
        })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    section.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      section.removeEventListener('mouseleave', handleMouseLeave)
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current)
    }
  }, [sectionRef, gridRef, disableAnimations, enabled, spotlightRadius, glowColor])

  return null
}

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export default function MagicBento({
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
  cardData = defaultCardData
}) {
  const sectionRef = useRef(null)
  const gridRef = useRef(null)
  const isMobile = useMobileDetection()
  const shouldDisableAnimations = disableAnimations || isMobile

  const cssVars = useMemo(() => {
    return {
      '--pm-magic-bento-glow-color': glowColor
    }
  }, [glowColor])

  return (
    <div ref={sectionRef} className="pm-magic-bento relative" style={cssVars}>
      <style>
        {`
          .pm-magic-bento {
            --glow-x: 50%;
            --glow-y: 50%;
            --glow-intensity: 0;
            --glow-radius: 220px;
            --glow-color: var(--pm-magic-bento-glow-color);
            --border-color: rgba(59, 130, 246, 0.22);
            --surface: hsla(0, 0%, 100%, 0.86);
            --surface-strong: hsla(0, 0%, 100%, 1);
            --text: hsl(var(--pm-text));
            --muted: hsl(var(--pm-text-muted));
          }

          .pm-magic-bento__grid {
            display: grid;
            gap: 0.5rem;
            width: 100%;
            padding: 0.75rem;
            position: relative;
            z-index: 2;
          }

          .pm-magic-bento__layout {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }

          @media (min-width: 600px) {
            .pm-magic-bento__layout {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (min-width: 1024px) {
            .pm-magic-bento__layout {
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }

            .pm-magic-bento__layout .pm-magic-bento__card:nth-child(3) {
              grid-column: span 2;
              grid-row: span 2;
            }

            .pm-magic-bento__layout .pm-magic-bento__card:nth-child(4) {
              grid-column: 1 / span 2;
              grid-row: 2 / span 2;
            }

            .pm-magic-bento__layout .pm-magic-bento__card:nth-child(6) {
              grid-column: 4;
              grid-row: 3;
            }
          }

          .pm-magic-bento__card {
            position: relative;
            aspect-ratio: 4 / 3;
            min-height: 170px;
            width: 100%;
            padding: 1.1rem;
            border-radius: 18px;
            border: 1px solid var(--border-color);
            background: var(--surface);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            overflow: hidden;
            transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
            color: var(--text);
          }

          .pm-magic-bento__card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08), 0 0 28px rgba(59, 130, 246, 0.10);
          }

          .pm-magic-bento__card--border-glow::after {
            content: '';
            position: absolute;
            inset: 0;
            padding: 6px;
            background: radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y),
                rgba(var(--glow-color), calc(var(--glow-intensity) * 0.65)) 0%,
                rgba(var(--glow-color), calc(var(--glow-intensity) * 0.3)) 30%,
                transparent 60%);
            border-radius: inherit;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
            opacity: 1;
            z-index: 1;
          }

          .pm-magic-bento__particle::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: rgba(var(--glow-color), 0.12);
            border-radius: 50%;
            z-index: -1;
          }

          .pm-magic-bento__text-clamp-1 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .pm-magic-bento__text-clamp-2 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}
      </style>

      {enableSpotlight && (
        <GlobalSpotlight
          sectionRef={sectionRef}
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
        />
      )}

      <div className="pm-magic-bento__grid" ref={gridRef}>
        <div className="pm-magic-bento__layout">
          {cardData.map((card, index) => {
            const baseClassName = `pm-magic-bento__card ${enableBorderGlow ? 'pm-magic-bento__card--border-glow' : ''}`

            const headerClass = 'flex justify-between gap-3 relative'
            const labelClass = 'text-sm font-medium text-[hsl(var(--pm-text-muted))]'
            const titleClass = `text-sm font-semibold m-0 mb-1 ${textAutoHide ? 'pm-magic-bento__text-clamp-1' : ''}`
            const descClass = `text-xs leading-5 text-[hsl(var(--pm-text-muted))] ${textAutoHide ? 'pm-magic-bento__text-clamp-2' : ''}`

            if (enableStars) {
              return (
                <ParticleCard
                  key={index}
                  className={baseClassName}
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
                  disableAnimations={shouldDisableAnimations}
                  particleCount={particleCount}
                  glowColor={glowColor}
                  enableTilt={enableTilt}
                  clickEffect={clickEffect}
                  enableMagnetism={enableMagnetism}
                >
                  <div className={headerClass}>
                    <span className={labelClass}>{card.label}</span>
                  </div>
                  <div className="flex flex-col relative">
                    <h3 className={titleClass}>{card.title}</h3>
                    <p className={descClass}>{card.description}</p>
                  </div>
                </ParticleCard>
              )
            }

            return (
              <div
                key={index}
                className={baseClassName}
                style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
              >
                <div className={headerClass}>
                  <span className={labelClass}>{card.label}</span>
                </div>
                <div className="flex flex-col relative">
                  <h3 className={titleClass}>{card.title}</h3>
                  <p className={descClass}>{card.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
