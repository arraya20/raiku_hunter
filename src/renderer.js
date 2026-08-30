import { ARENA_HEIGHT, ARENA_WIDTH, getTargetPosition } from "./game.js";
import { characterForKind } from "./assets.js";

export function clientPointToArena(point, bounds) {
  return {
    x: Math.round(((point.clientX - bounds.left) / bounds.width) * ARENA_WIDTH),
    y: Math.round(((point.clientY - bounds.top) / bounds.height) * ARENA_HEIGHT),
  };
}

export function coverCrop(sourceWidth, sourceHeight, destinationWidth, destinationHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const destinationRatio = destinationWidth / destinationHeight;
  if (sourceRatio > destinationRatio) {
    const width = sourceHeight * destinationRatio;
    return { sx: (sourceWidth - width) / 2, sy: 0, sw: width, sh: sourceHeight };
  }
  const height = sourceWidth / destinationRatio;
  return { sx: 0, sy: (sourceHeight - height) / 2, sw: sourceWidth, sh: height };
}

export function snapshotActiveTargets(wave, tick) {
  const elapsed = tick - wave.startedAtTick;
  return wave.targets.filter((target) => !target.isHit).map((target) => {
    const position = getTargetPosition(target, elapsed, wave.durationTicks);
    return {
      id: target.id,
      kind: target.kind,
      x: position.x,
      y: position.y,
      width: target.width,
      height: target.height,
      direction: target.endX >= target.startX ? 1 : -1,
    };
  });
}

export function createFallingTargetEffect(target, { reducedMotion = false } = {}) {
  return {
    ...target,
    type: "fallingTarget",
    age: 0,
    duration: reducedMotion ? 300 : 600,
    spin: reducedMotion ? Math.PI * 0.5 : Math.PI * 3,
  };
}

export function fallingEffectForHit(event, snapshots, options) {
  if (!event.hit) return null;
  const target = snapshots.find((candidate) => candidate.id === event.targetId);
  return target ? createFallingTargetEffect(target, options) : null;
}

export function fallingTargetFrame(effect) {
  const progress = Math.max(0, Math.min(1, effect.age / effect.duration));
  const alpha = progress <= 0.7 ? 1 : Math.max(0, (1 - progress) / 0.3);
  return {
    x: effect.x + (effect.direction * 60 * progress),
    y: effect.y + (40 * progress) + (460 * progress * progress),
    rotation: effect.direction * effect.spin * progress,
    alpha,
  };
}

export function advanceVisualEffects(effects, delta) {
  return effects.map((effect) => (effect.type === "fallingTarget"
    ? { ...effect, age: effect.age + delta }
    : { ...effect, life: effect.life - (delta / 350) }))
    .filter((effect) => (effect.type === "fallingTarget" ? effect.age < effect.duration : effect.life > 0));
}

export class ArenaRenderer {
  constructor(canvas, images = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.images = images;
  }

  draw(run, tick, pointer, effects = []) {
    const context = this.context;
    context.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.#drawJungle(context, tick);
    if (run?.wave) this.#drawTargets(context, run.wave, tick);
    this.#drawEffects(context, effects);
    if (pointer) this.#drawCrosshair(context, pointer);
  }

  #drawJungle(context, tick) {
    const background = this.images.arenaBackground;
    const sourceWidth = background?.naturalWidth || background?.width;
    const sourceHeight = background?.naturalHeight || background?.height;
    if (background && sourceWidth && sourceHeight) {
      const crop = coverCrop(sourceWidth, sourceHeight, ARENA_WIDTH, ARENA_HEIGHT);
      context.drawImage(
        background,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        ARENA_WIDTH,
        ARENA_HEIGHT,
      );
      context.fillStyle = "rgba(2, 18, 12, 0.2)";
      context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      return;
    }

