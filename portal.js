(function () {
  "use strict";

  var script = document.currentScript;
  var FUNCTIONS_URL = (script && script.getAttribute("data-functions-url")) || "";
  var TOKEN_PATTERN = /^[a-f0-9]{32}$/;
  var HIDDEN = "is-hidden";

  // Shared state for later phases (workbook steps, saving, summary).
  var portal = (window.SayWhenPortal = { token: null, client: null, answers: {}, state: null });

  function callFunction(name, body) {
    return fetch(FUNCTIONS_URL.replace(/\/$/, "") + "/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      if (!res.ok) throw new Error(name + " returned " + res.status);
      return res.json();
    });
  }

  // Show exactly one [data-state] section.
  function showState(name) {
    var sections = document.querySelectorAll("[data-state]");
    var found = false;
    sections.forEach(function (el) {
      var match = el.getAttribute("data-state") === name;
      el.classList.toggle(HIDDEN, !match);
      if (match) found = true;
    });
    // Fall back to "invalid" if the page has no section for this state (e.g. "error").
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

  window.addEventListener("hashchange", load);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
