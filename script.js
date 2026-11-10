// ====== CONFIGURAÇÃO ======
// Preencha com o e-mail oficial do Instituto. Enquanto estiver vazio,
// o formulário apenas avisa que o contato ainda não foi configurado.
const CONTACT_EMAIL = "";

// Menu mobile
const btn = document.querySelector(".menu-btn");
const menu = document.getElementById("menu");
btn.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(open));
});
menu.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }
});

// Animação de entrada
const targets = document.querySelectorAll(".card, .stat, .timeline li, .flow li, .principle, .callout");
targets.forEach((el) => el.classList.add("reveal"));
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
} else {
  targets.forEach((el) => el.classList.add("in"));
}

// Formulário (abre o cliente de e-mail do visitante)
const form = document.getElementById("form");
const status = form.querySelector(".form__status");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(form);
  if (!d.get("nome").trim() || !/^\S+@\S+\.\S+$/.test(d.get("email"))) {
    status.textContent = "Informe seu nome e um e-mail válido.";
    return;
  }
  if (!CONTACT_EMAIL) {
    status.textContent = "Canal de contato ainda não configurado. Defina CONTACT_EMAIL em script.js.";
    return;
  }
  const body = `Nome: ${d.get("nome")}\nE-mail: ${d.get("email")}\nPerfil: ${d.get("perfil")}\n\n${d.get("msg")}`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contato pelo site – Método SINAPSE")}&body=${encodeURIComponent(body)}`;
  status.textContent = "Abrindo seu aplicativo de e-mail…";
});
