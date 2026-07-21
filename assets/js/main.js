"use strict";
// Find the interactive navigation and status-message elements once, then reuse them.
// The generic type parameters tell TypeScript which HTML element APIs are available.
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
const statusMessage = document.querySelector('[data-status]');
// Return the mobile navigation to its closed and accessible state.
// The guard makes this safe even if the navigation is removed from the HTML later.
const closeMenu = () => {
    if (!menuButton || !menu)
        return;
    menuButton.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
};
// Toggle the mobile menu visually and keep aria-expanded accurate for screen readers.
menuButton?.addEventListener('click', () => {
    if (!menu)
        return;
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menu.classList.toggle('is-open', !isOpen);
});
// Close the mobile menu after selecting a link, or when the Escape key is pressed.
menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
        closeMenu();
});
// Detect whether the visitor has asked their device to minimise animation.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = document.querySelectorAll('.reveal');
// Show everything immediately when reduced motion is preferred or the browser does
// not support IntersectionObserver. Otherwise reveal each element as it enters view.
if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('is-visible'));
}
else {
    const observer = new IntersectionObserver((entries, revealObserver) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting)
                return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: 0.12 });
    reveals.forEach((element) => observer.observe(element));
}
// The mailing list is not connected yet, so give visitors clear, accessible feedback
// instead of sending them to an empty or placeholder link.
document.querySelector('[data-notify]')?.addEventListener('click', () => {
    if (statusMessage)
        statusMessage.textContent = 'Mailing-list link coming soon — check back for the next drop.';
});
// Keep the footer copyright year current without needing a yearly HTML edit.
const year = document.querySelector('[data-year]');
if (year)
    year.textContent = String(new Date().getFullYear());
