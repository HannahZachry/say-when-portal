(function () {
  "use strict";

  var script = document.currentScript;
  var FUNCTIONS_URL = (script && script.getAttribute("data-functions-url")) || "";
  var TOKEN_PATTERN = /^[a-f0-9]{32}$/;
  var HIDDEN = "is-hidden";
  var HTML2PDF = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  var SAVE_DELAY = 3000;

  var portal = (window.SayWhenPortal = { token: null, client: null, answers: {}, state: null });

  function callFunction(name, body, keepalive) {
    return fetch(FUNCTIONS_URL.replace(/\/$/, "") + "/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: !!keepalive,
    }).then(function (res) {
      if (!res.ok) throw new Error(name + " returned " + res.status);
      return res.json();
    });
  }

  function showState(name) {
    var sections = document.querySelectorAll("[data-state]");
    var found = false;
    sections.forEach(function (el) {
      var match = el.getAttribute("data-state") === name;
      el.classList.toggle(HIDDEN, !match);
      if (match) found = true;
    });
    if (!found && name !== "invalid") showState("invalid");
    portal.state = name;
  }

  function fillClient(client) {
    if (!client) return;
    var first = (client.name || "").trim().split(/\s+/)[0];
    document.querySelectorAll('[data-client="name"]').forEach(function (el) {
      if (first) el.textContent = first;
    });
  }

  function load() {
    var token = window.location.hash.replace(/^#/, "").trim().toLowerCase();

    if (!FUNCTIONS_URL) {
      console.error("Say When portal: add data-functions-url to the script tag.");
      return showState("error");
    }
    if (!TOKEN_PATTERN.test(token)) return showState("invalid");

    showState("loading");
    portal.token = token;

    callFunction("get-portal", { token: token })
      .then(function (data) {
        portal.client = data.client || null;
        portal.answers = data.answers || {};
        fillClient(portal.client);
        showState(data.state || "invalid");
        document.dispatchEvent(new CustomEvent("portal:ready", { detail: data }));
      })
      .catch(function (err) {
        console.error("Say When portal:", err);
        showState("error");
      });
  }

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || form.getAttribute("data-portal-form") !== "lost-link") return;
      event.preventDefault();
      event.stopPropagation();

      var input = form.querySelector('[name="email"], input[type="email"]');
      var email = input ? input.value.trim() : "";
      var block = form.parentElement;
      var done = block && block.querySelector(".w-form-done");
      var fail = block && block.querySelector(".w-form-fail");
      var button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;

      callFunction("send-link", { email: email })
        .then(function () {
          form.style.display = "none";
          if (done) done.style.display = "block";
        })
        .catch(function (err) {
          console.error("Say When portal:", err);
          if (fail) fail.style.display = "block";
          if (button) button.disabled = false;
        });
    },
    true
  );


  /* ---------- form definitions ---------- */
  function q(t, k, l, o) { o = o || {}; o.t = t; o.k = k; o.l = l; return o; }
  var YN = ["Yes", "No"];
  var CARD_FEATURES = ["Name", "Pronouns", "Title", "Department", "Office Phone", "Cell Phone", "Email address", "Website", "Street Address / maps link", "Social Media handles (1-3)", "Slogan/Motto/Closing Phrase", "Meeting Link", "Disclaimer text"];

  var WEB = [
    { id: "web-technical", title: "Technical", steps: [
      { q: [
        q("select", "web-domain", "Domain", { o: ["I own my domain and have access to it", "I own my domain but don't have access", "I have picked a domain, but not purchased it", "I want you to handle the domain for me"] }),
        q("url", "web-domain-link", "If you own a domain, please add the link here", { opt: 1 }),
        q("text", "web-domain-provider", "If you own a domain, please name your provider", { opt: 1 })
      ] },
      { q: [q("long", "web-seats", "You get 3 user seats for editing the site. For each person you'd like to add, list their email below:", { opt: 1 })] }
    ] },
    { id: "web-goals", title: "Goals", steps: [
      { q: [
        q("select", "web-top-audience", "Who will be using the website the most often?", { o: ["Primary Audience", "Secondary Audience", "Tertiary Audience"] }),
        q("long", "web-first-actions", "What do you think they will do first? Then what?")
      ] },
      { q: [
        q("text", "web-feeling", "How do you want people to feel when they arrive? Try using 1-2 adjectives"),
        q("check", "web-contact", "How would you like people to be able to get in touch? Check all that apply", { o: ["A contact form", "Phone number", "Email address", "Physical address", "Subscribe to mailing list"] })
      ] },
      { q: [
        q("long", "web-important", "What's the most important thing that could happen on your website?"),
        q("text", "web-must-do", "What 3 things do people absolutely have to be able to do on your website?")
      ] },
      { q: [q("long", "web-impression", "What's a lasting impression you hope to give people?")] }
    ] },
    { id: "web-messaging", title: "Messaging", steps: [
      { h: "Messaging", q: [
        q("long", "web-about", "Write 2-3 sentences that explain your brand in simple terms. This is NOT the mission statement, vision statement, or other thing. It's for search engines, people, and bots. Rely on keywords and keep it easy to understand. Plain language is best."),
        q("long", "web-avoid", "Are there any keywords or phrases common among your competitors that you'd like to avoid? (optional)", { opt: 1 })
      ] },
      { h: "Messaging, continued", q: [
        q("long", "web-outcomes", "What happens for your audience after they work with you? What outcomes do people tend to see?"),
        q("long", "web-why-you", "Why do people choose your brand over others? Take a guess. What are you doing that's better?")
      ] }
    ] },
    { id: "web-content", title: "Content", steps: [
      { h: "Products / Services (optional)", p: "Add a description for each product and service as you'd like it to appear on the site. Or, share a link to a spreadsheet for more items.", q: [
        q("url", "web-products-link", "Link to a spreadsheet of products or services", { opt: 1 }),
        q("long", "web-product-1", "Product or Service Description 1", { opt: 1 }),
        q("long", "web-product-2", "Product or Service Description 2", { opt: 1 }),
        q("long", "web-product-3", "Product or Service Description 3", { opt: 1 })
      ] },
      { h: "Reviews (optional)", p: "Add a quote, review, or testimonial as you'd like it to appear on the site. Or, share a link to a spreadsheet for more items.", q: [
        q("url", "web-reviews-link", "Link to a spreadsheet of reviews", { opt: 1 }),
        q("long", "web-review-1", "Review 1", { opt: 1 }),
        q("long", "web-review-2", "Review 2", { opt: 1 }),
        q("long", "web-review-3", "Review 3", { opt: 1 })
      ] },
      { h: "Bios (optional)", p: "Share a few bios below for anyone who should be listed on the site. Or, share a link to a spreadsheet for larger teams.", q: [
        q("url", "web-bios-link", "Link to a spreadsheet of bios", { opt: 1 }),
        q("text", "web-bio-name-1", "Staff Name & Title 1", { opt: 1 }),
        q("long", "web-bio-1", "Staff Bio 1", { opt: 1 }),
        q("text", "web-bio-name-2", "Staff Name & Title 2", { opt: 1 }),
        q("long", "web-bio-2", "Staff Bio 2", { opt: 1 }),
        q("text", "web-bio-name-3", "Staff Name & Title 3", { opt: 1 }),
        q("long", "web-bio-3", "Staff Bio 3", { opt: 1 })
      ] },
      { h: "Frequently Asked Questions (optional)", p: "For SEO purposes, an FAQ section is always recommended. It helps boost your keyword usage, and it's ultra clear and kind. Or, share a link to a spreadsheet for more items.", q: [
        q("url", "web-faq-link", "Link to a spreadsheet of FAQs", { opt: 1 }),
        q("text", "web-faq-q1", "FAQ Question 1", { opt: 1 }), q("long", "web-faq-a1", "FAQ Answer 1", { opt: 1 }),
        q("text", "web-faq-q2", "FAQ Question 2", { opt: 1 }), q("long", "web-faq-a2", "FAQ Answer 2", { opt: 1 }),
        q("text", "web-faq-q3", "FAQ Question 3", { opt: 1 }), q("long", "web-faq-a3", "FAQ Answer 3", { opt: 1 }),
        q("text", "web-faq-q4", "FAQ Question 4", { opt: 1 }), q("long", "web-faq-a4", "FAQ Answer 4", { opt: 1 })
      ] }
    ] }
  ];

  function addon(title, qs) {
    return { title: title, sub: "Add-on form", sections: [{ id: null, title: title, single: true, steps: [{ q: qs }] }] };
  }
  var FORMS = {
    website: { title: "Website Foundations", sub: "Workbook", sections: WEB },
    "addon-presentation-templates": addon("Presentation Templates", [
      q("text", "pt-link", "Share a link to the presentation template you'd like to be re-designed. You may share multiple smaller presentations, or one large deck. The limit is 100 slides in total.")
    ]),
    "addon-social-media-kit": addon("Social Media Kit", [
      q("text", "sm-platforms", "You may choose up to 3 platforms for this kit. Which would you like templates for?"),
      q("yn", "sm-canva", "Would you like these made in Canva?")
    ]),
    "addon-newsletter-integration": addon("Newsletter Integration", [
      q("yn", "nl-running", "Do you currently have a newsletter running?"),
      q("text", "nl-platform", "Which platform do you use, or which have you chosen?", { x: "If you're not sure, consider Kit, Beehive, Ghost, Mailchimp, or HubSpot. Each one has its pros and cons. Then tell me which one you've chosen.", opt: 1 })
    ]),
    "addon-ecommerce": addon("eCommerce", [
      q("text", "ec-sell", "What do you sell?"),
      q("yn", "ec-shop", "Do you currently have a shop online?"),
      q("url", "ec-link", "Share a link if yes", { opt: 1 }),
      q("long", "ec-products", "List each product with a description, price, and link to an image. Or, add a link to a spreadsheet or document where this information already lives.")
    ]),
    "addon-blog": addon("Blog", [
      q("yn", "bl-have", "Do you already have a blog?"),
      q("url", "bl-link", "Share a link if yes", { opt: 1 }),
      q("check", "bl-features", "What features would you like me to include in your new blog?", { o: ["#tags for search / filter / sort", "Authored By label", "File downloads", "Time to read article", "Progress fill bar (top or bottom)", "Sponsored ad spots"] })
    ]),
    "addon-business-cards": addon("Business Card Template", [
      q("select", "bc-shape", "Card shape", { o: ["Rectangle", "Square"] }),
      q("check", "bc-features", "What features would you like to include?", { o: CARD_FEATURES })
    ]),
    "addon-email-signatures": addon("Email Signature Template", [
      q("select", "es-format", "Signature format", { o: ["HTML (plain styling - clickable links)", "PNG (brand styling - no clickable links)"] }),
      q("check", "es-features", "What features would you like to include?", { o: CARD_FEATURES.map(function (f) { return f === "Social Media handles (1-3)" ? "Social Media Links (1-3)" : f; }) })
    ])
  };
  var SPACER = '<div data-wf--spacer--variant="base" class="spacer"></div>';

  /* ---------- form rendering ---------- */
  function field(x) {
    var id = x.k, req = x.opt ? "" : " required";
    var a = ' id="' + id + '" name="' + id + '" data-name="' + id + '"' + req;
    var h = '<div class="data-step-question"><div class="form_label">' + esc(x.l) + "</div>";
    if (x.x) h += '<div class="form_label helper">' + esc(x.x) + "</div>";
    if (x.t === "long") h += '<textarea class="form_input is-text-area w-input" maxlength="5000"' + a + ' autocorrect="on" spellcheck="true"></textarea>';
    else if (x.t === "text" || x.t === "url") h += '<input class="form_input w-input" maxlength="256" type="' + (x.t === "url" ? "url" : "text") + '" placeholder="' + (x.t === "url" ? "https://" : "") + '"' + a + ' autocorrect="on" spellcheck="true">';
    else if (x.t === "select") {
      h += '<select class="dropdown-field w-select"' + a + '><option value="">Select one</option>';
      x.o.forEach(function (o) { h += '<option value="' + esc(o) + '">' + esc(o) + "</option>"; });
      h += "</select>";
    } else if (x.t === "check") {
      h += '<div class="checkbox-group">';
      x.o.forEach(function (o, i) {
        var cid = id + "-" + (i + 1);
        h += '<label class="w-checkbox foundations_checkbox-field"><input type="checkbox" id="' + cid + '" name="' + cid + '" data-name="' + esc(o) + '" class="w-checkbox-input foundations_checkbox"><span class="foundations_checkbox-label w-form-label" for="' + cid + '">' + esc(o) + "</span></label>";
      });
      h += "</div>";
    } else if (x.t === "yn") {
      h += '<div class="checkbox-group">';
      YN.forEach(function (o) {
        h += '<label class="w-radio foundations_checkbox-field"><input type="radio" name="' + id + '" value="' + o + '" class="radio-button"' + (x.opt ? "" : " required") + '><span class="foundations_checkbox-label w-form-label">' + o + "</span></label>";
      });
      h += "</div>";
    }
    return h + "</div>";
  }

  function stepNav(back, next) {
    return '<div class="step-nav">' +
      (back ? '<a role="button" data-wb-back href="#" class="button btn-back w-button">Back</a>' : "") +
      (next ? '<a role="button" data-wb-next href="#" class="button btn-next w-button">Next</a>' : "") + "</div>";
  }
  var ACTIONS = SPACER + '<div class="flex-horizontal-1rem"><a role="button" data-wb-finish href="#" class="button w-button">Submit</a><a role="button" data-wb-download href="#" class="button is-secondary">Download a PDF</a></div><div data-save-status class="portal_style-paragraph"></div>' + SPACER;

  function sectionHtml(s, id, multi, lastSec) {
    var h = '<div data-section="' + (s.id || id) + '" class="data-section is-hidden">';
    if (!s.single) {
      h += '<div class="data-section-header"><div class="progress-bar-wrapper"><div aria-live="polite" data-wb-count class="wb-step-count"></div><div class="step-progress-wrap"><div data-wb-fill class="step-progress-fill"></div></div></div><h2 class="portal_style-h2">' + esc(s.title) + "</h2></div>";
    }
    h += '<div class="data-section-content">';
    s.steps.forEach(function (st, i) {
      var last = lastSec && i === s.steps.length - 1;
      h += '<div data-wb-step="' + (i + 1) + '" class="data-step is-hidden">';
      if (st.h) h += '<div class="portal_style-h3">' + esc(st.h) + "</div>";
      if (st.p) h += '<div class="portal_style-paragraph">' + esc(st.p) + "</div>";
      st.q.forEach(function (x) { h += field(x); });
      if (last) h += ACTIONS;
      if (multi) h += stepNav(true, true);
      h += "</div>";
    });
    return h + "</div></div>";
  }

  function panelHtml(id, cfg) {
    var multi = cfg.sections.length > 1 || cfg.sections[0].steps.length > 1;
    var nav = "";
    if (multi) {
      nav = '<div class="portal_nav-list"><h3 class="portal_style-eyebrow">SECTIONS</h3>';
      cfg.sections.forEach(function (s) {
        nav += '<div class="portal_nav-list-item"><div class="portal_style-nav-item-percent" data-progress="' + s.id + '">0%</div><div class="portal_style-nav-item" data-nav="' + s.id + '">' + esc(s.title) + "</div></div>";
      });
      nav += "</div>";
    }
    var h = '<h2 class="portal_style-h1">' + esc(cfg.title) + '</h2><div class="layout_app-content"><div class="layout_app-grid">' + nav +
      '<div class="layout_foundations-wrap"><div class="w-form" data-portal-form="' + id + '"><form aria-label="' + esc(cfg.title) + '">';
    cfg.sections.forEach(function (s, i) { h += sectionHtml(s, id, multi, i === cfg.sections.length - 1); });
    return h + "</form></div></div></div></div>";
  }

  /* ---------- save, restore, finish ---------- */
  var F = {};
  var ORDER = [];
  var P = {};
  var hydrating = false;
  var timer = null;
  var chain = Promise.resolve();
  var finishing = {};
  var built = false;

  function setStatus(f, msg) {
    if (f.quiet && /^(Saving|Saved|Last saved)/.test(msg)) return;
    f.root.querySelectorAll("[data-save-status]").forEach(function (el) { el.textContent = msg; });
  }
  function fmt(iso) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function fields(root) {
    return [].slice.call(root.querySelectorAll("input, textarea, select")).filter(function (el) {
      var t = (el.type || "").toLowerCase();
      return t !== "submit" && t !== "hidden" && t !== "button";
    });
  }
  function key(el) { return el.id || el.name; }
  function metaKey(f) { return f.id === "workbook" ? "_meta" : "_meta:" + f.id; }

  function collect(sec) {
    var data = {};
    var checked = [];
    fields(sec).forEach(function (el) {
      var t = (el.type || "").toLowerCase();
      var k = key(el);
      if (!k) return;
      if (t === "checkbox") {
        if (el.checked) checked.push(k);
      } else if (t === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else if (el.value.trim()) {
        data[k] = el.value;
      }
    });
    if (checked.length) data.__checked = checked;
    return data;
  }

  function populate(f, answers) {
    hydrating = true;
    f.sections.forEach(function (s) {
      var d = answers[s.id];
      if (!d) return;
      fields(s.el).forEach(function (el) {
        var t = (el.type || "").toLowerCase();
        var k = key(el);
        if (t === "checkbox") {
          el.checked = (d.__checked || []).indexOf(k) > -1;
          var box = el.parentElement && el.parentElement.querySelector(".w-checkbox-input");
          if (box && box !== el) box.classList.toggle("w--redirected-checked", el.checked);
        } else if (t === "radio") {
          el.checked = d[el.name] === el.value;
        } else if (typeof d[k] === "string") {
          el.value = d[k];
        }
        var ev = t === "checkbox" || t === "radio" || el.tagName === "SELECT" ? "change" : "input";
        el.dispatchEvent(new Event(ev, { bubbles: true }));
      });
    });
    hydrating = false;
    f.snap = {};
    f.sections.forEach(function (s) { f.snap[s.id] = JSON.stringify(collect(s.el)); });
  }

  function saveDirty(keepalive) {
    if (!portal.token || hydrating) return Promise.resolve(true);
    chain = chain.then(function () {
      var all = [];
      ORDER.forEach(function (id) {
        var f = F[id];
        var jobs = [];
        f.sections.forEach(function (s) {
          var data = collect(s.el);
          var str = JSON.stringify(data);
          if (f.snap[s.id] === str) return;
          jobs.push(
            callFunction("save-answers", { token: portal.token, form: f.id, section_id: s.id, data: data }, keepalive).then(function () {
              f.snap[s.id] = str;
              portal.answers[s.id] = data;
            })
          );
        });
        if (!jobs.length) return;
        setStatus(f, "Saving...");
        all.push(
          Promise.all(jobs)
            .then(function () { setStatus(f, "Saved " + fmt(new Date().toISOString())); return true; })
            .catch(function (err) {
              console.error("Say When portal:", err);
              setStatus(f, "Couldn't save. We'll try again.");
              return false;
            })
        );
      });
      return Promise.all(all).then(function (r) { return r.every(Boolean); });
    });
    return chain;
  }

  function schedule(e) {
    if (hydrating || !portal.token) return;
    var wrap = e.target.closest && e.target.closest("[data-portal-form]");
    if (!wrap || wrap.getAttribute("data-portal-form") === "lost-link") return;
    clearTimeout(timer);
    timer = setTimeout(function () { saveDirty(); }, SAVE_DELAY);
  }
  document.addEventListener("input", schedule);
  document.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") saveDirty(true);
  });
  window.addEventListener("pagehide", function () { saveDirty(true); });
  window.addEventListener("online", function () { saveDirty(); });

  function itemsOf(f) { return f.items ? f.items() : walk(f); }

  function finishForm(f) {
    if (finishing[f.id]) return;
    finishing[f.id] = true;
    setStatus(f, "Sending...");
    (f.wait ? f.wait() : Promise.resolve())
      .then(function () { return saveDirty(); })
      .then(function (ok) {
        if (!ok) throw new Error("save failed");
        return pdfBase64(f).catch(function () { return ""; });
      })
      .then(function (pdf) {
        var body = { token: portal.token, form: f.id, finish: true, qa: toMarkdown(itemsOf(f)) };
        if (pdf) body.pdf = pdf;
        return callFunction("save-answers", body);
      })
      .then(function (r) {
        portal.answers[metaKey(f)] = { submittedAt: r.submittedAt };
        setStatus(f, "Sent " + fmt(r.submittedAt) + ". Thank you!");
      })
      .catch(function () { setStatus(f, "Couldn't send. Please try again."); })
      .then(function () { finishing[f.id] = false; });
  }

  /* ---------- step engine (one per form) ---------- */
  function fixUrl(f) {
    var v = f.value.trim();
    if (v && !/^https?:\/\//i.test(v)) f.value = "https://" + v;
  }

  function engine(f) {
    var root = f.root;
    var navItems = {};
    root.querySelectorAll("[data-nav]").forEach(function (n) { navItems[n.getAttribute("data-nav")] = n; });
    f.sections = [].slice.call(root.querySelectorAll("[data-section]")).map(function (el) {
      var id = el.getAttribute("data-section");
      var h = el.querySelector("h2");
      return { el: el, id: id, title: navItems[id] ? navItems[id].textContent.trim() : h ? h.textContent.trim() : id, steps: [].slice.call(el.querySelectorAll("[data-wb-step]")) };
    });
    var sections = f.sections;
    var template = f.id === "workbook" ? document.querySelector(".step-nav") : null;

    sections.forEach(function (s, si) {
      s.steps.forEach(function (step, ti) {
        var nav = step.querySelector(".step-nav");
        if (!nav && template) { nav = template.cloneNode(true); step.appendChild(nav); }
        if (!nav) return;
        var back = nav.querySelector("[data-wb-back]");
        var next = nav.querySelector("[data-wb-next]");
        var firstOverall = si === 0 && ti === 0;
        var lastInSection = ti === s.steps.length - 1;
        var lastOverall = si === sections.length - 1 && lastInSection;
        if (back) back.classList.toggle(HIDDEN, firstOverall);
        if (next) {
          next.classList.toggle(HIDDEN, lastOverall);
          if (lastInSection && !lastOverall) next.textContent = "Next: " + sections[si + 1].title;
          else if (!lastInSection) next.textContent = "Next";
        }
      });
    });

    var cur = { s: 0, t: 0 };
    function show(si, ti, scroll) {
      sections.forEach(function (s, i) {
        s.el.classList.toggle(HIDDEN, i !== si);
        s.steps.forEach(function (step, j) { step.classList.toggle(HIDDEN, !(i === si && j === ti)); });
      });
      cur = { s: si, t: ti };
      var s = sections[si];
      var n = s.steps.length || 1;
      s.el.querySelectorAll("[data-wb-count]").forEach(function (el) { el.textContent = "Step " + (ti + 1) + " of " + n; });
      s.el.querySelectorAll("[data-wb-fill]").forEach(function (el) { el.style.width = ((ti + 1) / n) * 100 + "%"; });
      Object.keys(navItems).forEach(function (id) {
        var on = id === s.id;
        navItems[id].classList.toggle("is-active", on);
        var row = navItems[id].closest(".portal_nav-list-item");
        if (row) row.classList.toggle("is-active", on);
      });
      if (scroll) s.el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function go(dir) {
      var s = sections[cur.s];
      var t = cur.t + dir;
      if (t >= 0 && t < s.steps.length) return show(cur.s, t, true);
      var si = cur.s + dir;
      if (si < 0 || si >= sections.length) return;
      show(si, dir > 0 ? 0 : Math.max(sections[si].steps.length - 1, 0), true);
    }

    function units(sec) {
      var list = [];
      var byKey = [];
      sec.querySelectorAll("input, textarea, select").forEach(function (el) {
        var type = (el.type || "").toLowerCase();
        if (type === "submit" || type === "hidden" || type === "button") return;
        var k;
        if (type === "radio") k = "r:" + el.name;
        else if (type === "checkbox") k = el.closest(".checkbox-group") || (el.closest(".w-checkbox") || el).parentElement;
        else k = el;
        var i = byKey.indexOf(k);
        if (i === -1) { byKey.push(k); list.push({ key: k, required: el.required }); }
        else if (el.required) list[i].required = true;
      });
      var required = list.filter(function (u) { return u.required; });
      return (required.length ? required : list).map(function (u) { return u.key; });
    }
    function answered(sec, k) {
      if (typeof k === "string") return !!sec.querySelector('input[type="radio"][name="' + k.slice(2) + '"]:checked');
      if (k.tagName === "INPUT" || k.tagName === "TEXTAREA" || k.tagName === "SELECT") return !!k.value.trim();
      return !!k.querySelector('input[type="checkbox"]:checked');
    }
    function check(scope) {
      var els = scope.querySelectorAll("input, textarea, select");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.type === "url") fixUrl(el);
        if (!el.checkValidity()) { el.reportValidity(); el.focus(); return el; }
      }
      return null;
    }
    f.validStep = function () { return !check(sections[cur.s].steps[cur.t]); };
    f.firstInvalid = function () {
      for (var si = 0; si < sections.length; si++) {
        for (var ti = 0; ti < sections[si].steps.length; ti++) {
          var step = sections[si].steps[ti];
          var bad = [].slice.call(step.querySelectorAll("input, textarea, select")).filter(function (el) {
            if (el.type === "url") fixUrl(el);
            return !el.checkValidity();
          })[0];
          if (bad) { show(si, ti, true); bad.reportValidity(); bad.focus(); return true; }
        }
      }
      return false;
    };
    f.go = go;
    f.jump = function (id) {
      for (var i = 0; i < sections.length; i++) if (sections[i].id === id) return show(i, 0, true);
    };
    f.update = function () {
      sections.forEach(function (s) {
        var all = units(s.el);
        var done = all.filter(function (k) { return answered(s.el, k); }).length;
        var pct = all.length ? Math.round((done / all.length) * 100) : 0;
        root.querySelectorAll('[data-progress="' + s.id + '"]').forEach(function (el) { el.textContent = pct + "%"; });
        if (navItems[s.id]) {
          var row = navItems[s.id].closest(".portal_nav-list-item") || navItems[s.id];
          row.classList.toggle("is-done", pct === 100);
        }
      });
      if (f.id === "workbook") {
        var summary = sections.filter(function (s) { return s.id === "summary"; })[0];
        if (summary) {
          var fs = [].slice.call(summary.el.querySelectorAll("textarea, input[type=text]"));
          var ready = fs.length && fs.every(function (x) { return x.value.trim(); });
          root.querySelectorAll("[data-wb-finish]").forEach(function (b) { b.classList.toggle(HIDDEN, !ready); });
        }
      }
    };

    var wrap = root.querySelector("[data-portal-form]");
    var form = wrap && (wrap.tagName === "FORM" ? wrap : wrap.querySelector("form"));
    if (form) {
      form.querySelectorAll('input[type="text"], textarea').forEach(function (el) {
        el.setAttribute("autocorrect", "on");
        el.spellcheck = true;
      });
      form.addEventListener("submit", function (e) { e.preventDefault(); e.stopPropagation(); }, true);
      form.querySelectorAll('input[type="submit"]').forEach(function (b) { b.classList.add(HIDDEN); });
      form.addEventListener("input", f.update);
      form.addEventListener("change", f.update);
      form.addEventListener("blur", function (e) { if (e.target.type === "url") fixUrl(e.target); }, true);
    }
    show(0, 0, false);
    f.update();
  }

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target.closest && e.target.closest("[data-wb-next], [data-wb-back], [data-wb-finish], [data-wb-download], .portal_nav-list-item, [data-nav]");
      if (!el) return;
      var panel = el.closest("[data-panel]");
      var f = panel && F[panel.getAttribute("data-panel")];
      if (!f) return;
      if (el.hasAttribute("data-wb-download")) return;
      e.preventDefault();
      if (el.hasAttribute("data-wb-finish")) {
        if (f.id !== "workbook" && f.firstInvalid()) return;
        return finishForm(f);
      }
      clearTimeout(timer);
      saveDirty();
      if (el.hasAttribute("data-wb-next")) {
        if (!f.validStep()) return;
        return f.go(1);
      }
      if (el.hasAttribute("data-wb-back")) return f.go(-1);
      var navEl = el.hasAttribute("data-nav") ? el : el.querySelector("[data-nav]");
      if (navEl) f.jump(navEl.getAttribute("data-nav"));
    },
    true
  );

  /* ---------- tabs ---------- */
  function route(id) {
    if (!P[id]) return;
    Object.keys(P).forEach(function (k) {
      P[k].forEach(function (el) { el.classList.toggle(HIDDEN, k !== id); });
    });
    document.querySelectorAll("[data-tab]").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-tab") === id);
    });
    window.scrollTo({ top: 0 });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-tab]");
    if (!a || !P[a.getAttribute("data-tab")]) return;
    e.preventDefault();
    clearTimeout(timer);
    saveDirty();
    route(a.getAttribute("data-tab"));
  });

  function hubItem(id, cfg, after) {
    var item = document.querySelector('[data-tab="' + id + '"]');
    if (!item) {
      var tpl = document.querySelector('.portal_hub-item[data-tab="workbook"]');
      if (!tpl) return after;
      item = tpl.cloneNode(true);
      item.setAttribute("data-tab", id);
      item.classList.remove("is-active");
    }
    after.parentNode.insertBefore(item, after.nextSibling);
    var t = item.querySelector(".portal_style-nav-item");
    var s = item.querySelector(".portal_style-paragraph");
    if (t) t.textContent = cfg.title;
    if (s) s.textContent = cfg.sub;
    item.classList.remove(HIDDEN);
    return item;
  }

  function setup(d) {
    built = true;
    var forms = d.forms || (d.workbook ? ["workbook"] : []);
    var brand = [].slice.call(document.querySelectorAll('[data-panel="workbook"]'));
    if (!brand.length) {
      [document.querySelector("[data-portal-workbook]"), document.querySelector(".layout_app-content")].forEach(function (el) {
        if (el) { el.setAttribute("data-panel", "workbook"); brand.push(el); }
      });
    }
    var content = brand.filter(function (el) { return el.querySelector("[data-section]"); })[0];
    var host = content && content.parentNode;
    if (!host) return;

    var logo = [].slice.call(host.children).filter(function (el) {
      return el.classList.contains("data-section") && !el.hasAttribute("data-section") && !el.querySelector("[data-portal-form]");
    })[0];
    if (logo && (d.logo_options || []).length) {
      var lh = document.createElement("h2");
      lh.className = "portal_style-h1 " + HIDDEN;
      lh.textContent = "Logo Options";
      host.insertBefore(lh, logo);
      var lw = document.createElement("div");
      lw.className = "layout_app-content " + HIDDEN;
      lw.innerHTML = '<div class="layout_app-grid"><div class="layout_foundations-wrap"></div></div>';
      host.insertBefore(lw, logo);
      lw.querySelector(".layout_foundations-wrap").appendChild(logo);
      logo.classList.remove(HIDDEN);
      lh.setAttribute("data-panel", "logos");
      lw.setAttribute("data-panel", "logos");
      P.logos = [lh, lw];
      var lc = logo.querySelector(".data-section-content");
      var list = logo.querySelector("[data-logo-list]");
      var stEl = logo.querySelector("[data-logo-status]");
      if (stEl) stEl.remove();
      if (lc && list) {
        var opts = d.logo_options;
        var choiceP = Promise.resolve();
        var picked = function () { var r = list.querySelector("input:checked"); return r ? r.value : ""; };
        list.innerHTML = "";
        list.style.cssText = "display:flex;flex-direction:column;gap:4rem";
        opts.forEach(function (x, i) {
          var name = x.label || "Option " + (i + 1);
          var kw = String(x.keywords || "").split(",").map(function (k) { return k.trim(); }).filter(Boolean).slice(0, 3);
          var card = document.createElement("div");
          card.className = "logo-option_card flex-vertical-1-rem";
          card.innerHTML = '<img class="logo-option_image" alt="' + esc(name) + '" src="' + esc(x.image_url) + '">' +
            '<label class="foundations_checkbox-field"><input type="radio" name="logo" class="radio-button" value="' + esc(x.id) + '"' + (x.id === d.logo_choice ? " checked" : "") + '><span class="foundations_checkbox-label">' + esc(name) + "</span></label>" +
            (x.rationale ? '<div class="portal_style-paragraph">' + esc(x.rationale) + "</div>" : "") +
            (kw.length ? '<div class="portal_style-paragraph"><strong>Keywords:</strong> ' + esc(kw.join(", ")) + "</div>" : "");
          card.querySelector("input").addEventListener("change", function () {
            choiceP = callFunction("save-logo-choice", { token: portal.token, option_id: x.id }).catch(function () {});
          });
          list.appendChild(card);
        });
        var nw = document.createElement("div");
        nw.setAttribute("data-portal-form", "logos");
        nw.style.marginTop = "4rem";
        nw.innerHTML = '<div class="data-step-question"><div class="form_label">Add any thoughts, comments, or hesitations here.</div><textarea class="form_input is-text-area w-input" maxlength="5000" id="logo-notes" name="logo-notes" data-name="logo-notes" autocorrect="on" spellcheck="true"></textarea></div>' +
          SPACER + '<div class="flex-horizontal-1rem"><a role="button" data-wb-finish href="#" class="button w-button">Submit</a><a role="button" data-logo-clear href="#" class="button is-secondary">Clear selection</a></div><div data-save-status class="portal_style-paragraph"></div>';
        lc.appendChild(nw);
        nw.querySelector("[data-logo-clear]").addEventListener("click", function (e) {
          e.preventDefault();
          list.querySelectorAll("input").forEach(function (r) { r.checked = false; });
          choiceP = callFunction("save-logo-choice", { token: portal.token, clear: true }).catch(function () {});
        });
        F.logos = {
          id: "logos", title: "Logo Options", root: logo, snap: {}, quiet: true, update: function () {},
          sections: [{ el: nw, id: "logo-notes" }],
          wait: function () { return choiceP; },
          firstInvalid: function () {
            if (picked()) return false;
            setStatus(F.logos, "Please choose a logo before submitting.");
            return true;
          },
          items: function () {
            var o = opts.filter(function (x) { return x.id === picked(); })[0];
            var a = [{ t: "h2", x: "Logo Options" }];
            if (o) {
              a.push({ t: "q", x: "Selected logo" }, { t: "a", x: o.label || "Option" });
              if (o.image_url) a.push({ t: "img", x: o.image_url });
              if (o.rationale) a.push({ t: "q", x: "Rationale" }, { t: "a", x: o.rationale });
              if (o.keywords) a.push({ t: "q", x: "Keywords" }, { t: "a", x: o.keywords });
            }
            a.push({ t: "q", x: "Add any thoughts, comments, or hesitations here." }, { t: "a", x: nw.querySelector("textarea").value.trim() });
            return a;
          }
        };
      }
      var logoTab = document.querySelector('[data-tab="logos"]');
      if (logoTab) logoTab.classList.remove(HIDDEN);
    }

    if (forms.indexOf("workbook") > -1) {
      P.workbook = brand;
      F.workbook = { id: "workbook", title: "Brand Foundations", root: content, snap: {} };
    }
    var prev = document.querySelector('.portal_hub-item[data-tab="workbook"]');
    forms.forEach(function (id) {
      if (id === "workbook" || !FORMS[id]) return;
      var cfg = FORMS[id];
      var el = document.createElement("div");
      el.className = HIDDEN;
      el.setAttribute("data-panel", id);
      el.innerHTML = panelHtml(id, cfg);
      host.appendChild(el);
      P[id] = [el];
      F[id] = { id: id, title: cfg.title, root: el, snap: {} };
      if (prev) prev = hubItem(id, cfg, prev);
    });
    var wbItem = document.querySelector('.portal_hub-item[data-tab="workbook"]');
    if (wbItem) wbItem.classList.toggle(HIDDEN, forms.indexOf("workbook") < 0);
    var webItem = document.querySelector('[data-tab="website"]');
    if (webItem && forms.indexOf("website") < 0) webItem.classList.add(HIDDEN);

    ORDER = Object.keys(F);
    portal.forms = F;
    ORDER.forEach(function (id) {
      if (F[id].quiet) return;
      try { engine(F[id]); } catch (err) { console.error("Say When portal: form " + id, err); }
    });
    var firstId = forms.indexOf("workbook") > -1 ? "workbook" : forms[0];
    if (firstId) route(firstId);
  }

  document.addEventListener("portal:ready", function (e) {
    var d = e.detail || {};
    if (portal.state === "invalid" || portal.state === "error") return;
    if (!built) setup(d);
    ORDER.forEach(function (id) {
      var f = F[id];
      populate(f, portal.answers);
      f.update();
      var meta = portal.answers[metaKey(f)];
      if (f.quiet) {
        if (meta && meta.submittedAt) setStatus(f, "Sent " + fmt(meta.submittedAt) + ". You can still update your answers.");
        return;
      }
      if (meta && meta.submittedAt) setStatus(f, "Sent " + fmt(meta.submittedAt) + ". You can still update your answers.");
      else if (d.lastSaved) setStatus(f, "Last saved " + fmt(d.lastSaved));
    });
  });

  /* ---------- PDF + export ---------- */
  function txt(el) { return el.textContent.replace(/\s+/g, " ").trim(); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function scaleLabels(l, r) {
    return [l, "Somewhat " + l, "Neither " + l + " or " + r, "Somewhat " + r, r];
  }

  function walk(f) {
    var out = [];
    f.sections.forEach(function (s) {
      var sec = s.el;
      var h = sec.querySelector(".data-section-header h2");
      if (h) out.push({ t: "h2", x: txt(h) });
      var chosen = null;
      var seen = {};
      function flush() {
        if (chosen) out.push({ t: "a", x: chosen.join(", ") });
        chosen = null;
      }
      sec.querySelectorAll(".portal_style-h3, .portal_style-h4, .form_label, .portal_style-paragraph, .scale-row, input, textarea, select").forEach(function (el) {
        if (el.matches("input, textarea, select")) {
          if (el.closest(".scale-row")) return;
          var type = (el.type || "").toLowerCase();
          if (type === "hidden" || type === "submit" || type === "button") return;
          if (type === "checkbox") {
            if (!chosen) chosen = [];
            var cw = el.closest(".w-checkbox") || el.parentElement;
            if (el.checked) chosen.push(txt(cw));
            return;
          }
          flush();
          if (type === "radio") {
            if (seen[el.name]) return;
            seen[el.name] = 1;
            var on = sec.querySelector('input[type="radio"][name="' + el.name + '"]:checked');
            out.push({ t: "a", x: on ? on.value : "" });
            return;
          }
          var v = el.tagName === "SELECT" ? (el.value ? el.options[el.selectedIndex].text : "") : el.value;
          out.push({ t: "a", x: v.trim() });
          return;
        }
        flush();
        if (el.classList.contains("scale-row")) {
          var l = txt(el.querySelector(".scale-label.is-left")), r = txt(el.querySelector(".scale-label.is-right"));
          var radios = [].slice.call(el.querySelectorAll("input[type=radio]"));
          var at = radios.findIndex(function (i) { return i.checked; });
          out.push({ t: "q", x: l + " / " + r });
          out.push({ t: "a", x: at < 0 ? "" : scaleLabels(l, r)[at] });
          return;
        }
        if (el.classList.contains("helper")) return;
        var text = txt(el);
        if (!text) return;
        var para = el.classList.contains("portal_style-paragraph");
        out.push({ t: el.classList.contains("portal_style-h3") ? "h3" : el.classList.contains("portal_style-h4") ? "h4" : "q", x: text, p: para });
      });
      flush();
    });
    return out.filter(function (it, i) {
      return !it.p || (out[i + 1] && out[i + 1].t === "a");
    });
  }

  function toMarkdown(items) {
    return items
      .filter(function (i) { return i.t !== "img"; })
      .map(function (i) {
        if (i.t === "h2") return "## " + i.x;
        if (i.t === "h3" || i.t === "h4") return "### " + i.x;
        if (i.t === "q") return "**" + i.x + "**";
        return i.x || "-";
      })
      .join("\n\n");
  }

  function pdfDoc(f, noImg) {
    var INK = "#142823";
    var css =
      "<style>" +
      ".p{width:720px;font-family:Uniformrnd,Helvetica,Arial,sans-serif;color:" + INK + ";background:#fff}" +
      ".p h1{font-size:46px;line-height:1;margin:0 0 10px;font-weight:800}" +
      ".p h2{font-size:22px;margin:0 0 6px;padding-bottom:6px;border-bottom:2px solid " + INK + "}" +
      ".p h3{font-size:17px;font-weight:700;margin:30px 0 6px}.p h4{font-size:13px;font-weight:700;margin:18px 0 4px;text-transform:uppercase}" +
      ".p .intro{font-size:13px;line-height:1.45;margin:0 0 8px}" +
      ".p .sub{font-size:13px;margin:0 0 14px}" +
      ".p .q{font-size:13px;font-weight:700;margin:14px 0 5px}" +
      ".p .a{font-size:13px;line-height:1.45;white-space:pre-wrap;border:1.5px solid " + INK + ";border-radius:8px;padding:8px 10px;min-height:18px}" +
      ".pdf-break{page-break-before:always;break-before:page;height:0}" +
      "</style>";
    var name = (portal.client && portal.client.name) || "";
    var h = css + '<div class="p"><p class="sub">Say When Design Studio</p><h1>' + esc(f.title) + "</h1>";
    h += '<p class="sub">' + (name ? esc(name) + "<br>" : "") + "Completed " +
      new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "</p>";
    var first = true;
    var items = itemsOf(f);
    var pending = null;
    function intro() {
      if (pending !== null) h += '<p class="intro">' + esc(pending) + "</p>";
      pending = null;
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === "h2") {
        intro();
        h += (first ? "" : '<div class="pdf-break"></div>') + "<h2>" + esc(it.x) + "</h2>";
        first = false;
      } else if (it.t === "h3") { intro(); h += "<h3>" + esc(it.x) + "</h3>"; }
      else if (it.t === "h4") { intro(); h += "<h4>" + esc(it.x) + "</h4>"; }
      else if (it.t === "q") { intro(); pending = it.x; }
      else if (it.t === "img") { if (!noImg) h += '<img src="' + esc(it.x) + '" crossorigin="anonymous" style="width:260px;display:block;margin:8px 0 4px;border:2px solid ' + INK + ';border-radius:16px">'; }
      else {
        h += '<div class="qa">' + (pending !== null ? '<div class="q">' + esc(pending) + "</div>" : "") + '<div class="a">' + (esc(it.x) || "&nbsp;") + "</div></div>";
        pending = null;
      }
    }
    intro();
    h += "</div>";
    var root = document.createElement("div");
    root.innerHTML = h;
    return root;
  }

  var pdfLib;
  function loadPdfLib() {
    if (window.html2pdf) return Promise.resolve();
    return pdfLib || (pdfLib = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = HTML2PDF;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    }));
  }
  function pdfOptions(filename, quality) {
    return {
      margin: [0.5, 0.5, 0.6, 0.5],
      filename: filename,
      image: { type: "jpeg", quality: quality },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css"], avoid: [".qa"] },
    };
  }
  function pdfBase64(f) {
    return loadPdfLib()
      .then(function () {
        var run = function (noImg) { return window.html2pdf().set(pdfOptions("form.pdf", 0.85)).from(pdfDoc(f, noImg)).outputPdf("datauristring"); };
        return run(false).catch(function () { return run(true); });
      })
      .then(function (uri) { return String(uri).split("base64,")[1] || ""; });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-wb-download]");
    if (!btn) return;
    e.preventDefault();
    var panel = btn.closest("[data-panel]");
    var f = panel && F[panel.getAttribute("data-panel")];
    if (!f || btn.getAttribute("aria-busy") === "true") return;
    var label = btn.textContent;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Preparing your PDF...";
    loadPdfLib()
      .then(function () {
        var slug = ((portal.client && portal.client.name) || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return window.html2pdf().set(pdfOptions(f.title.replace(/\s+/g, "-") + "-" + slug + ".pdf", 0.95)).from(pdfDoc(f)).save();
      })
      .catch(function () {
        alert("Sorry, the PDF could not be created. Please try again, or use a different browser.");
      })
      .then(function () {
        btn.removeAttribute("aria-busy");
        btn.textContent = label;
      });
  });

  window.addEventListener("hashchange", load);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
