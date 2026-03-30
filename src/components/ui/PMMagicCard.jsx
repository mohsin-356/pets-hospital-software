import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { cn } from '../../lib/utils'

const MOBILE_BREAKPOINT = 768

const createParticleElement = (x, y, color) => {
  const el = document.createElement('div')
  el.className = 'pm-magic-card__particle'
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 8px rgba(${color}, 0.25);
    pointer-events: none;
    z-index: 20;
    left: ${x}px;
    top: ${y}px;
  `
  return el
}

const updateCardGlowProperties = (card, mouseX, mouseY, glow, radius) => {
  const rect = card.getBoundingClientRect()
  const relativeX = ((mouseX - rect.left) / rect.width) * 100
  const relativeY = ((mouseY - rect.top) / rect.height) * 100

  card.style.setProperty('--glow-x', `${relativeX}%`)
  card.style.setProperty('--glow-y', `${relativeY}%`)
  card.style.setProperty('--glow-intensity', glow.toString())
  card.style.setProperty('--glow-radius', `${radius}px`)
}

const useMobileDetection = () => {
  const isMobileRef = useRef(false)

  useEffect(() => {
    const update = () => {
      isMobileRef.current = window.innerWidth <= MOBILE_BREAKPOINT
    }

    update()
    window.addEventListener('resize', update)

    return () => window.removeEventListener('resize', update)
  }, [])

  return isMobileRef
}

export function PMMagicCard({
  className,
  children,
  glowColor = '14, 165, 233',
  particleCount = 12,
  spotlightRadius = 220,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  style,
  ...props
}) {
  const cardRef = useRef(null)
  const spotlightRef = useRef(null)
  const particlesRef = useRef([])
  const timeoutsRef = useRef([])
  const isHoveredRef = useRef(false)
  const memoizedParticles = useRef([])
  const particlesInitialized = useRef(false)
  const isMobileRef = useMobileDetection()

  const shouldDisableAnimations = disableAnimations || isMobileRef.current

  const cssVars = useMemo(() => {
    return {
      '--pm-magic-glow-color': glowColor
    }
  }, [glowColor])

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

    particlesRef.current.forEach(particle => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.25,
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

        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.25, ease: 'back.out(1.7)' })

        gsap.to(clone, {
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 80,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true
        })

        gsap.to(clone, {
          opacity: 0.22,
          duration: 1.4,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true
        })
      }, index * 70)

      timeoutsRef.current.push(timeoutId)
    })
  }, [initializeParticles])

  useEffect(() => {
    if (!cardRef.current) return

    const el = cardRef.current

    const handleMouseEnter = () => {
      if (shouldDisableAnimations) return

      isHoveredRef.current = true
      el.style.setProperty('--glow-intensity', '1')

      if (enableSpotlight && spotlightRef.current) {
        gsap.to(spotlightRef.current, {
          opacity: 1,
          duration: 0.18,
          ease: 'power2.out'
        })
      }

      if (enableStars) {
        animateParticles()
      }
    }

    const handleMouseLeave = () => {
      if (shouldDisableAnimations) return

      isHoveredRef.current = false
      el.style.setProperty('--glow-intensity', '0')

      if (enableSpotlight && spotlightRef.current) {
        gsap.to(spotlightRef.current, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.out'
        })
      }

      clearAllParticles()
    }

    const handleMouseMove = e => {
      if (shouldDisableAnimations) return

      updateCardGlowProperties(el, e.clientX, e.clientY, 1, spotlightRadius)

      if (enableSpotlight && spotlightRef.current) {
        const rect = el.getBoundingClientRect()
        gsap.to(spotlightRef.current, {
          left: e.clientX - rect.left,
          top: e.clientY - rect.top,
          duration: 0.1,
          ease: 'power2.out'
        })
      }
    }

    el.addEventListener('mouseenter', handleMouseEnter)
    el.addEventListener('mouseleave', handleMouseLeave)
    el.addEventListener('mousemove', handleMouseMove)

    return () => {
      isHoveredRef.current = false
      el.removeEventListener('mouseenter', handleMouseEnter)
      el.removeEventListener('mouseleave', handleMouseLeave)
      el.removeEventListener('mousemove', handleMouseMove)
      clearAllParticles()
    }
  }, [animateParticles, clearAllParticles, enableSpotlight, enableStars, shouldDisableAnimations, spotlightRadius])

  return (
    <div
      ref={cardRef}
      className={cn(
        'pm-magic-card',
        enableBorderGlow && 'pm-magic-card--border-glow',
        className
      )}
      style={{ ...style, ...cssVars }}
      {...props}
    >
      {enableSpotlight ? (
        <div
          ref={spotlightRef}
          className="pm-magic-card__spotlight"
          style={{ width: `${spotlightRadius * 3}px`, height: `${spotlightRadius * 3}px` }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
