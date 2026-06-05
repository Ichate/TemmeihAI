const tagline = "ai bots that actually play minecraft with you.";
const taglineEl = document.getElementById("tagline");

let i = 0;
const interval = setInterval(() => {
  i++;
  taglineEl.innerHTML = tagline.slice(0, i) + '<span class="blink">_</span>';
  if (i >= tagline.length) clearInterval(interval);
}, 45);
