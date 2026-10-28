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

  /* ---------- workbook: save, restore, finish ---------- */
  var snapshot = {};
  var hydrating = false;
  var timer = null;
  var chain = Promise.resolve();
  var finishing = false;

  function setStatus(msg) {
    document.querySelectorAll("[data-save-status]").forEach(function (el) {
      el.textContent = msg;
    });
  }
  function fmt(iso) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function sections() {
    return [].slice.call(document.querySelectorAll("[data-section]"));
  }
  function fields(root) {
    return [].slice.call(root.querySelectorAll("input, textarea, select")).filter(function (el) {
      var t = (el.type || "").toLowerCase();
      return t !== "submit" && t !== "hidden" && t !== "button";
    });
  }
  function key(el) {
    return el.id || el.name;
  }

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

  function populate(answers) {
    hydrating = true;
    sections().forEach(function (sec) {
      var d = answers[sec.getAttribute("data-section")];
      if (!d) return;
      fields(sec).forEach(function (el) {
        var t = (el.type || "").toLowerCase();
        var k = key(el);
        if (t === "checkbox") {
          el.checked = (d.__checked || []).indexOf(k) > -1;
          var box = el.parentElement && el.parentElement.querySelector(".w-checkbox-input");
          if (box) box.classList.toggle("w--redirected-checked", el.checked);
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
    snapshot = {};
    sections().forEach(function (sec) {
      snapshot[sec.getAttribute("data-section")] = JSON.stringify(collect(sec));
    });
  }

  function saveDirty(keepalive) {
    if (!portal.token || hydrating) return Promise.resolve(true);
    chain = chain.then(function () {
      var jobs = [];
      sections().forEach(function (sec) {
        var id = sec.getAttribute("data-section");
        var data = collect(sec);
        var s = JSON.stringify(data);
        if (snapshot[id] === s) return;
        jobs.push(
          callFunction("save-answers", { token: portal.token, section_id: id, data: data }, keepalive).then(function () {
            snapshot[id] = s;
            portal.answers[id] = data;
          })
        );
      });
      if (!jobs.length) return true;
      setStatus("Saving...");
      return Promise.all(jobs)
        .then(function () {
          setStatus("Saved " + fmt(new Date().toISOString()));
          return true;
        })
        .catch(function (err) {
          console.error("Say When portal:", err);
          setStatus("Couldn't save. We'll try again.");
          return false;
        });
    });
    return chain;
  }

  function schedule(e) {
    if (hydrating || !portal.token) return;
    if (!(e.target.closest && e.target.closest('[data-portal-form="workbook"]'))) return;
    clearTimeout(timer);
    timer = setTimeout(function () { saveDirty(); }, SAVE_DELAY);
  }
  document.addEventListener("input", schedule);
  document.addEventListener("change", schedule);
  document.addEventListener(
    "click",
    function (e) {
      if (e.target.closest && e.target.closest("[data-wb-next], [data-wb-back], [data-nav], .portal_nav-list-item")) {
        clearTimeout(timer);
        saveDirty();
      }
    },
    true
  );
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") saveDirty(true);
  });
  window.addEventListener("pagehide", function () { saveDirty(true); });
  window.addEventListener("online", function () { saveDirty(); });

  document.addEventListener("portal:ready", function (e) {
    var d = e.detail || {};
    if (portal.state === "invalid" || portal.state === "error") return;
    populate(portal.answers);
    var meta = portal.answers._meta;
    if (meta && meta.submittedAt) setStatus("Sent " + fmt(meta.submittedAt) + ". You can still update your answers.");
    else if (d.lastSaved) setStatus("Last saved " + fmt(d.lastSaved));
  });

  document.addEventListener("workbook:finish", function () {
    if (finishing) return;
    finishing = true;
    setStatus("Sending...");
    saveDirty()
      .then(function (ok) {
        if (!ok) throw new Error("save failed");
        return pdfBase64().catch(function () { return ""; });
      })
      .then(function (pdf) {
        var body = { token: portal.token, finish: true, qa: toMarkdown(walk()) };
        if (pdf) body.pdf = pdf;
        return callFunction("save-answers", body);
      })
      .then(function (r) {
        setStatus("Sent " + fmt(r.submittedAt) + ". Thank you!");
      })
      .catch(function () {
        setStatus("Couldn't send. Please try again.");
      })
      .then(function () { finishing = false; });
  });

  /* ---------- workbook: PDF + export ---------- */
  function txt(el) {
    return el.textContent.replace(/\s+/g, " ").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function walk() {
    var out = [];
    sections().forEach(function (sec) {
      var h = sec.querySelector(".data-section-header h2");
      out.push({ t: "h2", x: h ? txt(h) : sec.getAttribute("data-section") });
      var chosen = null;
      function flush() {
        if (chosen) out.push({ t: "a", x: chosen.join(", ") });
        chosen = null;
      }
      sec.querySelectorAll(".portal_style-h3, .portal_style-h4, .form_label, input, textarea, select").forEach(function (el) {
        if (el.matches("input, textarea, select")) {
          var type = (el.type || "").toLowerCase();
          if (type === "hidden" || type === "submit" || type === "button") return;
          if (type === "checkbox") {
            if (!chosen) chosen = [];
            var wrap = el.closest(".w-checkbox") || el.parentElement;
            if (el.checked) chosen.push(txt(wrap));
            return;
          }
          flush();
          if (type === "radio") {
            if (el.checked) out.push({ t: "a", x: el.value });
            return;
          }
          var v = el.tagName === "SELECT" ? (el.value ? el.options[el.selectedIndex].text : "") : el.value;
          out.push({ t: "a", x: v.trim() });
          return;
        }
        flush();
        if (el.classList.contains("helper")) return;
        var text = txt(el);
        if (!text) return;
        out.push({ t: el.classList.contains("portal_style-h3") ? "h3" : el.classList.contains("portal_style-h4") ? "h4" : "q", x: text });
      });
      flush();
    });
    return out;
  }

  function toMarkdown(items) {
    return items
      .map(function (i) {
        if (i.t === "h2") return "## " + i.x;
        if (i.t === "h3" || i.t === "h4") return "### " + i.x;
        if (i.t === "q") return "**" + i.x + "**";
        return i.x || "-";
      })
      .join("\n\n");
  }

  function pdfDoc() {
    var INK = "#142823";
    var css =
      "<style>" +
      ".p{width:720px;font-family:Uniformrnd,Helvetica,Arial,sans-serif;color:" + INK + ";background:#fff}" +
      ".p h1{font-size:46px;line-height:1;margin:0 0 10px;font-weight:800}" +
      ".p h2{font-size:22px;margin:0 0 6px;padding-bottom:6px;border-bottom:2px solid " + INK + "}" +
      ".p h3{font-size:15px;margin:18px 0 4px}.p h4{font-size:13px;margin:14px 0 4px;text-transform:uppercase}" +
      ".p .sub{font-size:13px;margin:0 0 14px}" +
      ".p .q{font-size:13px;font-weight:700;margin:14px 0 5px}" +
      ".p .a{font-size:13px;line-height:1.45;white-space:pre-wrap;border:1.5px solid " + INK + ";border-radius:8px;padding:8px 10px;min-height:18px}" +
      ".pdf-break{page-break-before:always;break-before:page;height:0}" +
      "</style>";
    var name = (portal.client && portal.client.name) || "";
    var h = css + '<div class="p"><p class="sub">Say When Design Studio</p><h1>Brand Foundations</h1>';
    h += '<p class="sub">' + (name ? esc(name) + "<br>" : "") + "Completed " +
      new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "</p>";
    var first = true;
    var items = walk();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === "h2") {
        h += (first ? "" : '<div class="pdf-break"></div>') + "<h2>" + esc(it.x) + "</h2>";
        first = false;
      } else if (it.t === "h3") h += "<h3>" + esc(it.x) + "</h3>";
      else if (it.t === "h4") h += "<h4>" + esc(it.x) + "</h4>";
      else if (it.t === "q") h += '<div class="qa"><div class="q">' + esc(it.x) + "</div>";
      else h += '<div class="a">' + (esc(it.x) || "&nbsp;") + "</div></div>";
    }
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
  function pdfBase64() {
    return loadPdfLib()
      .then(function () {
        return window.html2pdf().set(pdfOptions("workbook.pdf", 0.85)).from(pdfDoc()).outputPdf("datauristring");
      })
      .then(function (uri) {
        return String(uri).split("base64,")[1] || "";
      });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-wb-download]");
    if (!btn) return;
    e.preventDefault();
    if (btn.getAttribute("aria-busy") === "true") return;
    var label = btn.textContent;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Preparing your PDF...";
    loadPdfLib()
      .then(function () {
        var slug = (((portal.client && portal.client.name) || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        return window.html2pdf().set(pdfOptions("Brand-Foundations-" + slug + ".pdf", 0.95)).from(pdfDoc()).save();
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
