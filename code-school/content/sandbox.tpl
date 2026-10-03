@template Пустая программа (консоль)
// Пиши здесь что угодно и нажимай «▶ Запустить»
console.log("Привет! Это моя песочница.");

@template Заготовка игры (герой и стрелки) | canvas
// Заготовка игры: герой двигается стрелками.
// Меняй, добавляй врагов, монеты — это твоя игра!
const player = { x: 220, y: 140, w: 40, h: 40, speed: 4, color: "#7c6cff" };
const keys = {};
document.addEventListener("keydown", (e) => { keys[e.key] = true; });
document.addEventListener("keyup", (e) => { keys[e.key] = false; });

function update() {
  if (keys["ArrowLeft"]) player.x -= player.speed;
  if (keys["ArrowRight"]) player.x += player.speed;
  if (keys["ArrowUp"]) player.y -= player.speed;
  if (keys["ArrowDown"]) player.y += player.speed;
  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));
}

function draw() {
  ctx.fillStyle = "#0d1326";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText("Кликни по игре и жми стрелки", 10, 22);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

@template Рисовалка мышью | canvas
// Зажми кнопку мыши и рисуй. Цвет меняется сам!
let drawing = false;
let hue = 0;
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
canvas.addEventListener("mousedown", () => { drawing = true; });
window.addEventListener("mouseup", () => { drawing = false; });
canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const p = pos(e);
  hue = (hue + 2) % 360;
  ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.fill();
});
ctx.fillStyle = "white";
ctx.font = "18px Arial";
ctx.fillText("Зажми мышь и рисуй", 10, 24);

@template Звёздное небо | canvas
// Бесконечный полёт сквозь звёзды
const stars = [];
for (let i = 0; i < 200; i++) {
  stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, z: Math.random() * 3 + 0.5 });
}
function loop() {
  ctx.fillStyle = "#03040f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of stars) {
    s.x -= s.z * 1.5;
    if (s.x < 0) { s.x = canvas.width; s.y = Math.random() * canvas.height; }
    ctx.fillStyle = `rgba(255, 255, 255, ${s.z / 3.5})`;
    ctx.fillRect(s.x, s.y, s.z, s.z);
  }
  requestAnimationFrame(loop);
}
loop();
