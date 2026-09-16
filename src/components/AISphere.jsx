import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ═══════════════════════════════════════════
   NOISE (shared by both shaders)
   ═══════════════════════════════════════════ */
const noiseGLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

/* ═══════════════════════════════════════════
   1. PARTICLE DUST SHELL  (the blue cloud)
   ═══════════════════════════════════════════ */
const dustVertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uState;

  attribute float aRandom;
  attribute float aTheta;
  attribute float aPhi;

  varying float vAlpha;
  varying vec3  vColor;

  ${noiseGLSL}

  void main() {
    float radius = 2.0;
    float time   = uTime * 0.4;

    // state dynamics — more aggressive motion
    float noiseAmp  = 0.20;
    float rotSpeed  = 0.08;
    float expansion = 0.0;

    if (uState < 0.5) {
      noiseAmp = 0.20;
      rotSpeed = 0.08;
    } else if (uState < 1.5) {
      noiseAmp  = 0.25 + uAudioLevel * 0.25;
      rotSpeed  = 0.12;
      expansion = uAudioLevel * 0.15;
    } else if (uState < 2.5) {
      noiseAmp = 0.35;
      rotSpeed = 0.25;
    } else {
      noiseAmp  = 0.22 + uAudioLevel * 0.2;
      rotSpeed  = 0.14;
      expansion = uAudioLevel * 0.12;
    }

    // each particle drifts at its own speed (non-uniform motion)
    float theta = aTheta + time * rotSpeed * (0.3 + aRandom * 0.7);
    float phi   = aPhi   + sin(time * 0.3 + aRandom * 6.28) * 0.02;

    vec3 pos;
    pos.x = radius * sin(phi) * cos(theta);
    pos.y = radius * cos(phi);
    pos.z = radius * sin(phi) * sin(theta);

    // breathing — more pronounced
    pos *= 1.0 + sin(time * 0.8) * 0.04 + expansion;

    // organic noise displacement — large-scale + small-scale
    vec3 n = normalize(pos);
    float noise1 = snoise(pos * 0.7 + time * 1.0);
    float noise2 = snoise(pos * 1.8 - time * 0.5);
    float distort = (noise1 * 0.8 + noise2 * 0.2) * noiseAmp;
    pos += n * distort;

    // ~3% of particles escape slightly off the surface
    if (aRandom > 0.97) {
      pos += n * abs(snoise(vec3(aTheta * 2.0, aPhi * 2.0, time * 0.5))) * 0.35;
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // slightly bigger particles
    gl_PointSize = (1.5 + aRandom * 2.0) * (1.0 / (-mv.z * 0.15));
    gl_PointSize = clamp(gl_PointSize, 1.2, 4.5);

    // neon blue only — no other colours
    vec3 colDeep = vec3(0.02, 0.15, 0.95);
    vec3 colNeon = vec3(0.1, 0.5, 1.0);
    float blend  = smoothstep(-0.3, 0.5, noise1);
    vColor = mix(colDeep, colNeon, blend * 0.55);

    // edge particles glow brighter (rim light effect)
    float rim = 1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0)));
    vColor += vec3(0.05, 0.25, 0.5) * rim * rim;

    float intensity = 1.0;
    if (uState > 0.5 && uState < 1.5) intensity += uAudioLevel * 0.5;
    if (uState > 2.5) intensity += uAudioLevel * 0.4;
    vColor *= intensity;

    vAlpha = 0.5 + aRandom * 0.35;
  }
`;

const dustFragmentShader = `
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

/* ═══════════════════════════════════════════
   2. ACCENT TENDRILS  (the pink/salmon streams)
   ═══════════════════════════════════════════ */
const tendrilVertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uState;

  attribute float aTheta;
  attribute float aPhi;
  attribute float aFiberRandom;
  attribute float aProgress;

  varying float vAlpha;
  varying vec3  vColor;

  ${noiseGLSL}

  void main() {
    float radius = 2.05; // slightly outside the dust shell
    float time   = uTime * 0.4;

    float rotSpeed = 0.06;
    float noiseAmp = 0.15;
    if (uState > 1.5 && uState < 2.5) {
      rotSpeed = 0.2;
      noiseAmp = 0.3;
    }

    // each tendril flows at its own unique pace
    float theta = aTheta + time * rotSpeed * (0.4 + aFiberRandom * 0.6);
    float phi   = aPhi;

    vec3 pos;
    pos.x = radius * sin(phi) * cos(theta);
    pos.y = radius * cos(phi);
    pos.z = radius * sin(phi) * sin(theta);

    // organic surface displacement
    vec3 n = normalize(pos);
    float noise = snoise(pos * 0.6 + time * 0.8);
    pos += n * noise * noiseAmp;

    // breathing sync
    float expansion = 0.0;
    if (uState > 0.5 && uState < 1.5) expansion = uAudioLevel * 0.12;
    if (uState > 2.5) expansion = uAudioLevel * 0.1;
    pos *= 1.0 + sin(time * 0.5) * 0.025 + expansion;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    // colour — warm pink/salmon/peach with some variation
    vec3 colPink   = vec3(0.9, 0.35, 0.45);
    vec3 colPeach  = vec3(0.95, 0.55, 0.35);
    vec3 colCyan   = vec3(0.2, 0.8, 1.0);
    float n2 = snoise(pos * 1.2 - time * 0.3);
    vec3 baseColor = mix(colPink, colPeach, smoothstep(-0.3, 0.5, n2) * 0.6);

    // a few cyan highlight tendrils
    if (aFiberRandom > 0.7) {
      baseColor = mix(baseColor, colCyan, (aFiberRandom - 0.7) * 2.0);
    }

    vColor = baseColor;

    // taper fiber ends
    float fade = smoothstep(0.0, 0.05, aProgress) * smoothstep(1.0, 0.95, aProgress);
    vAlpha = fade * 0.75;
  }
`;

const tendrilFragmentShader = `
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

/* ═══════════════════════════════════════════
   Particle Dust Component
   ═══════════════════════════════════════════ */
