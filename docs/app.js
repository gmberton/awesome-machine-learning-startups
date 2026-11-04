// Awesome Machine Learning Startups: the map, the filters and the list. The data comes from data.js, built by main.py.
(function () {
  "use strict";

  const DATA = window.DATA;
  const CITIES = DATA.cities;
  const PAGE = 60;
  // At most 3 digits, and a decimal only below 10, as in the README: 82, 6.2k, 11k, 766k, 1.4M, 12M.
  const num = (n) => {
    const [size, unit] = n >= 999500 ? [1e6, "M"] : n >= 1000 ? [1e3, "k"] : [1, ""];
    if (size === 1) return String(n);
    const tenths = Math.round((n * 10) / size);
    return (tenths < 100 ? String(tenths / 10) : String(Math.round(n / size))) + unit;
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fold = (text) => text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  const slugify = (text) => fold(text).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const flag = (code) => String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
  const startupsText = (n) => `${num(n)} ${n === 1 ? "startup" : "startups"}`;
  const placeName = (city) => (city.name === city.countryName ? city.name : `${city.name}, ${city.countryName}`);
  const collator = new Intl.Collator("en", { sensitivity: "base" });
  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function option(value, text) {
    const node = el("option", undefined, text);
    node.value = value;
    return node;
  }

  const SHORT_NAMES = { "Natural Language Processing": "Language", "Self-Driving Cars": "Self-Driving", "Chatbots & Customer Service": "Chatbots", "Document Processing": "Documents", "Search & Recommendation": "Search & Recs", "Science & Engineering": "Science", "AI Infrastructure": "AI Infra" };
  const FIELDS = DATA.fields.map(([name, emoji], i) => ({ i, name, emoji, slug: slugify(name), short: SHORT_NAMES[name] || name }));
  const FIELD_BY_SLUG = Object.fromEntries(FIELDS.map((field) => [field.slug, field.i]));
  const SIZES = [
    { key: "1-10", label: "1–10", min: 0, max: 10 },
    { key: "11-50", label: "11–50", min: 11, max: 50 },
    { key: "51-200", label: "51–200", min: 51, max: 200 },
    { key: "201-1000", label: "201–1k", min: 201, max: 1000 },
    { key: "1001-10000", label: "1k–10k", min: 1001, max: 10000 },
    { key: "10001+", label: "10k+", min: 10001, max: Infinity },
  ];
  const FOUNDED = [
    { key: "2023", label: "2023+", test: (year) => year >= 2023 },
    { key: "2020", label: "2020+", test: (year) => year >= 2020 },
    { key: "2015", label: "2015+", test: (year) => year >= 2015 },
    { key: "2010", label: "2010+", test: (year) => year >= 2010 },
    { key: "2000-2009", label: "2000–09", test: (year) => year < 2010 },
  ];
  const SORTS = {
    followers: { label: "Most followers", compare: (a, b) => b.fo - a.fo },
    employees: { label: "Most employees", compare: (a, b) => b.e - a.e || b.fo - a.fo },
    newest: { label: "Newest", compare: (a, b) => (b.y || 0) - (a.y || 0) || b.fo - a.fo },
    name: { label: "Name", compare: (a, b) => collator.compare(a.n, b.n) },
  };

  const COUNTRIES = {};
  for (const [slug, city] of Object.entries(CITIES)) {
    COUNTRIES[city.country] = COUNTRIES[city.country] || { code: city.country, name: city.countryName, cities: [] };
    COUNTRIES[city.country].cities.push(slug);
  }
  const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));
  COUNTRY_LIST.forEach((country) => country.cities.sort((a, b) => CITIES[a].name.localeCompare(CITIES[b].name)));

  const companies = DATA.companies;
  for (const c of companies) {
    const city = CITIES[c.c];
    c.o = c.o || [];
    c.country = city.country;
    c.officeCountries = new Set(c.o.map((slug) => CITIES[slug].country));
    c.hay = fold([c.n, c.d, c.s, c.i, city.name, city.countryName, FIELDS[c.f].name].filter(Boolean).join(" "));
  }

  // ---- State, kept in the URL so a filtered view can be shared ----

  const state = { q: "", places: new Set(), fields: new Set(), size: "", founded: "", offices: false, sort: "followers" };
  let results = [];
  let shown = PAGE;
  let chips = [];
  const picks = [];
  let map = null;

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    state.q = params.get("q") || "";
    state.places = new Set((params.get("city") || "").split(",").filter((slug) => Object.hasOwn(CITIES, slug)));
    state.fields = new Set((params.get("fields") || "").split(",").filter((slug) => Object.hasOwn(FIELD_BY_SLUG, slug)).map((slug) => FIELD_BY_SLUG[slug]));
    state.size = SIZES.some((size) => size.key === params.get("size")) ? params.get("size") : "";
    state.founded = FOUNDED.some((founded) => founded.key === params.get("founded")) ? params.get("founded") : "";
    state.offices = params.get("offices") === "1";
    state.sort = Object.hasOwn(SORTS, params.get("sort") || "") ? params.get("sort") : "followers";
  }

  function writeHash() {
    const parts = [];
    const add = (key, value) => parts.push(`${key}=${encodeURIComponent(value).replace(/%2C/g, ",")}`);
    if (state.q) add("q", state.q);
    if (state.places.size) add("city", [...state.places].join(","));
    if (state.fields.size) add("fields", [...state.fields].map((i) => FIELDS[i].slug).join(","));
    if (state.size) add("size", state.size);
    if (state.founded) add("founded", state.founded);
    if (state.offices) add("offices", "1");
    if (state.sort !== "followers") add("sort", state.sort);
    history.replaceState(null, "", parts.length ? `#${parts.join("&")}` : location.pathname + location.search);
  }

  // ---- Filtering ----

  let tokens = [];
  let sizeRange = null;
  let foundedTest = null;

  function prepare() {
    tokens = fold(state.q).split(/\s+/).filter(Boolean);
    sizeRange = SIZES.find((size) => size.key === state.size) || null;
    foundedTest = (FOUNDED.find((founded) => founded.key === state.founded) || {}).test || null;
  }

  // A startup is in the chosen cities through its headquarters, or through any office when offices count.
  const inPlaces = (c) => state.places.has(c.c) || (state.offices && c.o.some((slug) => state.places.has(slug)));

  // `skip` leaves one filter out, to count what each option of that filter would show.
  function passes(c, skip) {
    if (skip !== "fields" && state.fields.size && !state.fields.has(c.f)) return false;
    if (skip !== "size" && sizeRange && (c.e < sizeRange.min || c.e > sizeRange.max)) return false;
    if (skip !== "founded" && foundedTest && !(c.y && foundedTest(c.y))) return false;
    if (skip !== "place" && state.places.size && !inPlaces(c)) return false;
    return tokens.every((token) => c.hay.includes(token));
  }

  function update() {
    prepare();
    results = companies.filter((c) => passes(c)).sort(SORTS[state.sort].compare);
    const counts = { fields: FIELDS.map(() => 0), sizes: SIZES.map(() => 0), founded: FOUNDED.map(() => 0), cities: {}, countries: {}, anySize: 0, anyYear: 0 };
    for (const c of companies) {
      if (passes(c, "fields")) counts.fields[c.f]++;
      if (passes(c, "size")) {
        counts.anySize++;
        counts.sizes[SIZES.findIndex((size) => c.e >= size.min && c.e <= size.max)]++;
      }
      if (passes(c, "founded")) {
        counts.anyYear++;
        FOUNDED.forEach((founded, i) => { if (c.y && founded.test(c.y)) counts.founded[i]++; });
      }
      if (passes(c, "place")) {
        for (const slug of state.offices ? [c.c, ...c.o] : [c.c]) counts.cities[slug] = (counts.cities[slug] || 0) + 1;
        for (const code of state.offices ? new Set([c.country, ...c.officeCountries]) : [c.country]) counts.countries[code] = (counts.countries[code] || 0) + 1;
      }
    }
    shown = PAGE;
    renderControls(counts);
    renderSummary();
    renderList();
    if (map) map.update(counts.cities);
    writeHash();
    if ($("results").getBoundingClientRect().top < 0) scrollToResults(); // a filter changed while down in the list
  }

  // Scroll to the top of the list.
  function scrollToResults() {
    window.scrollTo({ top: $("results").getBoundingClientRect().top + window.scrollY - 12, behavior: reducedMotion ? "auto" : "smooth" });
  }

  let zoomTimer = 0;
  function zoomToPlaces() {
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => { if (map) state.places.size ? map.zoomTo([...state.places]) : map.reset(); }, 350);
  }

  // Add or remove cities from the chosen ones; `zoom` then fits the map to all chosen cities.
  function toggleCities(slugs, on, zoom) {
    for (const slug of slugs) {
      if (on) state.places.add(slug);
      else state.places.delete(slug);
    }
    update();
    if (zoom) zoomToPlaces();
  }

  function clearAll() {
    Object.assign(state, { q: "", places: new Set(), fields: new Set(), size: "", founded: "", offices: false });
    $("q").value = "";
    update();
    if (map) map.reset();
  }

  // ---- Rendering ----

  function placesLabel() {
    const chosen = [...state.places];
    if (!chosen.length) return "All cities";
    if (chosen.length === 1) return `${flag(CITIES[chosen[0]].country)} ${CITIES[chosen[0]].name}`;
    const country = COUNTRY_LIST.find((k) => k.cities.length === chosen.length && k.cities.every((slug) => state.places.has(slug)));
    return country ? `${flag(country.code)} ${country.name}` : `${chosen.length} cities`;
  }

  function renderControls(counts) {
    FIELDS.forEach((field) => {
      const chip = chips[field.i];
      const on = state.fields.has(field.i);
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("zero", !on && counts.fields[field.i] === 0);
      chip.lastChild.textContent = num(counts.fields[field.i]);
    });

    for (const pick of picks) {
      const chosen = pick.cities.filter((slug) => state.places.has(slug)).length;
      const n = pick.country ? counts.countries[pick.country.code] || 0 : counts.cities[pick.cities[0]] || 0;
      pick.input.checked = chosen === pick.cities.length;
      pick.input.indeterminate = chosen > 0 && chosen < pick.cities.length;
      pick.count.textContent = num(n);
      pick.node.classList.toggle("zero", n === 0);
    }
    $("place-label").textContent = `${placesLabel()} (${num(results.length)})`;
    $("place").classList.toggle("set", state.places.size > 0);

    const size = $("size");
    size.replaceChildren(option("", `Any size (${num(counts.anySize)})`), ...SIZES.map((s, i) => option(s.key, `${s.label} employees (${num(counts.sizes[i])})`)));
    size.value = state.size;
    size.classList.toggle("set", Boolean(state.size));

    const founded = $("founded");
    founded.replaceChildren(option("", `Any year (${num(counts.anyYear)})`), ...FOUNDED.map((f, i) => option(f.key, `Founded ${f.label} (${num(counts.founded[i])})`)));
    founded.value = state.founded;
    founded.classList.toggle("set", Boolean(state.founded));

    $("offices").checked = state.offices;
    $("sort").value = state.sort;
    if (document.activeElement !== $("q")) $("q").value = state.q;
  }

  function renderSummary() {
    $("count").replaceChildren(el("strong", undefined, num(results.length)), document.createTextNode(results.length === 1 ? " startup" : " startups"));
    const pills = [];
    const pill = (label, clear, zoom) => {
      const button = el("button", "pill");
      button.type = "button";
      button.setAttribute("aria-label", `Remove filter: ${label}`);
      button.append(el("span", undefined, label), el("span", "x", "×"));
      button.addEventListener("click", () => {
        clear();
        update();
        if (zoom) zoomToPlaces();
      });
      pills.push(button);
    };
    for (const country of COUNTRY_LIST) {
      const chosen = country.cities.filter((slug) => state.places.has(slug));
      if (chosen.length > 1 && chosen.length === country.cities.length) pill(`${flag(country.code)} ${country.name}`, () => chosen.forEach((slug) => state.places.delete(slug)), true);
      else for (const slug of chosen) pill(`${flag(country.code)} ${CITIES[slug].name}`, () => state.places.delete(slug), true);
    }
    for (const i of state.fields) pill(`${FIELDS[i].emoji} ${FIELDS[i].name}`, () => state.fields.delete(i));
    if (sizeRange) pill(`${sizeRange.label} employees`, () => { state.size = ""; });
    if (state.founded) pill(`Founded ${FOUNDED.find((f) => f.key === state.founded).label}`, () => { state.founded = ""; });
    if (state.q) pill(`“${state.q}”`, () => { state.q = ""; $("q").value = ""; });
    if (state.offices) pill("Including offices", () => { state.offices = false; });
    $("active").replaceChildren(...pills);
    $("reset").disabled = pills.length === 0;
  }

  function renderList() {
    $("rows").replaceChildren(...results.slice(0, shown).map(row));
    document.querySelector(".table").hidden = results.length === 0;
    $("empty").hidden = results.length > 0;
    $("more").hidden = shown >= results.length;
  }

  function showMore() {
    if (shown >= results.length) return;
    $("rows").append(...results.slice(shown, shown + PAGE).map(row));
    shown += PAGE;
    $("more").hidden = shown >= results.length;
  }

  const linkedin = (c) => `https://www.linkedin.com/${c.l}/`;

  function row(c) {
    const item = el("li", "row");
    const city = CITIES[c.c];
    const field = FIELDS[c.f];

    const logo = el("div", "logo");
    const letter = () => {
      logo.classList.add("letter");
      logo.textContent = (c.n.match(/[\p{L}\p{N}]/u) || ["?"])[0].toUpperCase();
    };
    if (c.g) {
      const image = el("img");
      Object.assign(image, { src: `logos/${c.g}`, alt: "", loading: "lazy", decoding: "async", width: 40, height: 40 });
      image.addEventListener("error", letter);
      logo.append(image);
    } else {
      letter();
    }

    const main = el("div", "main");
    const name = el("a", "name", c.n);
    name.href = /^https?:\/\//i.test(c.w || "") ? c.w : linkedin(c);
    name.target = "_blank";
    name.rel = "noopener";
    main.append(name);
    if (c.d) main.append(el("p", "desc", c.d));

    const where = el("button", "cell");
    where.type = "button";
    where.title = `Show only startups in ${city.name}`;
    where.append(el("span", "flag", flag(city.country)), document.createTextNode(city.name));
    where.addEventListener("click", () => {
      state.places = new Set([c.c]);
      update();
      zoomToPlaces();
      scrollToResults();
    });

    const what = el("button", "cell tag", `${field.emoji} ${field.short}`);
    what.type = "button";
    what.title = `Show only ${field.name}`;
    what.addEventListener("click", () => {
      state.fields = new Set([field.i]);
      update();
      scrollToResults();
    });

    const employees = el("span", "cell num", num(c.e));
    employees.append(el("span", "unit", c.e === 1 ? " employee" : " employees"));
    const year = el("span", c.y ? "cell num year" : "cell num year missing");
    year.append(el("span", "unit", "Founded "), document.createTextNode(c.y || "–"));
    const followers = el("span", "cell num", num(c.fo));
    followers.append(el("span", "unit", " followers"));
    const page = el("a", "li", "in");
    Object.assign(page, { href: linkedin(c), target: "_blank", rel: "noopener", title: "LinkedIn page" });
    page.setAttribute("aria-label", `${c.n} on LinkedIn`);

    const meta = el("div", "meta");
    meta.append(where, what, employees, year, followers, page);
    item.append(logo, main, meta);
    return item;
  }

  // ---- City picker: tick any number of cities, or a whole country at once ----

  function createPicker() {
    const list = $("picker-list");
    const addPick = (cities, country, label, searchText) => {
      const node = el("label", country ? "pick country" : cities.length && COUNTRIES[CITIES[cities[0]].country].cities.length > 1 ? "pick city" : "pick");
      const input = el("input");
      input.type = "checkbox";
      const count = el("span", "pn");
      node.append(input, el("span", "pname", label), count);
      input.addEventListener("change", () => toggleCities(cities, !cities.every((slug) => state.places.has(slug)), true));
      list.append(node);
      picks.push({ node, input, count, cities, country, search: fold(searchText) });
    };
    for (const country of COUNTRY_LIST) {
      if (country.cities.length === 1) {
        const slug = country.cities[0];
        addPick([slug], null, `${flag(country.code)} ${placeName(CITIES[slug])}`, `${CITIES[slug].name} ${country.name}`);
        continue;
      }
      addPick(country.cities, country, `${flag(country.code)} ${country.name}`, [country.name, ...country.cities.map((slug) => CITIES[slug].name)].join(" "));
      for (const slug of country.cities) addPick([slug], null, CITIES[slug].name, `${CITIES[slug].name} ${country.name}`);
    }

    const panel = $("picker-panel");
    const search = $("place-q");
    const open = (show) => {
      panel.hidden = !show;
      $("place").setAttribute("aria-expanded", String(show));
      if (show) {
        search.value = "";
        filter();
        if (matchMedia("(hover: hover)").matches) search.focus(); // on phones, no keyboard over the list
      }
    };
    const filter = () => {
      const query = fold(search.value.trim());
      for (const pick of picks) pick.node.hidden = Boolean(query) && !pick.search.includes(query);
    };
    search.addEventListener("input", filter);
    $("place").addEventListener("click", () => open(panel.hidden));
    $("place-done").addEventListener("click", () => {
      open(false);
      $("place").focus();
    });
    $("place-clear").addEventListener("click", () => toggleCities([...state.places], false, true));
    document.addEventListener("pointerdown", (event) => { if (!panel.hidden && !$("picker").contains(event.target)) open(false); });
    $("picker").addEventListener("focusout", (event) => { if (event.relatedTarget && !$("picker").contains(event.relatedTarget)) open(false); });
    $("picker").addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        open(false);
        $("place").focus();
      }
    });
  }

  // ---- Map: one circle per city, its area proportional to the startups that pass the filters ----

  function createMap() {
    const box = $("map");
    const svg = d3.select("#map-svg");
    const tip = $("map-tip");
    // Land only, no country borders, which are disputed in places.
    const land = topojson.merge(WORLD, WORLD.objects.countries.geometries.filter((country) => country.id !== "010")); // no Antarctica
    const projection = d3.geoNaturalEarth1();
    const path = d3.geoPath(projection);
    const world = svg.append("g");
    const landPath = world.append("path").attr("class", "land").datum(land);
    const cities = Object.entries(CITIES).map(([slug, city]) => ({ slug, ...city, count: 0, on: false }));
    const radius = d3.scaleSqrt();
    let width = 0;
    let height = 0;
    let transform = d3.zoomIdentity;

    // Scrolling zooms the map, except scrolling down at the whole-world view, which scrolls the page.
    // On phones one finger scrolls the page until the map is zoomed in; two fingers zoom.
    const zoom = d3.zoom()
      .scaleExtent([1, 40])
      .filter((event) => (event.type === "wheel" ? event.ctrlKey || event.deltaY < 0 || transform.k > 1
        : event.type === "touchstart" ? event.touches.length > 1 || transform.k > 1 : !event.button))
      .on("zoom", (event) => {
        transform = event.transform;
        world.attr("transform", transform);
        hideTip();
        layout();
      });
    svg.call(zoom);

    const glow = svg.append("defs").append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", 3.5).attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // Mouse and touch only: keyboards and screen readers get the same cities in the city picker.
    const nodes = svg.append("g").attr("filter", "url(#glow)").selectAll("g").data(cities).join("g")
      .attr("class", "city")
      .on("click", (event) => pick(cityAt(event)))
      .on("pointermove", (event) => showTip(cityAt(event)))
      .on("pointerleave", hideTip);
    nodes.append("circle").attr("class", "hit");
    nodes.append("circle").attr("class", "dot");
    const labels = svg.append("g").attr("class", "labels").selectAll("text").data(cities).join("text");

    // The city whose center is nearest the pointer, among those whose circle it is on,
    // so a small city drawn on top does not take clicks from the middle of a big one.
    function cityAt(event) {
      const [x, y] = d3.pointer(event, svg.node());
      return d3.least(cities, (c) => {
        const distance = Math.hypot(c.sx - x, c.sy - y);
        return distance <= Math.max(c.r + 3, 11) ? distance : Infinity;
      });
    }

    // Clicking a city adds it to the chosen cities, or removes it.
    function pick(c) {
      toggleCities([c.slug], !state.places.has(c.slug), false);
      showTip(c);
    }

    function showTip(c) {
      tip.replaceChildren(el("strong", undefined, startupsText(c.count)), el("span", undefined, placeName(c)));
      if (state.offices) tip.append(el("span", "note", "incl. offices"));
      tip.hidden = false;
      let left = c.sx + c.r + 10;
      if (left + tip.offsetWidth > width - 8) left = Math.max(6, c.sx - c.r - 10 - tip.offsetWidth);
      const top = Math.max(6, Math.min(height - tip.offsetHeight - 6, c.sy - tip.offsetHeight / 2));
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    }

    function hideTip() {
      tip.hidden = true;
    }

    function resize() {
      width = box.clientWidth;
      height = box.clientHeight;
      svg.attr("viewBox", [0, 0, width, height]);
      projection.fitExtent([[10, 10], [width - 10, height - 10]], { type: "MultiPoint", coordinates: [[-180, 0], [180, 0], [0, -56], [0, 76]] });
      landPath.attr("d", path);
      for (const c of cities) [c.x, c.y] = projection([c.lon, c.lat]);
      radius.range([0, Math.max(12, Math.min(24, width / 50))]);
      zoom.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
      svg.call(zoom.transform, d3.zoomIdentity);
    }

    // Circles keep about the same size on screen while zooming, so zooming in pulls close cities apart.
    function layout() {
      const k = transform.k;
      const grow = Math.min(Math.pow(k, 0.25), 2);
      for (const c of cities) {
        c.sx = transform.applyX(c.x);
        c.sy = transform.applyY(c.y);
        c.r = c.count ? Math.max(3, radius(c.count)) * grow : 2;
      }
      nodes.attr("transform", (c) => `translate(${c.sx},${c.sy})`);
      nodes.select(".dot").attr("r", (c) => c.r);
      nodes.select(".hit").attr("r", (c) => Math.max(c.r + 3, 11));
      placeLabels(9 / k);
    }

    // Name the biggest circles first: right of the circle, else left, above or below, skipping a label that would cover one already placed.
    function placeLabels(minRadius) {
      const placed = [];
      for (const c of cities) c.label = null;
      const order = cities.filter((c) => c.count).sort((a, b) => b.on - a.on || b.count - a.count);
      for (const c of order) {
        if (!c.on && c.r < minRadius) continue;
        const w = c.name.length * 6.4 + String(c.count).length * 7 + 6;
        const right = c.sx + c.r + 4;
        const left = c.sx - c.r - 4;
        const spots = [
          { x: right, y: c.sy + 4, anchor: "start", box: [right, c.sy - 9, right + w, c.sy + 5] },
          { x: left, y: c.sy + 4, anchor: "end", box: [left - w, c.sy - 9, left, c.sy + 5] },
          { x: c.sx, y: c.sy - c.r - 5, anchor: "middle", box: [c.sx - w / 2, c.sy - c.r - 18, c.sx + w / 2, c.sy - c.r - 3] },
          { x: c.sx, y: c.sy + c.r + 14, anchor: "middle", box: [c.sx - w / 2, c.sy + c.r + 1, c.sx + w / 2, c.sy + c.r + 16] },
        ];
        const spot = spots.find(({ box }) => box[0] >= 4 && box[2] <= width - 46 && box[1] >= 2 && box[3] <= height - 2
          && !placed.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]));
        if (!spot) continue;
        placed.push(spot.box);
        c.label = spot;
      }
      labels
        .attr("display", (c) => (c.label ? null : "none"))
        .attr("x", (c) => (c.label ? c.label.x : 0))
        .attr("y", (c) => (c.label ? c.label.y : 0))
        .attr("text-anchor", (c) => (c.label ? c.label.anchor : null))
        .classed("on", (c) => c.on);
    }

    function update(counts) {
      for (const c of cities) {
        c.count = counts[c.slug] || 0;
        c.on = state.places.has(c.slug);
      }
      radius.domain([0, Math.max(30, d3.max(cities, (c) => c.count))]); // a city with 1 startup stays a small circle
      hideTip();
      nodes
        .classed("empty", (c) => !c.count)
        .classed("on", (c) => c.on)
        .sort((a, b) => a.on - b.on || b.count - a.count); // small circles on top, so they stay clickable
      labels.text((c) => `${c.name} `).append("tspan").text((c) => num(c.count));
      layout();
    }

    // Fit the view to the given cities, zooming in at most 8 times.
    function zoomTo(slugs) {
      const points = cities.filter((c) => slugs.includes(c.slug));
      const [x0, x1] = d3.extent(points, (c) => c.x);
      const [y0, y1] = d3.extent(points, (c) => c.y);
      const k = Math.max(1, Math.min(8, 0.5 / Math.max((x1 - x0) / width, (y1 - y0) / height, 1 / 16)));
      const target = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      svg.transition().duration(reducedMotion ? 0 : 700).call(zoom.transform, target);
    }

    function reset() {
      svg.transition().duration(reducedMotion ? 0 : 500).call(zoom.transform, d3.zoomIdentity);
    }

    $("zoom-in").addEventListener("click", () => svg.transition().duration(reducedMotion ? 0 : 250).call(zoom.scaleBy, 1.8));
    $("zoom-out").addEventListener("click", () => svg.transition().duration(reducedMotion ? 0 : 250).call(zoom.scaleBy, 1 / 1.8));
    $("zoom-reset").addEventListener("click", reset);
    let last = [box.clientWidth, box.clientHeight];
    new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - last[0]) < 2 && Math.abs(box.clientHeight - last[1]) < 2) return;
      last = [box.clientWidth, box.clientHeight];
      resize();
      if (state.places.size) zoomTo([...state.places]);
    }).observe(box);
    resize();
    return { update, zoomTo, reset };
  }

  // ---- Start ----

  function init() {
    const countries = new Set(Object.values(CITIES).map((city) => city.country)).size;
    $("lede").append(
      el("strong", undefined, num(companies.length)), " startups doing AI and machine learning in ",
      el("strong", undefined, num(Object.keys(CITIES).length)), " cities and ",
      el("strong", undefined, num(countries)), " countries and regions.",
    );
    $("min-followers").textContent = num(DATA.rules.minFollowers);
    $("max-employees").textContent = num(DATA.rules.maxEmployees);
    $("first-year").textContent = DATA.rules.firstYear;
    $("updated").textContent = new Date(`${DATA.updated}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    chips = FIELDS.map((field) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.title = field.name;
      chip.append(el("span", undefined, field.emoji), el("span", undefined, field.short), el("span", "n", ""));
      chip.addEventListener("click", () => {
        if (state.fields.has(field.i)) state.fields.delete(field.i);
        else state.fields.add(field.i);
        update();
      });
      return chip;
    });
    $("fields").replaceChildren(...chips);
    createPicker();

    let typing = 0;
    $("q").addEventListener("input", (event) => {
      clearTimeout(typing);
      typing = setTimeout(() => {
        state.q = event.target.value.trim();
        update();
      }, 120);
    });
    $("size").addEventListener("change", (event) => { state.size = event.target.value; update(); });
    $("founded").addEventListener("change", (event) => { state.founded = event.target.value; update(); });
    $("offices").addEventListener("change", (event) => { state.offices = event.target.checked; update(); });
    $("sort").replaceChildren(...Object.entries(SORTS).map(([key, sort]) => option(key, sort.label)));
    $("sort").addEventListener("change", (event) => { state.sort = event.target.value; update(); });
    $("more-button").addEventListener("click", showMore);
    $("clear-empty").addEventListener("click", clearAll);
    $("reset").addEventListener("click", clearAll);
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        event.preventDefault();
        $("q").focus();
      }
    });
    window.addEventListener("hashchange", () => {
      readHash();
      update();
      zoomToPlaces();
    });

    readHash();
    if (window.d3 && window.topojson && window.WORLD) map = createMap();
    else $("map-section").hidden = true;
    update();
    if (map && state.places.size) map.zoomTo([...state.places]);
  }

  init();
})();
