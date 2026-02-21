// Main JS for Checkout Girl
// Features:
// - Smooth scrolling for in-page anchors
// - Ensure only one audio plays at a time
// - "Listen" buttons toggle play/pause for their associated audio

document.addEventListener('DOMContentLoaded', function () {
  // Initialize hero carousel (Bootstrap) with 7s interval and pause on hover
  try {
    const heroEl = document.getElementById('heroCarousel');
    if (heroEl && window.bootstrap && window.bootstrap.Carousel) {
      new bootstrap.Carousel(heroEl, { interval: 7000, ride: 'carousel', pause: 'hover' });
    }
  } catch (err) {
    // ignore if bootstrap not available
    console.warn('Carousel init failed', err);
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
        audio.play().then(() => {
          btn.classList.add('playing');
          btn.textContent = 'Pause';
        }).catch(() => {
          // user gesture required in some browsers
        });
      } else {
        audio.pause();
        btn.classList.remove('playing');
        btn.textContent = 'Listen';
      }

      // keep button label in sync if user uses native controls
      audio.addEventListener('pause', () => { btn.classList.remove('playing'); btn.textContent = 'Listen'; });
      audio.addEventListener('ended', () => { btn.classList.remove('playing'); btn.textContent = 'Listen'; });
    });
  });

  // Optional: show a small visual when audio is playing (adds class to card)
  audios.forEach(a => {
    a.addEventListener('play', () => {
      const card = a.closest('.music-card');
      if (card) card.classList.add('audio-playing');
    });
    a.addEventListener('pause', () => {
      const card = a.closest('.music-card');
      if (card) card.classList.remove('audio-playing');
    });
    a.addEventListener('ended', () => {
      const card = a.closest('.music-card');
      if (card) card.classList.remove('audio-playing');
    });
  });

});
