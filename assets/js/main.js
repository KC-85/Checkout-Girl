// Main JS for Checkout Girl
// Features:
// - Smooth scrolling for in-page anchors
// - Ensure only one audio plays at a time
// - "Listen" buttons toggle play/pause for their associated audio

document.addEventListener('DOMContentLoaded', function () {
  // Initialize hero carousel (Bootstrap) with 7s interval and pause on hover
  try {
    const heroEl = document.getElementById('heroCarousel');
    var heroCarousel = null;
    if (heroEl && window.bootstrap && window.bootstrap.Carousel) {
      heroCarousel = new bootstrap.Carousel(heroEl, { interval: 7000, ride: 'carousel', pause: 'hover' });
    }

    // Respect prefers-reduced-motion: pause carousel if user prefers reduced motion
    try {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced && heroCarousel && typeof heroCarousel.pause === 'function') {
        heroCarousel.pause();
      }
    } catch (e) {
      // ignore
    }

    // Accessible pause/play control for carousel (required to let users stop moving content)
    const carouselPauseBtn = document.getElementById('carouselPause');
    if (carouselPauseBtn && heroCarousel) {
      carouselPauseBtn.addEventListener('click', function () {
        const isPaused = carouselPauseBtn.getAttribute('aria-pressed') === 'true';
        if (isPaused) {
          if (typeof heroCarousel.cycle === 'function') heroCarousel.cycle();
          carouselPauseBtn.setAttribute('aria-pressed', 'false');
          carouselPauseBtn.textContent = 'Pause';
          carouselPauseBtn.setAttribute('aria-label', 'Pause carousel');
        } else {
          if (typeof heroCarousel.pause === 'function') heroCarousel.pause();
          carouselPauseBtn.setAttribute('aria-pressed', 'true');
          carouselPauseBtn.textContent = 'Play';
          carouselPauseBtn.setAttribute('aria-label', 'Play carousel');
        }
      });
    }
  } catch (err) {
    // ignore if bootstrap not available
    console.warn('Carousel init failed', err);
  }

  // Theme toggle (light/dark) - persists choice in localStorage
  const themeToggle = document.getElementById('themeToggle');
  const rootBody = document.body;
  const stored = localStorage.getItem('cg-theme');
  if (stored === 'dark') rootBody.classList.add('dark-mode');
  if (stored === 'light') rootBody.classList.remove('dark-mode');
  if (themeToggle) {
    const updateButton = () => themeToggle.setAttribute('aria-pressed', rootBody.classList.contains('dark-mode') ? 'true' : 'false');
    updateButton();
    themeToggle.addEventListener('click', () => {
      const isDark = rootBody.classList.toggle('dark-mode');
      localStorage.setItem('cg-theme', isDark ? 'dark' : 'light');
      updateButton();
    });
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // update focus for accessibility
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        window.setTimeout(() => target.removeAttribute('tabindex'), 1000);
      }
    });
  });

  // Audio controls: allow only one audio to play at a time
  const audios = Array.from(document.querySelectorAll('audio'));
  if (audios.length) {
    audios.forEach(a => {
      a.addEventListener('play', function () {
        audios.forEach(other => {
          if (other !== a && !other.paused) other.pause();
        });
      });
    });
  }

  // Wire up .btn-retro "Listen" buttons to toggle the nearest audio element
  document.querySelectorAll('.btn-retro').forEach(btn => {
    btn.addEventListener('click', function (e) {
      // Try to find nearest audio in same card
      const card = btn.closest('.music-card');
      let audio = null;
      if (card) audio = card.querySelector('audio');
      if (!audio) {
        // fallback: first audio on page
        audio = document.querySelector('audio');
      }
      if (!audio) return;

      if (audio.paused) {
        // pause others
        audios.forEach(other => { if (!other.paused) other.pause(); });
        audio.play().catch(() => {
          // user gesture required in some browsers
        });
      } else {
        audio.pause();
      }
    });
  });

  // Update UI and announce audio playback state to assistive tech
  const audioStatus = document.getElementById('audioStatus');
  audios.forEach(a => {
    a.addEventListener('play', () => {
      const card = a.closest('.music-card');
      if (card) {
        card.classList.add('audio-playing');
        const btn = card.querySelector('.btn-retro');
        if (btn) { btn.classList.add('playing'); btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true'); }
        if (audioStatus) audioStatus.textContent = `Playing ${card.querySelector('h3')?.textContent || 'track'}`;
      }
    });
    a.addEventListener('pause', () => {
      const card = a.closest('.music-card');
      if (card) {
        card.classList.remove('audio-playing');
        const btn = card.querySelector('.btn-retro');
        if (btn) { btn.classList.remove('playing'); btn.textContent = 'Listen'; btn.setAttribute('aria-pressed', 'false'); }
        if (audioStatus) audioStatus.textContent = `Paused ${card.querySelector('h3')?.textContent || 'track'}`;
      }
    });
    a.addEventListener('ended', () => {
      const card = a.closest('.music-card');
      if (card) {
        card.classList.remove('audio-playing');
        const btn = card.querySelector('.btn-retro');
        if (btn) { btn.classList.remove('playing'); btn.textContent = 'Listen'; btn.setAttribute('aria-pressed', 'false'); }
        if (audioStatus) audioStatus.textContent = `${card.querySelector('h3')?.textContent || 'Track'} ended`;
      }
    });
  });

});