function DustShell({ state, audioLevel }) {
  const ref = useRef();
  const uniforms = useRef({
    uTime:       { value: 0 },
    uAudioLevel: { value: 0 },
    uState:      { value: 0 },
  });

  const PARTICLE_COUNT = 30000;
  const stateMap = { idle: 0, listening_guest: 1, thinking: 2, speaking_host: 3 };

  const { positions, randoms, thetas, phis } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms   = new Float32Array(PARTICLE_COUNT);
    const thetas    = new Float32Array(PARTICLE_COUNT);
    const phis      = new Float32Array(PARTICLE_COUNT);
    const golden    = (1 + Math.sqrt(5)) / 2;
    const R = 2.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = 2 * Math.PI * i / golden;
      const phi   = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      positions[i*3]   = R * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = R * Math.cos(phi);
      positions[i*3+2] = R * Math.sin(phi) * Math.sin(theta);
      randoms[i] = Math.random();
      thetas[i]  = theta;
      phis[i]    = phi;
    }
    return { positions, randoms, thetas, phis };
  }, []);

  useFrame((_, dt) => {
    if (!uniforms.current) return;
    uniforms.current.uTime.value += dt;
    uniforms.current.uAudioLevel.value += ((audioLevel||0) - uniforms.current.uAudioLevel.value) * 0.15;
    uniforms.current.uState.value += ((stateMap[state]??0) - uniforms.current.uState.value) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom"  count={PARTICLE_COUNT} array={randoms}   itemSize={1} />
        <bufferAttribute attach="attributes-aTheta"    count={PARTICLE_COUNT} array={thetas}    itemSize={1} />
        <bufferAttribute attach="attributes-aPhi"      count={PARTICLE_COUNT} array={phis}      itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={dustVertexShader}
        fragmentShader={dustFragmentShader}
        uniforms={uniforms.current}
        transparent depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════
   Accent Tendril Component (only 6 streams)
   ═══════════════════════════════════════════ */
function AccentTendrils({ state, audioLevel }) {
  const ref = useRef();
  const uniforms = useRef({
    uTime:       { value: 0 },
    uAudioLevel: { value: 0 },
    uState:      { value: 0 },
  });

  const TENDRIL_COUNT    = 6;
  const POINTS_PER       = 200;
  const SEGS             = POINTS_PER - 1;
  const VERTS_PER        = SEGS * 2;
  const TOTAL            = TENDRIL_COUNT * VERTS_PER;
  const stateMap = { idle: 0, listening_guest: 1, thinking: 2, speaking_host: 3 };

  const geometry = useMemo(() => {
    const pos      = new Float32Array(TOTAL * 3);
    const aTheta   = new Float32Array(TOTAL);
    const aPhi     = new Float32Array(TOTAL);
    const aFibRnd  = new Float32Array(TOTAL);
    const aProg    = new Float32Array(TOTAL);
    const R = 2.05;

    for (let f = 0; f < TENDRIL_COUNT; f++) {
      const fRand = Math.random();
      let theta = Math.random() * Math.PI * 2;
      let phi   = Math.acos(1 - 2 * Math.random());

      const pts = [];
      for (let p = 0; p < POINTS_PER; p++) {
        pts.push({ theta, phi });
        // long, sweeping curves that wrap far around the sphere
        theta += 0.035 + Math.sin(p * 0.04 + fRand * 12.0) * 0.015;
        phi   += Math.sin(p * 0.06 + fRand * 18.0) * 0.025;
        phi    = Math.max(0.15, Math.min(Math.PI - 0.15, phi));
      }

      for (let s = 0; s < SEGS; s++) {
        const b = f * VERTS_PER + s * 2;
        const p1 = pts[s], p2 = pts[s+1];

        aTheta[b]   = p1.theta; aPhi[b]   = p1.phi;
        aTheta[b+1] = p2.theta; aPhi[b+1] = p2.phi;
        aFibRnd[b]  = fRand;    aFibRnd[b+1] = fRand;
        aProg[b]    = s/SEGS;   aProg[b+1]   = (s+1)/SEGS;

        pos[b*3]     = R*Math.sin(p1.phi)*Math.cos(p1.theta);
        pos[b*3+1]   = R*Math.cos(p1.phi);
        pos[b*3+2]   = R*Math.sin(p1.phi)*Math.sin(p1.theta);
        pos[(b+1)*3]   = R*Math.sin(p2.phi)*Math.cos(p2.theta);
        pos[(b+1)*3+1] = R*Math.cos(p2.phi);
        pos[(b+1)*3+2] = R*Math.sin(p2.phi)*Math.sin(p2.theta);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',     new THREE.BufferAttribute(pos,    3));
    geo.setAttribute('aTheta',       new THREE.BufferAttribute(aTheta, 1));
    geo.setAttribute('aPhi',         new THREE.BufferAttribute(aPhi,   1));
    geo.setAttribute('aFiberRandom', new THREE.BufferAttribute(aFibRnd,1));
    geo.setAttribute('aProgress',    new THREE.BufferAttribute(aProg,  1));
    return geo;
  }, []);

  useFrame((_, dt) => {
    if (!uniforms.current) return;
    uniforms.current.uTime.value += dt;
    uniforms.current.uAudioLevel.value += ((audioLevel||0) - uniforms.current.uAudioLevel.value) * 0.15;
    uniforms.current.uState.value += ((stateMap[state]??0) - uniforms.current.uState.value) * 0.05;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <shaderMaterial
        vertexShader={tendrilVertexShader}
        fragmentShader={tendrilFragmentShader}
        uniforms={uniforms.current}
        transparent depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ═══════════════════════════════════════════
   Soft outer glow ring
   ═══════════════════════════════════════════ */
function OuterGlow() {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.06; });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[2.2, 3.0, 64]} />
      <meshBasicMaterial
        color={new THREE.Color(0.04, 0.1, 0.85)}
        transparent opacity={0.05}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════
   Exported Component
   ═══════════════════════════════════════════ */
export function AISphere({ state = 'idle', audioLevel = 0 }) {
  return (
    <div className="sphere-canvas-wrap">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <DustShell state={state} audioLevel={audioLevel} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.3}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
