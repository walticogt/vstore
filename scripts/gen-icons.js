/* Genera assets de icono/splash con margen de seguridad para que la máscara
 * adaptativa de Android no recorte el texto del logo. Usa sharp. */
const sharp = require('sharp');

const SRC = 'logo1024x1024.png';
const S = 1024;
const SS = 2732;

async function main() {
  // Muestrea el color de fondo del logo (esquina superior izquierda).
  const corner = await sharp(SRC).extract({ left: 0, top: 0, width: 8, height: 8 }).resize(1, 1).removeAlpha().raw().toBuffer();
  const bg = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
  console.log('Fondo del logo:', bg.r, bg.g, bg.b);

  // Logo al 62% (dentro de la zona segura del icono adaptativo ~66%).
  const L = Math.round(S * 0.62);
  const pad = Math.round((S - L) / 2);
  const logo = await sharp(SRC).resize(L, L, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  // Foreground: logo centrado sobre transparente.
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, top: pad, left: pad }]).png().toFile('assets/icon-foreground.png');

  // Background: color sólido del logo.
  await sharp({ create: { width: S, height: S, channels: 4, background: bg } }).png().toFile('assets/icon-background.png');

  // Icon-only (legacy/web): fondo sólido + logo centrado.
  await sharp({ create: { width: S, height: S, channels: 4, background: bg } })
    .composite([{ input: logo, top: pad, left: pad }]).png().toFile('assets/icon-only.png');

  // Splash: logo ~32% centrado sobre el fondo (claro y oscuro).
  const SL = Math.round(SS * 0.32);
  const spad = Math.round((SS - SL) / 2);
  const splashLogo = await sharp(SRC).resize(SL, SL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  await sharp({ create: { width: SS, height: SS, channels: 4, background: bg } })
    .composite([{ input: splashLogo, top: spad, left: spad }]).png().toFile('assets/splash.png');

  await sharp({ create: { width: SS, height: SS, channels: 4, background: { r: 43, g: 33, b: 58, alpha: 1 } } })
    .composite([{ input: splashLogo, top: spad, left: spad }]).png().toFile('assets/splash-dark.png');

  console.log('Assets generados en assets/');
}

main().catch((e) => { console.error(e); process.exit(1); });
