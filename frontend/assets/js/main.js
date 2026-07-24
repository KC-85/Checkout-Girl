"use strict";
// Find the interactive navigation and status-message elements once, then reuse them.
// The generic type parameters tell TypeScript which HTML element APIs are available.
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
const statusMessage = document.querySelector('[data-status]');
let statusTimer;
// Show a styled form result briefly, replacing any message or timer left by a
// previous submission.
const showStatus = (message, kind) => {
    if (!statusMessage)
        return;
    window.clearTimeout(statusTimer);
    statusMessage.textContent = message;
    statusMessage.dataset.state = kind;
    statusTimer = window.setTimeout(() => {
        statusMessage.textContent = '';
        delete statusMessage.dataset.state;
        statusTimer = undefined;
    }, 3000);
};
const clearStatus = () => {
    if (!statusMessage)
        return;
    window.clearTimeout(statusTimer);
    statusMessage.textContent = '';
    delete statusMessage.dataset.state;
    statusTimer = undefined;
};
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
// Submit the contact form to the Go API without navigating away from the page.
const contactForm = document.querySelector('[data-contact-form]');
const submitButton = document.querySelector('[data-submit]');
contactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity() || !submitButton)
        return;
    const fields = new FormData(contactForm);
    const payload = Object.fromEntries(fields.entries());
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Sending…';
    clearStatus();
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.message || 'Message could not be sent.');
        contactForm.reset();
        showStatus('Thanks — your message is on its way.', 'success');
    }
    catch (error) {
        showStatus(error instanceof Error ? error.message : 'Message could not be sent. Please try again.', 'error');
    }
    finally {
        submitButton.disabled = false;
        submitButton.setAttribute('aria-busy', 'false');
        submitButton.textContent = 'Send message ↗';
    }
});
// Keep the footer copyright year current without needing a yearly HTML edit.
const year = document.querySelector('[data-year]');
if (year)
    year.textContent = String(new Date().getFullYear());
