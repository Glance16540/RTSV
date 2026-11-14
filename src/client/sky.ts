// The sky over the battlefield: a dome that runs from the mist at the horizon up to blue or to the dark, with
// the sun or the moon standing in it where the light comes from, and stars by night.
// The game's own camera looks down at the ground and never sees it. It is there for any view that takes in the
// horizon: the main menu's camera over the town, and a lowered camera (`?pitch=`).

import * as THREE from 'three';

const R = 330; // within the camera's far plane
const quiet = (m: THREE.Material): void => { m.userData.outlineParameters = { visible: false }; }; // the ink outline is not for the sky

export interface SkyState {
  /** The colour of the mist at the horizon, which the dome starts from. */
  horizon: THREE.Color;
  /** Which way the sun lies over the ground (x, z), and how high it has climbed, 0 at dawn and dusk to 1 at midday. */
  sunX: number; sunZ: number; up: number;
  /** Which way the moon lies. */
  moonX: number; moonZ: number;
  /** 0 by day to 1 in full night; how red the low sun is; how much weather is overhead. */
  night: number; warm: number; weather: number;
  sunColor: THREE.Color;
}

export class Sky {
  readonly group = new THREE.Group();
  private dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private sun: THREE.Sprite;
  private halo: THREE.Sprite;
  private moon: THREE.Sprite;
  private dayTop = new THREE.Color(0x3f78c4);
  private nightTop = new THREE.Color(0x05081a);
  private stormTop = new THREE.Color(0x5b6470);
  private v = new THREE.Vector3();

  constructor(glow: THREE.Texture) {
    // The upper half of a sphere and a little below it, so that no gap shows under a horizon seen from a height.
    const geo = new THREE.SphereGeometry(R, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.58);
    this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { horizon: { value: new THREE.Color() }, top: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunGlow: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 d; void main() { d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 horizon; uniform vec3 top; uniform vec3 sunDir; uniform vec3 sunGlow; varying vec3 d;
        void main() {
          vec3 n = normalize(d);
          float h = pow(clamp(n.y, 0.0, 1.0), 0.55);
          // The sky is brightest and warmest round the sun, most of all near the horizon.
          // It fades out again right at the horizon, where the sky has to meet the mist the far ground is lost in.
          float near = pow(max(dot(n, sunDir), 0.0), 6.0) * (1.0 - h * 0.6) * smoothstep(0.0, 0.09, n.y);
          gl_FragColor = vec4(mix(horizon, top, h) + sunGlow * near, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    }));
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    quiet(this.dome.material);

    // Stars: scattered over the dome by a fixed rule, so the same sky comes up every night.
    const n = 650, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let s = 9173;
    const r = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) {
      const y = 0.04 + r() * 0.96, a = r() * Math.PI * 2, f = Math.sqrt(1 - y * y), b = 0.6 + r() * r() * 0.4, t = r();
      pos.set([Math.cos(a) * f * R * 0.98, y * R * 0.98, Math.sin(a) * f * R * 0.98], i * 3);
      col.set([b * (t > 0.8 ? 1 : 0.86), b * 0.9, b * (t < 0.2 ? 0.8 : 1)], i * 3); // a few warm, a few blue
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    quiet(this.stars.material);

    const body = (map: THREE.Texture, size: number, additive: boolean): THREE.Sprite => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      sp.scale.setScalar(size);
      sp.renderOrder = -8;
      quiet(sp.material);
      return sp;
    };
    this.halo = body(glow, 150, true);
    this.sun = body(disc('#fff6dc', '#ffe9a8', false), 20, false);
    this.moon = body(disc('#eef1f6', '#c9d0dc', true), 15, false);
    this.group.add(this.dome, this.stars, this.halo, this.sun, this.moon);
  }

  /** Set the sky for this moment and carry it with the camera, so that it is always as far off as the horizon. */
  update(cam: THREE.Camera, st: SkyState): void {
    this.group.position.copy(cam.position);
    const day = 1 - st.night, clear = 1 - st.weather;
    const u = this.dome.material.uniforms;
    (u.horizon.value as THREE.Color).copy(st.horizon);
    (u.top.value as THREE.Color).copy(this.dayTop).lerp(this.nightTop, st.night).lerp(this.stormTop, st.weather * 0.7 * day);
    // The sun stands lower in the picture than the light falls from: a sun at the horizon would cast no shadows worth having.
    const el = (4.5 + 50 * st.up) * (Math.PI / 180), k = 1 / Math.hypot(st.sunX, st.sunZ);
    const sd = this.v.set(st.sunX * k * Math.cos(el), Math.sin(el), st.sunZ * k * Math.cos(el));
    (u.sunDir.value as THREE.Vector3).copy(sd);
    (u.sunGlow.value as THREE.Color).copy(st.sunColor).multiplyScalar((0.25 + 0.75 * st.warm) * day * clear * 0.9);
    this.sun.position.copy(sd).multiplyScalar(R * 0.95);
    this.halo.position.copy(this.sun.position);
    // The disc itself is always bright: gold when it is low, near white when it is high.
    this.sun.material.color.copy(LOW_SUN).lerp(WHITE, 1 - st.warm);
    this.sun.material.opacity = day * (0.25 + 0.75 * clear);
    this.halo.material.color.copy(LOW_SUN).lerp(st.sunColor, 0.5);
    this.halo.material.opacity = day * clear * (0.5 + 0.35 * st.warm);
    const mk = 1 / Math.hypot(st.moonX, st.moonZ), me = 24 * (Math.PI / 180);
    this.moon.position.set(st.moonX * mk * Math.cos(me), Math.sin(me), st.moonZ * mk * Math.cos(me)).multiplyScalar(R * 0.95);
    this.moon.material.opacity = st.night * (0.2 + 0.8 * clear);
    this.stars.material.opacity = st.night * clear * 0.95;
    this.stars.visible = st.night > 0.02;
    this.moon.visible = st.night > 0.02;
    this.sun.visible = this.halo.visible = day > 0.02;
  }
}

const WHITE = new THREE.Color(0xffffff);
const LOW_SUN = new THREE.Color(0xffd27a);

/** The face of the sun or the moon: a soft-edged disc, the moon with its grey seas. */
function disc(core: string, rim: string, seas: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, core); g.addColorStop(0.62, rim); g.addColorStop(0.7, rim + 'cc'); g.addColorStop(0.78, rim + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  if (seas) {
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(120, 132, 156, 0.4)';
    for (const [px, py, pr] of [[50, 46, 13], [72, 58, 10], [56, 76, 8], [80, 40, 6], [42, 66, 5]]) { x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