    const sky = context.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    sky.addColorStop(0, "#071b1b");
    sky.addColorStop(0.62, "#0b241c");
    sky.addColorStop(1, "#06100d");
    context.fillStyle = sky;
    context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    context.globalAlpha = 0.15;
    context.strokeStyle = "#baff39";
    context.lineWidth = 1;
    const scan = (tick * 0.7) % 48;
    for (let y = scan; y < ARENA_HEIGHT; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(ARENA_WIDTH, y);
      context.stroke();
    }
    context.globalAlpha = 1;

    context.fillStyle = "#0b2d20";
    for (let x = -40; x < ARENA_WIDTH + 80; x += 80) {
      const height = 86 + (Math.sin(x * 0.037) * 28);
      context.beginPath();
      context.ellipse(x, ARENA_HEIGHT - 50, 72, height, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#03100c";
    context.fillRect(0, ARENA_HEIGHT - 62, ARENA_WIDTH, 62);
  }

  #drawTargets(context, wave, tick) {
    const elapsed = tick - wave.startedAtTick;
    for (const target of wave.targets) {
      if (target.isHit) continue;
      const position = getTargetPosition(target, elapsed, wave.durationTicks);
      const character = characterForKind(target.kind);
      const image = this.images[character.id];
      context.save();
      if (target.endX < target.startX) {
        context.translate(position.x, 0);
        context.scale(-1, 1);
        context.translate(-position.x, 0);
      }
      if (image) {
        context.drawImage(image, position.x - (target.width / 2), position.y - (target.height / 2), target.width, target.height);
      } else {
        this.#drawFallbackDragon(context, position, target, character.accent);
      }
      context.restore();
    }
  }

  #drawFallbackDragon(context, position, target, accent) {
    context.fillStyle = accent;
    context.beginPath();
    context.ellipse(position.x, position.y, target.width * 0.34, target.height * 0.3, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(position.x - 12, position.y - 8);
    context.lineTo(position.x - (target.width * 0.6), position.y - (target.height * 0.55));
    context.lineTo(position.x - (target.width * 0.34), position.y + 4);
    context.fill();
    context.fillStyle = "#07110d";
    context.beginPath();
    context.arc(position.x + (target.width * 0.2), position.y - 7, 3, 0, Math.PI * 2);
    context.fill();
  }

  #drawEffects(context, effects) {
    for (const effect of effects) {
      if (effect.type === "fallingTarget") {
        this.#drawFallingTarget(context, effect);
        continue;
      }
      context.globalAlpha = Math.max(0, effect.life);
      context.strokeStyle = effect.type === "hit" ? "#baff39" : "#ff9f43";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(effect.x, effect.y, 18 + ((1 - effect.life) * 30), 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  #drawFallingTarget(context, effect) {
    const frame = fallingTargetFrame(effect);
    const character = characterForKind(effect.kind);
    const image = this.images[character.id];
    context.save();
    context.globalAlpha = frame.alpha;
    context.translate(frame.x, frame.y);
    context.rotate(frame.rotation);
    if (effect.direction < 0) context.scale(-1, 1);
    if (image) {
      context.drawImage(image, -(effect.width / 2), -(effect.height / 2), effect.width, effect.height);
    } else {
      this.#drawFallbackDragon(context, { x: 0, y: 0 }, effect, character.accent);
    }
    context.restore();
  }

  #drawCrosshair(context, pointer) {
    context.strokeStyle = "#efffd2";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(pointer.x, pointer.y, 15, 0, Math.PI * 2);
    context.moveTo(pointer.x - 24, pointer.y);
    context.lineTo(pointer.x - 8, pointer.y);
    context.moveTo(pointer.x + 8, pointer.y);
    context.lineTo(pointer.x + 24, pointer.y);
    context.moveTo(pointer.x, pointer.y - 24);
    context.lineTo(pointer.x, pointer.y - 8);
    context.moveTo(pointer.x, pointer.y + 8);
    context.lineTo(pointer.x, pointer.y + 24);
    context.stroke();
  }
}
