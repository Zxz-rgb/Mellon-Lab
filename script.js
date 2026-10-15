function wrapIndex(index, length) {
  if (length <= 0) return 0;

  while (index < 0) index += length;
  while (index >= length) index -= length;
  return index;
}

function createLoopedCardSet(carousel, originalCards) {
  const count = originalCards.length;

  originalCards.forEach((card, index) => {
    card.dataset.loopIndex = String(index);
    card.dataset.loopRole = "original";
  });

  function makeClone(card, index, role) {
    const clone = card.cloneNode(true);
    clone.dataset.loopIndex = String(index);
    clone.dataset.loopRole = role;
    clone.classList.remove("is-active");
    clone.removeAttribute("aria-current");
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    return clone;
  }

  const leadingClones = originalCards.map((card, index) => makeClone(card, index, "leading"));
  const trailingClones = originalCards.map((card, index) => makeClone(card, index, "trailing"));

  carousel.prepend(...leadingClones);
  carousel.append(...trailingClones);

  return {
    cards: [...leadingClones, ...originalCards, ...trailingClones],
    canonicalOffset: count,
    count,
  };
}

function createOverlappingCarousel({ carouselSelector, cardSelector, countSelector, initialIndex }) {
  const carousel = document.querySelector(carouselSelector);
  const originalCards = Array.from(document.querySelectorAll(cardSelector));
  const count = document.querySelector(countSelector);

  if (!carousel || originalCards.length === 0) {
    return null;
  }

  const loop = createLoopedCardSet(carousel, originalCards);
  const cards = loop.cards;
  let activeIndex = wrapIndex(initialIndex, loop.count);
  let activeRenderedIndex = loop.canonicalOffset + activeIndex;
  let scrollFrame = null;
  let settleTimer = null;
  let pointerStartX = 0;
  let pointerTravel = 0;
  let pointerIsDown = false;

  function getNearestRenderedIndex() {
    const carouselBox = carousel.getBoundingClientRect();
    const carouselCenter = carouselBox.left + carouselBox.width / 2;
    let nearestIndex = 0;
    let shortestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardBox = card.getBoundingClientRect();
      const cardCenter = cardBox.left + cardBox.width / 2;
      const distance = Math.abs(cardCenter - carouselCenter);

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  function setActiveCard(renderedIndex) {
    activeRenderedIndex = Math.max(0, Math.min(renderedIndex, cards.length - 1));
    activeIndex = Number(cards[activeRenderedIndex].dataset.loopIndex);

    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeRenderedIndex;
      card.classList.toggle("is-active", isActive);
      if (card.dataset.loopRole === "original") {
        card.setAttribute("aria-current", isActive ? "true" : "false");
      }
    });

    if (count) {
      count.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(loop.count).padStart(2, "0")}`;
    }
  }

  function centerRenderedCard(renderedIndex, behavior = "smooth") {
    const safeIndex = Math.max(0, Math.min(renderedIndex, cards.length - 1));
    const card = cards[safeIndex];
    const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
    carousel.scrollTo({ left, behavior });
    setActiveCard(safeIndex);
  }

  function restoreCanonicalPosition() {
    if (pointerIsDown) return;
    const nearest = getNearestRenderedIndex();
    const card = cards[nearest];

    if (card.dataset.loopRole !== "original") {
      centerRenderedCard(loop.canonicalOffset + Number(card.dataset.loopIndex), "auto");
    }
  }

  function scheduleCanonicalRestore() {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(restoreCanonicalPosition, 110);
  }

  function syncActiveCard() {
    if (scrollFrame) {
      cancelAnimationFrame(scrollFrame);
    }

    scrollFrame = requestAnimationFrame(() => {
      setActiveCard(getNearestRenderedIndex());
      scheduleCanonicalRestore();
      scrollFrame = null;
    });
  }

  function centerCard(index, behavior = "smooth") {
    const logicalIndex = wrapIndex(index, loop.count);
    centerRenderedCard(loop.canonicalOffset + logicalIndex, behavior);
  }

  carousel.addEventListener("scroll", syncActiveCard, { passive: true });
  window.addEventListener("resize", syncActiveCard, { passive: true });

  carousel.addEventListener("pointerdown", (event) => {
    pointerStartX = event.clientX;
    pointerTravel = 0;
    pointerIsDown = true;
  });

  carousel.addEventListener("pointermove", (event) => {
    if (pointerIsDown) {
      pointerTravel = Math.max(pointerTravel, Math.abs(event.clientX - pointerStartX));
    }
  });

  carousel.addEventListener("pointerup", () => {
    pointerIsDown = false;
    scheduleCanonicalRestore();
  });

  carousel.addEventListener("pointercancel", () => {
    pointerIsDown = false;
    scheduleCanonicalRestore();
  });

  cards.forEach((card, renderedIndex) => {
    card.addEventListener("click", (event) => {
      if (pointerTravel > 8) {
        event.preventDefault();
        return;
      }

      if (renderedIndex !== activeRenderedIndex) {
        event.preventDefault();
        centerRenderedCard(renderedIndex);
        return;
      }

      if (card.dataset.placeholder === "true") {
        event.preventDefault();
      }
    });
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    centerRenderedCard(activeRenderedIndex + direction);
  });

  setActiveCard(activeRenderedIndex);
  return { center: centerCard, sync: syncActiveCard };
}

const serviceCarousel = createOverlappingCarousel({
  carouselSelector: "#serviceCarousel",
  cardSelector: "#serviceCarousel .service-card",
  countSelector: "#carouselCount",
  initialIndex: 5,
});

const mentorCarousel = createOverlappingCarousel({
  carouselSelector: "#mentorCarousel",
  cardSelector: "#mentorCarousel .service-card",
  countSelector: "#mentorCarouselCount",
  initialIndex: 2,
});

const pastProjectCarousel = createOverlappingCarousel({
  carouselSelector: "#pastProjectCarousel",
  cardSelector: "#pastProjectCarousel .service-card",
  countSelector: "#pastProjectCarouselCount",
  initialIndex: 2,
});

function createProgramStack() {
  const carousel = document.querySelector("#programCarousel");
  const originalCards = Array.from(document.querySelectorAll("#programCarousel .program-card"));
  const schoolLabel = document.querySelector("#programSchool");
  const programLabel = document.querySelector("#programName");
  const count = document.querySelector("#programCarouselCount");
  const search = document.querySelector(".program-search");
  const searchInput = document.querySelector("#programSearch");
  const searchClear = document.querySelector("#programSearchClear");
  const searchResults = document.querySelector("#programSearchResults");

  if (!carousel || originalCards.length === 0) {
    return null;
  }

  originalCards.forEach((card) => {
    if (card.querySelector(".program-card__logo")) return;

    const logo = document.createElement("span");
    const schoolMark = card.querySelector(".program-card__school")?.textContent?.trim();
    logo.className = "program-card__logo";
    logo.setAttribute("aria-hidden", "true");
    logo.textContent = schoolMark || card.dataset.school || "";
    card.appendChild(logo);
  });

  const loop = createLoopedCardSet(carousel, originalCards);
  const cards = loop.cards;
  let activeIndex = 11;
  let activeRenderedIndex = loop.canonicalOffset + activeIndex;
  let scrollFrame = null;
  let settleTimer = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerCard = null;
  let pointerTravel = 0;
  let pointerIsDown = false;
  let suppressClickUntil = 0;

  function nearestRenderedIndex() {
    const box = carousel.getBoundingClientRect();
    const center = box.left + box.width / 2;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardBox = card.getBoundingClientRect();
      const nextDistance = Math.abs(cardBox.left + cardBox.width / 2 - center);

      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });

    return nearest;
  }

  function setActive(renderedIndex) {
    activeRenderedIndex = Math.max(0, Math.min(renderedIndex, cards.length - 1));
    activeIndex = Number(cards[activeRenderedIndex].dataset.loopIndex);

    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeRenderedIndex;
      const distance = Math.abs(cardIndex - activeRenderedIndex);
      const opacity = Math.max(0.08, 0.68 - distance * 0.11);
      const blur = Math.min(4.2, Math.max(0.55, distance * 0.62));
      const brightness = Math.max(0.48, 0.96 - distance * 0.085);
      const scale = Math.max(0.77, 0.91 - distance * 0.024);
      const angle = Math.min(16, 8 + distance * 1.35);
      const signedAngle = cardIndex < activeRenderedIndex ? -angle : angle;
      const depth = Math.max(-92, -18 - distance * 11);

      card.style.setProperty("--side-opacity", opacity.toFixed(2));
      card.style.setProperty("--side-blur", `${blur.toFixed(2)}px`);
      card.style.setProperty("--side-brightness", brightness.toFixed(2));
      card.style.setProperty("--side-scale", scale.toFixed(2));
      card.style.setProperty("--side-angle", `${signedAngle.toFixed(1)}deg`);
      card.style.setProperty("--side-z", `${depth}px`);
      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-before", cardIndex < activeRenderedIndex);
      card.classList.toggle("is-after", cardIndex > activeRenderedIndex);
      card.classList.toggle("is-near", distance === 1);
      card.classList.toggle("is-far", distance > 1);
      if (card.dataset.loopRole === "original") {
        card.setAttribute("aria-current", isActive ? "true" : "false");
      }
    });

    const activeCard = cards[activeRenderedIndex];
    if (schoolLabel) schoolLabel.textContent = activeCard.dataset.school;
    if (programLabel) programLabel.textContent = activeCard.dataset.program;
    if (count) {
      count.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(loop.count).padStart(2, "0")}`;
    }
  }

  function centerRenderedCard(renderedIndex, behavior = "smooth") {
    const safeIndex = Math.max(0, Math.min(renderedIndex, cards.length - 1));
    const card = cards[safeIndex];
    const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
    carousel.scrollTo({ left, behavior });
    setActive(safeIndex);
  }

  function restoreCanonicalPosition() {
    if (pointerIsDown) return;
    const nearest = nearestRenderedIndex();
    const card = cards[nearest];

    if (card.dataset.loopRole !== "original") {
      centerRenderedCard(loop.canonicalOffset + Number(card.dataset.loopIndex), "auto");
    }
  }

  function scheduleCanonicalRestore() {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(restoreCanonicalPosition, 110);
  }

  function syncActive() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      setActive(nearestRenderedIndex());
      scheduleCanonicalRestore();
      scrollFrame = null;
    });
  }

  function centerCard(index, behavior = "smooth") {
    const logicalIndex = wrapIndex(index, loop.count);
    centerRenderedCard(loop.canonicalOffset + logicalIndex, behavior);
  }

  function searchableText(card) {
    return [card.dataset.school, card.dataset.program, card.dataset.search, card.textContent]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
  }

  function closeSearchResults() {
    if (!searchResults || !searchInput) return;
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
  }

  function chooseSearchResult(index) {
    centerCard(index);
    closeSearchResults();
  }

  function renderSearchResults() {
    if (!searchInput || !searchResults) return;
    const query = searchInput.value.trim().toLocaleLowerCase();

    if (searchClear) searchClear.hidden = query.length === 0;
    searchResults.replaceChildren();

    if (!query) {
      closeSearchResults();
      return;
    }

    const matches = originalCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => searchableText(card).includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "program-search__empty";
      empty.textContent = "未找到匹配项目，可尝试学校简称或方向关键词。";
      searchResults.appendChild(empty);
    } else {
      matches.forEach(({ card, index }) => {
        const result = document.createElement("button");
        const title = document.createElement("span");
        const school = document.createElement("small");

        result.type = "button";
        result.className = "program-search__result";
        result.setAttribute("role", "option");
        title.textContent = card.dataset.program;
        school.textContent = card.querySelector(".program-card__school")?.textContent || card.dataset.school;
        result.append(title, school);
        result.addEventListener("click", () => chooseSearchResult(index));
        searchResults.appendChild(result);
      });
    }

    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  carousel.addEventListener("scroll", syncActive, { passive: true });
  window.addEventListener("resize", syncActive, { passive: true });

  carousel.addEventListener("pointerdown", (event) => {
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerTravel = 0;
    pointerIsDown = true;
    pointerCard = event.target.closest(".program-card");
  });

  carousel.addEventListener("pointermove", (event) => {
    if (!pointerCard) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    pointerTravel = Math.max(pointerTravel, Math.hypot(deltaX, deltaY));

    if (pointerCard.classList.contains("is-active") && deltaY < 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      pointerCard.style.setProperty("--pull-y", `${Math.max(-62, deltaY)}px`);
    }
  });

  function finishPull(event) {
    if (!pointerCard) {
      pointerIsDown = false;
      scheduleCanonicalRestore();
      return;
    }
    const card = pointerCard;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    const shouldOpen = card.classList.contains("is-active") && deltaY < -46 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15;

    card.style.removeProperty("--pull-y");
    pointerCard = null;
    pointerIsDown = false;
    scheduleCanonicalRestore();

    if (shouldOpen) {
      suppressClickUntil = performance.now() + 500;
      window.location.assign(card.href);
    }
  }

  carousel.addEventListener("pointerup", finishPull);
  carousel.addEventListener("pointercancel", () => {
    pointerCard?.style.removeProperty("--pull-y");
    pointerCard = null;
    pointerIsDown = false;
    scheduleCanonicalRestore();
  });

  cards.forEach((card, renderedIndex) => {
    card.addEventListener("click", (event) => {
      if (performance.now() < suppressClickUntil || pointerTravel > 9) {
        event.preventDefault();
        return;
      }

      if (renderedIndex !== activeRenderedIndex) {
        event.preventDefault();
        centerRenderedCard(renderedIndex);
      }
    });
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      centerRenderedCard(activeRenderedIndex + (event.key === "ArrowRight" ? 1 : -1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      window.location.assign(cards[activeRenderedIndex].href);
    }
  });

  if (searchInput && searchResults) {
    searchInput.addEventListener("input", renderSearchResults);
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) renderSearchResults();
    });
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSearchResults();
      }

      if (event.key === "ArrowDown" && !searchResults.hidden) {
        event.preventDefault();
        searchResults.querySelector("button")?.focus();
      }

      if (event.key === "Enter") {
        const firstResult = searchResults.querySelector("button");
        if (firstResult) {
          event.preventDefault();
          firstResult.click();
        }
      }
    });

    searchClear?.addEventListener("click", () => {
      searchInput.value = "";
      renderSearchResults();
      searchInput.focus();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!search?.contains(event.target)) closeSearchResults();
    });

  }

  setActive(activeRenderedIndex);
  return { center: centerCard };
}

const programStack = createProgramStack();

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function centerDefaultCards() {
  serviceCarousel?.center(5, "auto");
  mentorCarousel?.center(2, "auto");
  pastProjectCarousel?.center(2, "auto");
  programStack?.center(11, "auto");
}

function scheduleDefaultCards() {
  requestAnimationFrame(() => {
    requestAnimationFrame(centerDefaultCards);
  });
}

window.addEventListener("load", scheduleDefaultCards, { once: true });
window.addEventListener("pageshow", scheduleDefaultCards);
document.addEventListener("DOMContentLoaded", scheduleDefaultCards, { once: true });

if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleDefaultCards);
}
