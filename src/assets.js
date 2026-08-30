const sprite = (frameWidth, frameHeight) => ({ frames: 1, frameWidth, frameHeight, fps: 8 });
const dragonHitbox = { x: 0.18, y: 0.16, width: 0.64, height: 0.66 };

export const CHARACTER_MANIFEST = Object.freeze({
  verdant: Object.freeze({
    id: "verdant",
    image: "./assets/ryku/ryku-game.png",
    sprite: sprite(1607, 979),
    hitbox: dragonHitbox,
    accent: "#baff39",
  }),
  ember: Object.freeze({
    id: "ember",
    image: "./assets/ryku/ryku-game.png",
    sprite: sprite(1607, 979),
    hitbox: dragonHitbox,
    accent: "#ff9f43",
  }),
  storm: Object.freeze({
    id: "storm",
    image: "./assets/ryku/ryku-game.png",
    sprite: sprite(1607, 979),
    hitbox: dragonHitbox,
    accent: "#7be7ff",
  }),
  companion: Object.freeze({
    id: "companion",
    image: "./assets/companion/jungle-scout-placeholder.svg",
    sprite: sprite(260, 220),
    hitbox: { x: 0.2, y: 0.15, width: 0.6, height: 0.72 },
    accent: "#dfff7a",
  }),
});

export const ARENA_BACKGROUND = Object.freeze({
  id: "arenaBackground",
  image: "./assets/backgrounds/ryku-jungle.png",
});

export function characterForKind(kind) {
  return CHARACTER_MANIFEST[kind] ?? CHARACTER_MANIFEST.verdant;
}

export async function loadCharacterImages(ImageClass = globalThis.Image) {
  const assets = [...Object.values(CHARACTER_MANIFEST), ARENA_BACKGROUND];
  const entries = await Promise.all(assets.map((character) => new Promise((resolve) => {
    const image = new ImageClass();
    image.addEventListener("load", () => resolve([character.id, image]), { once: true });
    image.addEventListener("error", () => resolve([character.id, null]), { once: true });
    image.src = character.image;
  })));
  return Object.fromEntries(entries);
}
