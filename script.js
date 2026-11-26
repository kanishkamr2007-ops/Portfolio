// Conditionally load popover polyfill only if native Popover API is absent
if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
  import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(() => {});
}

(() => {
  const header = document.getElementById("site-header");
  const headerInner = header?.querySelector(".header-inner");
  const menuButton = header?.querySelector(".menu-button");
  const siteMenu = document.getElementById("site-menu");
  const navLinks = Array.from(document.querySelectorAll('.site-menu a[href^="#"]'));
  const sections = Array.from(document.querySelectorAll("main > section[id]"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ========================================================================
     1. Responsive Navbar Layout Detection (Navbar Guide Pattern)
     ======================================================================== */
  let lastHeaderWidth = 0;

  function syncMenuLayout(forceMeasure = false) {
    if (!header || !headerInner || !siteMenu || !menuButton) return;

    const currentWidth = headerInner.clientWidth;
    const isCurrentlyWide = header.classList.contains("is-wide");

    if (!forceMeasure && !isCurrentlyWide && currentWidth <= lastHeaderWidth) {
      return;
    }
    lastHeaderWidth = currentWidth;

    const wasOpen =
      siteMenu.hasAttribute("popover") &&
      (siteMenu.matches(":popover-open") || siteMenu.classList.contains(":popover-open"));

    header.classList.add("is-measuring");
    header.classList.add("is-wide");
    siteMenu.removeAttribute("popover");

    const fitsInline = headerInner.scrollWidth <= headerInner.clientWidth;

    if (fitsInline) {
      menuButton.setAttribute("aria-expanded", "false");
    } else {
      header.classList.remove("is-wide");
      siteMenu.setAttribute("popover", "auto");
      if (wasOpen && typeof siteMenu.showPopover === "function") {
        try {
          siteMenu.showPopover();
        } catch {
          // Ignore if already open
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove("is-measuring");
    });
  }

  if (headerInner && siteMenu) {
    const resizeObserver = new ResizeObserver(() => syncMenuLayout(false));
    resizeObserver.observe(headerInner);
    resizeObserver.observe(siteMenu);

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => syncMenuLayout(true));
    }
    syncMenuLayout(true);

    siteMenu.addEventListener("toggle", (event) => {
      const open = event.newState === "open";
      menuButton?.setAttribute("aria-expanded", String(open));
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (!header.classList.contains("is-wide") && typeof siteMenu.hidePopover === "function") {
          try {
            if (siteMenu.matches(":popover-open") || siteMenu.classList.contains(":popover-open")) {
              siteMenu.hidePopover();
            }
          } catch {
            // Safe fallback
          }
        }
      });
    });
  }

  /* ========================================================================
     2. Fixed Header Glass Transition & Scroll Progress Fallback
     ======================================================================== */
  const supportsScrollTimeline = CSS.supports("animation-timeline: scroll()");

  function updateScrollUI() {
    const y = window.scrollY;
    header?.classList.toggle("is-scrolled", y > 24);

    if (!supportsScrollTimeline) {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;
      document.documentElement.style.setProperty("--scroll-progress", String(ratio));
    }
  }

  window.addEventListener("scroll", updateScrollUI, { passive: true });
  updateScrollUI();

  /* ========================================================================
     3. Scrollspy Active Link & aria-current Sync
     ======================================================================== */
  const supportsScrollTargetGroup = CSS.supports("scroll-target-group: auto");

  function setActiveNavLink(activeId) {
    navLinks.forEach((link) => {
      const isMatch = link.getAttribute("href") === `#${activeId}`;
      if (isMatch) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
      if (!supportsScrollTargetGroup) {
        link.classList.toggle("target-current", isMatch);
      }
    });
  }

  if (sections.length && navLinks.length) {
    setActiveNavLink("home");
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveNavLink(entry.target.id);
          }
        });
      },
      { rootMargin: "-42% 0px -48% 0px", threshold: 0 }
    );
    sections.forEach((section) => spyObserver.observe(section));
  }

  /* ========================================================================
     4. Scroll-Entry Reveal Fallback (when CSS view() timeline unsupported)
     ======================================================================== */
  const supportsViewTimeline = CSS.supports(
    "(animation-timeline: view()) and (animation-range: entry)"
  );

  if (!supportsViewTimeline && !prefersReducedMotion.matches) {
    const revealEls = document.querySelectorAll(".reveal");
    revealEls.forEach((el) => el.classList.add("will-animate"));

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ========================================================================
     5. Subtle Parallax & Pointer Highlight (Reduced-Motion Safe)
     ======================================================================== */
  if (!prefersReducedMotion.matches) {
    const parallaxLayers = Array.from(document.querySelectorAll(".parallax-layer"));
    let parallaxTicking = false;

    function updateParallax() {
      parallaxTicking = false;
      const scrollY = window.scrollY;
      if (scrollY > window.innerHeight * 1.35) return;

      parallaxLayers.forEach((layer) => {
        const factor = Number(layer.dataset.parallax || 0);
        const offset = Math.round(scrollY * factor * 100) / 100;
        layer.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    }

    if (parallaxLayers.length) {
      window.addEventListener(
        "scroll",
        () => {
          if (!parallaxTicking) {
            parallaxTicking = true;
            requestAnimationFrame(updateParallax);
          }
        },
        { passive: true }
      );
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener(
        "pointermove",
        (event) => {
          document.body.classList.add("has-pointer");
          document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
          document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
        },
        { passive: true }
      );
    }
  }

  /* ========================================================================
     6. Project Inquiry Prefill & Copy Email Helper
     ======================================================================== */
  const subjectInput = document.getElementById("contact-subject");
  document.querySelectorAll("[data-prefill-subject]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (subjectInput) {
        subjectInput.value = trigger.dataset.prefillSubject || "";
        subjectInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });

  document.querySelectorAll(".copy-email-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copy;
      if (!value) return;
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(value);
        btn.textContent = "Copied!";
      } catch {
        btn.textContent = "kanishkamr2007@gmail.com";
      }
      setTimeout(() => {
        btn.textContent = original;
      }, 2200);
    });
  });

  /* ========================================================================
     7. Accessible Form Validation & Mailto Handoff
     ======================================================================== */
  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");

  if (contactForm) {
    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.classList.add("visually-hidden");
    document.body.append(announcer);
    let announceTimer;
    let announcedField;

    const spokenText = (node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      copy
        .querySelectorAll('[role="img"][aria-label]')
        .forEach((n) => n.replaceWith(`${n.getAttribute("aria-label")}: `));
      return copy.textContent.replace(/\s+/g, " ").trim();
    };

    const announceError = (el) => {
      const error = document.getElementById(el.dataset.error);
      if (!error) return;
      const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : "";
      clearTimeout(announceTimer);
      announcer.textContent = "";
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = label + spokenText(error);
      }, 500);
    };

    const supportsUserInvalid = CSS.supports("selector(:user-invalid)");
    const dirtyState = new WeakMap();
    const flagged = new WeakSet();
    const announced = new WeakSet();

    const syncFieldAria = (el, shouldAnnounce = false) => {
      if (!el.matches?.("input, textarea")) return;
      if (el.validity.valid) {
        el.classList.remove("user-invalid-fallback");
      }
      const invalid =
        el.classList.contains("user-invalid-fallback") ||
        (supportsUserInvalid && el.matches(":user-invalid"));

      if (invalid) {
        if (shouldAnnounce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute("aria-invalid", "true");
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
        el.setAttribute("aria-invalid", "false");
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = "";
        }
      }
    };

    if (!supportsUserInvalid) {
      const updateFallbackState = (input) => {
        const isValid = input.validity.valid;
        input.classList.toggle("user-invalid-fallback", !isValid);
        input.classList.toggle("user-valid-fallback", isValid);
      };

      contactForm.addEventListener(
        "blur",
        (e) => {
          const input = e.target;
          if (!input.checkValidity) return;
          const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
          state.hasBlurred = true;
          dirtyState.set(input, state);
          if (state.hasInteracted) updateFallbackState(input);
        },
        true
      );

      contactForm.addEventListener("input", (e) => {
        const input = e.target;
        if (!input.checkValidity) return;
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(input, state);
        if (state.hasBlurred) updateFallbackState(input);
      });

      contactForm.addEventListener(
        "invalid",
        (e) => {
          const input = e.target;
          if (!input.checkValidity) return;
          dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
          updateFallbackState(input);
        },
        true
      );
    }

    contactForm.querySelectorAll("input, textarea").forEach((el) => syncFieldAria(el));

    contactForm.addEventListener("blur", (e) => syncFieldAria(e.target, true), true);
    contactForm.addEventListener("input", (e) => {
      if (e.target.hasAttribute("aria-invalid")) syncFieldAria(e.target);
    });
    contactForm.addEventListener(
      "invalid",
      (e) => {
        announced.add(e.target);
        syncFieldAria(e.target);
      },
      true
    );

    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const fields = Array.from(contactForm.querySelectorAll("input, textarea"));
      let firstInvalid = null;

      fields.forEach((field) => {
        if (!field.checkValidity()) {
          if (!firstInvalid) firstInvalid = field;
          dirtyState.set(field, { hasInteracted: true, hasBlurred: true });
          field.classList.add("user-invalid-fallback");
          field.classList.remove("user-valid-fallback");
        }
        syncFieldAria(field);
      });

      if (firstInvalid) {
        firstInvalid.focus();
        if (formStatus) {
          formStatus.textContent = "Please review the highlighted fields before sending.";
        }
        return;
      }

      const data = new FormData(contactForm);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const subject = String(data.get("subject") || "").trim();
      const message = String(data.get("message") || "").trim();

      const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
      const mailtoUrl = `mailto:kanishkamr2007@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (formStatus) {
        formStatus.textContent = `Opening your email client to send "${subject}" to kanishkamr2007@gmail.com.`;
      }

      window.location.href = mailtoUrl;
    });
  }
})();
