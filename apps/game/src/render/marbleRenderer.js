/**
 * The marbles themselves.
 *
 * Each design is a pure function that paints one marble onto a 2D context, so a
 * design is picked by name and nothing else in the renderer has to know which
 * one is in play.
 */

/**
 * The ring a marble wears when it is picked up or under the pointer.
 *
 * It has to read against three different backdrops at once — the slate board,
 * a near-black marble and a white one — so it is the palest, most saturated
 * member of the accent family rather than the accent itself. Keep in step with
 * `--color-brand-lighter`.
 */
const HIGHLIGHT = '#7ec2e1';

function strokeMarbleOutline(ctx, x, y, radius, isSelected, isHovered, baseLineWidth, defaultStroke) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (isSelected) {
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = baseLineWidth * 2;
  } else if (isHovered) {
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = baseLineWidth * 1.5;
  } else {
    ctx.strokeStyle = defaultStroke.color;
    ctx.lineWidth = baseLineWidth * defaultStroke.widthFactor;
  }
  ctx.stroke();
}

function renderDefaultMarble(ctx, x, y, radius, color, isSelected, isHovered, baseLineWidth) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = baseLineWidth;
  strokeMarbleOutline(ctx, x, y, radius, isSelected, isHovered, baseLineWidth, {
    color: '#000',
    widthFactor: 1,
  });
}

/* ------------------------------------------------------------------ *
 * The lit marble
 *
 * Shaded a pixel at a time rather than washed with gradients. A stack of
 * radial fills can only ever approximate a sphere — each one is a flat disc of
 * colour, and the places where they cross are where the illusion goes: the
 * highlight sits on the surface like a sticker and the silhouette has no
 * shape. Working from the surface normal instead, every pixel gets the light
 * that actually reaches it, so the roundness comes out of the geometry and the
 * highlight lands where the light puts it.
 *
 * That costs a loop over the marble's area, which would be far too slow to do
 * on a moving board — so it is done once. There are two colours and one radius
 * in play at a time, which is two bitmaps for the whole game; every marble on
 * every frame is a copy of one of them.
 * ------------------------------------------------------------------ */

