import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uState; // 0=idle, 1=listening, 2=thinking, 3=speaking
  
  attribute float aRandom;
  attribute float aTheta;
  attribute float aPhi;
  attribute float aSize;
  
  varying float vAlpha;
  varying vec3 vColor;
  
  // Simplex noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
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
    vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    float radius = 2.0;
    
    float breathSpeed = 0.5;
    float noiseScale = 0.8;
    float noiseAmp = 0.2;
    float rotSpeed = 0.05;
    float expansion = 0.0;
    
    if (uState < 0.5) {
      // Idle
      breathSpeed = 0.3;
      noiseAmp = 0.15;
    } else if (uState < 1.5) {
      // Listening
      breathSpeed = 0.8;
      noiseAmp = 0.25 + uAudioLevel * 0.3;
      expansion = uAudioLevel * 0.2;
    } else if (uState < 2.5) {
      // Thinking
      breathSpeed = 1.5;
      noiseAmp = 0.4;
      noiseScale = 1.5;
      rotSpeed = 0.2;
    } else {
      // Speaking
      breathSpeed = 1.0;
      noiseAmp = 0.2 + uAudioLevel * 0.2;
      expansion = uAudioLevel * 0.15;
    }
    
    float time = uTime * 0.5;
    
    // Base position on sphere
    float theta = aTheta + time * rotSpeed * (0.5 + aRandom);
    float phi = aPhi + time * rotSpeed * 0.2 * (aRandom - 0.5);
    
    vec3 pos;
    pos.x = radius * sin(phi) * cos(theta);
    pos.y = radius * cos(phi);
    pos.z = radius * sin(phi) * sin(theta);
    
    // Breathing
    float breath = sin(time * breathSpeed) * 0.05;
    pos *= (1.0 + breath + expansion);
    
    // Surface distortion
    vec3 normal = normalize(pos);
    float noiseVal = snoise(pos * noiseScale + time);
    
    // Create wave bands (like the reference image)
    float wave = sin(pos.y * 5.0 + time * 2.0) * cos(pos.x * 4.0 - time);
    float distortion = (noiseVal + wave * 0.3) * noiseAmp;
    
    pos += normal * distortion;
    
    // Inner core streams (thinking state)
    if (uState > 1.5 && uState < 2.5 && aRandom > 0.8) {
       pos *= 0.7 + noiseVal * 0.4; 
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    
    // Colors mimicking the reference image
    vec3 colorBlue = vec3(0.04, 0.27, 1.0);  // Deep electric blue
    vec3 colorCyan = vec3(0.0, 0.9, 1.0);    // Bright cyan
    vec3 colorPurple = vec3(0.6, 0.2, 1.0);  // Violet/Purple
    
    float mixVal = smoothstep(-0.5, 0.5, noiseVal + wave * 0.5);
    vec3 baseColor = mix(colorBlue, colorCyan, mixVal * 0.6);
    
    // Add purple accents to some particles
    if (aRandom > 0.7) {
      baseColor = mix(baseColor, colorPurple, (aRandom - 0.7) * 3.3);
    }
    
    // Intensity based on state and audio
    float intensity = 1.0;
    if (uState > 0.5 && uState < 1.5) intensity += uAudioLevel * 0.8;
    if (uState > 2.5) intensity += uAudioLevel * 0.5;
    
    vColor = baseColor * intensity;
    
    // Transparency
    vAlpha = 0.4 + aRandom * 0.4;
    if (uState > 1.5 && uState < 2.5) vAlpha += 0.2; // Thinking is brighter
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Soft particle dot
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function ParticleSystem({ state, audioLevel }) {
  const meshRef = useRef();
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uAudioLevel: { value: 0 },
    uState: { value: 0 },
  });

  // Increased particle count for the dense dust look
  const PARTICLE_COUNT = 30000;

  const { positions, randoms, thetas, phis, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const thetas = new Float32Array(PARTICLE_COUNT);
    const phis = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      
      const r = 2.0;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      randoms[i] = Math.random();
      thetas[i] = theta;
      phis[i] = phi;
      
      // Variable particle sizes, some tiny, some slightly larger
      sizes[i] = Math.random() < 0.9 ? Math.random() * 1.5 + 0.5 : Math.random() * 3.0 + 1.0;
    }

    return { positions, randoms, thetas, phis, sizes };
  }, []);

  const stateMap = { idle: 0, listening_guest: 1, thinking: 2, speaking_host: 3 };

  useFrame((_, delta) => {
    if (!uniformsRef.current) return;
    uniformsRef.current.uTime.value += delta;

    const targetAudio = audioLevel || 0;
    const targetState = stateMap[state] ?? 0;
    uniformsRef.current.uAudioLevel.value += (targetAudio - uniformsRef.current.uAudioLevel.value) * 0.15;
    uniformsRef.current.uState.value += (targetState - uniformsRef.current.uState.value) * 0.05;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={PARTICLE_COUNT} array={randoms} itemSize={1} />
        <bufferAttribute attach="attributes-aTheta" count={PARTICLE_COUNT} array={thetas} itemSize={1} />
        <bufferAttribute attach="attributes-aPhi" count={PARTICLE_COUNT} array={phis} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" count={PARTICLE_COUNT} array={sizes} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Removed the solid AmbientGlow sphere so it looks more like the hollow reference image.
export function AISphere({ state = 'idle', audioLevel = 0 }) {
  return (
    <div className="sphere-canvas-wrap">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ParticleSystem state={state} audioLevel={audioLevel} />
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
