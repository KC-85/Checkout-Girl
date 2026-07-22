// Find the interactive navigation and status-message elements once, then reuse them.
// The generic type parameters tell TypeScript which HTML element APIs are available.
const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
const statusMessage = document.querySelector<HTMLElement>('[data-status]');

// Return the mobile navigation to its closed and accessible state.
// The guard makes this safe even if the navigation is removed from the HTML later.
const closeMenu = (): void => {
  if (!menuButton || !menu) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
};

// Toggle the mobile menu visually and keep aria-expanded accurate for screen readers.
menuButton?.addEventListener('click', () => {
  if (!menu) return;
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menu.classList.toggle('is-open', !isOpen);
});

// Close the mobile menu after selecting a link, or when the Escape key is pressed.
menu?.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu();
});

// Detect whether the visitor has asked their device to minimise animation.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = document.querySelectorAll<HTMLElement>('.reveal');

// Show everything immediately when reduced motion is preferred or the browser does
// not support IntersectionObserver. Otherwise reveal each element as it enters view.
if (reduceMotion || !('IntersectionObserver' in window)) {
  reveals.forEach((element) => element.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  reveals.forEach((element) => observer.observe(element));
}

// Submit the contact form to the Go API without navigating away from the page.
const contactForm = document.querySelector<HTMLFormElement>('[data-contact-form]');
const submitButton = document.querySelector<HTMLButtonElement>('[data-submit]');

contactForm?.addEventListener('submit', async (event: SubmitEvent) => {
  event.preventDefault();
  if (!contactForm.reportValidity() || !submitButton) return;

  const fields = new FormData(contactForm);
  const payload = Object.fromEntries(fields.entries());
  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';
  if (statusMessage) statusMessage.textContent = '';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) throw new Error(result.message || 'Message could not be sent.');
    contactForm.reset();
    if (statusMessage) statusMessage.textContent = 'Thanks — your message is on its way.';
  } catch (error) {
    if (statusMessage) {
      statusMessage.textContent = error instanceof Error ? error.message : 'Message could not be sent. Please try again.';
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send message ↗';
  }
});

// Keep the footer copyright year current without needing a yearly HTML edit.
const year = document.querySelector<HTMLElement>('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