function unit(x, y, z) {
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

/**
 * The rig, in canvas axes: x to the right, y *down*, z out of the screen.
 *
 * One key light up and to the left, which is where every one of these marbles
 * has been lit from since the board was first drawn — the highlight has to stay
 * where players already expect it. `HALF` is the Blinn half-vector between that
 * light and the viewer, which is what the specular lobe is measured against.
 *
 * `UP` is which way is "away from the board", and it is not a light. The fill is
 * the room, split in two about that axis: whatever is coming back off the slate
 * below on one side of it, the darker air above on the other, and every surface
 * in between getting its share of the two. It is the only thing lighting the
 * underside — take it out and a marble reads as a disc cut out of the board.
 *
 * A fill has to be a gradient like that rather than a second lamp. Aiming a dim
 * light up from the board is the obvious way to do it and it puts a crease
 * across the ball: the lamp's own bright side rises where the key's is already
 * falling, so the two miss each other and leave a dark seam between them, and a
 * seam on a sphere is a dent.
 */
const KEY = unit(-0.42, -0.6, 0.68);
const HALF = unit(KEY.x, KEY.y, KEY.z + 1);
const UP = unit(0.1, 0.85, 0.5);

/**
 * How much each channel gives up at the silhouette. Red first and blue last, so
 * a contour cools rather than merely darkening — light grazing away from you off
 * a rounded surface loses its warmth before it loses its brightness.
 */
const EDGE_CHANNEL = [1, 0.94, 0.84];

/**
 * The two bodies. `sky`/`ground` are the ends of the fill gradient — how much
 * of the room reaches a face turned fully away from the board and one turned
 * fully into it. `diffuse` is the key on top of that, `spec` and `shine` the
 * hotspot, `sheen` the same highlight spread wide.
 */
const BODIES = {
  white: {
    key: 'ivory',
    base: [252, 251, 249],
    sky: 0.38,
    ground: 0.66,
    diffuse: 0.38,
    // A white body is already at the top of the range, so the silhouette can
    // only be described by taking light away: no rim, a firm contour.
    edge: 0.45,
    rim: null,
    spec: 0.5,
    shine: 46,
    sheen: 0.09,
    outline: '#6d7382',
  },
  black: {
    key: 'onyx',
    base: [44, 48, 56],
    sky: 0.16,
    ground: 0.46,
    diffuse: 0.85,
    // The opposite problem: a dark body against a mid-slate board disappears at
    // the edges unless something catches them, so most of the contour is a rim
    // light rather than a shadow.
    edge: 0.2,
    rim: [104, 128, 160],
    rimStrength: 0.62,
    spec: 0.92,
    shine: 58,
    sheen: 0.1,
    outline: '#050608',
  },
};

const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Paints one shaded ball, filling the square edge to edge. */
function shadeBall(ctx, side, body) {
  const image = ctx.createImageData(side, side);
  const data = image.data;
  const half = side / 2;
  const [baseR, baseG, baseB] = body.base;
  const rim = body.rim;
  const fillRange = body.ground - body.sky;

  for (let py = 0; py < side; py++) {
    const dy = (py + 0.5 - half) / half;
    const dy2 = dy * dy;

    for (let px = 0; px < side; px++) {
      const dx = (px + 0.5 - half) / half;
      const d2 = dx * dx + dy2;
      if (d2 >= 1) continue; // ImageData arrives transparent

      // The sphere, from the disc: every pixel of a ball seen head-on is a
      // point on its surface, and the height of that point is all that is
      // missing from the two coordinates already in hand.
      const nz = Math.sqrt(1 - d2);

      const ndl = dx * KEY.x + dy * KEY.y + nz * KEY.z;
      const diffuse = ndl > 0 ? ndl : 0;

      const ndh = dx * HALF.x + dy * HALF.y + nz * HALF.z;
      const spec = ndh > 0 ? Math.pow(ndh, body.shine) : 0;
      // A second, far broader lobe off the same highlight: the sheen a moulded
      // ball has over its whole lit side, which one tight hotspot cannot say.
      const sheen = ndh > 0 ? ndh * ndh * ndh * ndh : 0;

      // How far this bit of surface has turned from the air above towards the
      // board below, straight across from one to the other with nothing in
      // between for the key to fall into.
      const ndu = dx * UP.x + dy * UP.y + nz * UP.z;
      const fill = body.sky + fillRange * (0.5 + 0.5 * ndu);

      // Fresnel: nothing across most of the face, everything in the last few
      // degrees before the surface turns away. It is what the silhouette is
      // made of, on both bodies — brightening one and darkening the other.
      const grazing = 1 - nz;
      const fresnel = grazing * grazing * grazing * grazing * grazing;

      const shade = fill + body.diffuse * diffuse;
      const lift = 255 * body.spec * spec + 255 * body.sheen * sheen;
      const fade = body.edge * fresnel;

      let r = baseR * shade * (1 - fade * EDGE_CHANNEL[0]) + lift;
      let g = baseG * shade * (1 - fade * EDGE_CHANNEL[1]) + lift;
      let b = baseB * shade * (1 - fade * EDGE_CHANNEL[2]) + lift;

      if (rim) {
        const k = body.rimStrength * fresnel;
        r += rim[0] * k;
        g += rim[1] * k;
        b += rim[2] * k;
      }

      const i = (py * side + px) * 4;
      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
      // One pixel of softening at the rim, so the ball has an edge rather than
      // a staircase. `half` pixels span a radius, so that is one pixel wide.
      const cover = (1 - Math.sqrt(d2)) * half;
      data[i + 3] = cover >= 1 ? 255 : Math.round(cover * 255);
    }
  }

  return image;
}

/**
 * The shadow a marble drops on the board.
 *
 * Kept out of the marble itself because it is not part of it: it belongs to
 * whatever the marble is standing on, which is the board and nothing else. The
 * same marble in a player card is a marble in a card, with nothing under it.
 *
 * It reaches barely past the marble on purpose. Neighbouring squares leave a
 * gap of about half a marble's radius between one ball and the next, and a
 * shadow that crossed it would be a shadow cast on another marble — which is
 * true of a real board and quite wrong here, where the light is a fiction and
 * every marble is lit as though it were the only one.
 *
 * `DRIFT` is how far it slides out from under the ball, away from the key
 * light. It is set so that the near side of the shadow lands just about on the
 * ball's own edge: everything on the lit side stays hidden under the marble and
 * only the far side shows, which is a shadow. Concentric, it would be a halo.
 */
const SHADOW_SPREAD = 1.18;
const DRIFT = 0.18;
/** Down and to the right — the key light comes from up and to the left. */
const DRIFT_X = 0.573;
const DRIFT_Y = 0.819;

/**
 * The sprite is a circle centred in its own square, fading to nothing exactly
 * at the inscribed edge, so its corners are empty and it has no edge of its own
 * to show. The offset belongs to where it is *drawn*, not to what is drawn:
 * baked in, it pushed the far side of the gradient off the bitmap, where the
 * canvas cut it off square and left a visible box around every marble.
 */
function shadowSprite(side) {
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  const half = side / 2;

  const grade = ctx.createRadialGradient(half, half, half * 0.4, half, half, half);
  grade.addColorStop(0, 'rgba(10, 14, 20, 0.4)');
  grade.addColorStop(0.55, 'rgba(10, 14, 20, 0.2)');
  grade.addColorStop(1, 'rgba(10, 14, 20, 0)');

  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fillStyle = grade;
  ctx.fill();
  return canvas;
}

/**
 * Two bitmaps per size, plus the shadow. Entries only pile up across resizes,
 * so the cache is dropped rather than evicted.
 */
const bitmaps = new Map();
const BITMAP_LIMIT = 24;

/** The device-pixel scale the context is painting at, or 1 if it cannot say. */
function scaleOf(ctx) {
  const transform = ctx.getTransform?.();
  const scale = transform ? Math.hypot(transform.a, transform.b) : 1;
  return scale > 0 && Number.isFinite(scale) ? scale : 1;
}

function bitmapFor(key, side, build) {
  const id = `${key}|${side}`;
  let bitmap = bitmaps.get(id);
  if (bitmap) return bitmap;
  if (bitmaps.size >= BITMAP_LIMIT) bitmaps.clear();
  bitmap = build(side);
  bitmaps.set(id, bitmap);
  return bitmap;
}

function ballFor(body, side) {
  return bitmapFor(body.key, side, (px) => {
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(shadeBall(ctx, px, body), 0, 0);
    return canvas;
  });
}

/** Whole device pixels, so a blit is a copy rather than a resample. */
const snapped = (v, scale) => Math.round(v * scale) / scale;

function render3DMarble(ctx, x, y, radius, color, isSelected, isHovered, baseLineWidth) {
  const body = color === '#fff' || color === 'white' ? BODIES.white : BODIES.black;
  const scale = scaleOf(ctx);
  const side = Math.min(1024, Math.max(2, Math.round(radius * 2 * scale)));

  let cx = x;
  let cy = y;

  if (typeof document !== 'undefined' && radius > 0) {
    cx = snapped(x - radius, scale) + radius;
    cy = snapped(y - radius, scale) + radius;
    ctx.drawImage(ballFor(body, side), cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  strokeMarbleOutline(ctx, cx, cy, radius, isSelected, isHovered, baseLineWidth, {
    color: body.outline,
    widthFactor: 0.9,
  });
}

export const MARBLE_DESIGNS = {
  default: renderDefaultMarble,
  '3d': render3DMarble,
};

/** Which designs are lit, and so have something to cast a shadow with. */
const LIT = new Set(['3d']);

export function hasDesign(designName) {
  return designName in MARBLE_DESIGNS;
}

export function renderMarble(designName, ctx, x, y, radius, color, isSelected, isHovered, baseLineWidth) {
  const render = MARBLE_DESIGNS[designName] || MARBLE_DESIGNS.default;
  render(ctx, x, y, radius, color, isSelected, isHovered, baseLineWidth);
}

/**
 * Lays down the shadow a marble of this design would cast, at the place it is
 * about to be drawn. Nothing at all for a design with no light in it.
 */
export function renderMarbleShadow(designName, ctx, x, y, radius) {
  if (!LIT.has(designName) || typeof document === 'undefined' || !(radius > 0)) return;
  const scale = scaleOf(ctx);
  const reach = radius * SHADOW_SPREAD;
  const side = Math.min(1024, Math.max(2, Math.round(reach * 2 * scale)));
  const cx = x + radius * DRIFT * DRIFT_X;
  const cy = y + radius * DRIFT * DRIFT_Y;
  ctx.drawImage(bitmapFor('shadow', side, shadowSprite), cx - reach, cy - reach, reach * 2, reach * 2);
}
