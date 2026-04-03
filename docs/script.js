// Mockup tab switcher
document.querySelectorAll("[data-tab-btn]").forEach((btn) => {
	btn.addEventListener("click", () => {
		const group = btn.dataset.tabBtn;
		const targetPanel = btn.dataset.tabTarget;

		// Update buttons
		document.querySelectorAll(`[data-tab-btn="${group}"]`).forEach((b) => {
			b.setAttribute("aria-selected", b === btn ? "true" : "false");
		});

		// Update panels
		document
			.querySelectorAll(`[data-tab-panel="${group}"]`)
			.forEach((panel) => {
				if (panel.dataset.tabId === targetPanel) {
					panel.removeAttribute("hidden");
				} else {
					panel.setAttribute("hidden", "");
				}
			});
	});
});

// Copy to clipboard buttons
document.querySelectorAll("[data-copy]").forEach((btn) => {
	btn.addEventListener("click", () => {
		const text = btn.dataset.copy;
		navigator.clipboard.writeText(text).then(() => {
			const original = btn.textContent;
			btn.textContent = "Copied!";
			btn.classList.add("copied");
			setTimeout(() => {
				btn.textContent = original;
				btn.classList.remove("copied");
			}, 1500);
		});
	});
});

// Nav active state on scroll
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll('.nav-link[href*="#"]');

const observer = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const id = entry.target.id;
				navLinks.forEach((link) => {
					const active = link.getAttribute("href").endsWith(`#${id}`);
					link.classList.toggle("active", active);
				});
			}
		});
	},
	{ rootMargin: "-40% 0px -55% 0px" },
);

sections.forEach((section) => {
	observer.observe(section);
});

// Mobile nav toggle
const navToggle = document.getElementById("nav-toggle");
const navMenu = document.getElementById("nav-menu");
if (navToggle && navMenu) {
	navToggle.addEventListener("click", () => {
		const expanded = navToggle.getAttribute("aria-expanded") === "true";
		navToggle.setAttribute("aria-expanded", String(!expanded));
		navMenu.classList.toggle("open", !expanded);
	});
	// Close on link click
	navMenu.querySelectorAll("a").forEach((link) => {
		link.addEventListener("click", () => {
			navToggle.setAttribute("aria-expanded", "false");
			navMenu.classList.remove("open");
		});
	});
}
