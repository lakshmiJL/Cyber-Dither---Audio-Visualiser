import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ditherVertexShader, ditherFragmentShader, particleVertexShader, particleFragmentShader } from './shaders';

class CyberDither {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isAudioInitialized = false;
    
    this.startTime = performance.now();
    this.mouse = new THREE.Vector2();
    this.targetMouse = new THREE.Vector2();
    this.mouseVelocity = 0;
    this.lastMousePos = new THREE.Vector2();
    this.manualSpeedMult = 1.0;
    this.isHoldingSpeed = false;
    this.currentTrackIdx = 0;
    this.tracks = [
      'audio/track-pop.wav',
      'audio/track-dance.wav',
      'audio/track-lofi.wav',
      'audio/generated-track.wav'
    ];
    
    this.mouseDustIdx = 0;
    this.mouseDustCount = 500;
    this.mouseDustPositions = [];
    
    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.camera.position.z = 10;

    // Create central object (Smaller base size)
    this.geometry = new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16);
    this.material = new THREE.ShaderMaterial({
      vertexShader: ditherVertexShader,
      fragmentShader: ditherFragmentShader,
      uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 },
        color1: { value: new THREE.Color(0x050508) },
        color2: { value: new THREE.Color(0xff007f) }
      }
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    // Background particles
    this.initParticles();

    // Events
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    
    document.getElementById('start-audio').addEventListener('click', () => this.initAudio());
    document.getElementById('toggle-dither').addEventListener('click', () => this.toggleDither());
    
    // Local File Upload
    const audioInput = document.getElementById('audio-input');
    document.getElementById('upload-audio').addEventListener('click', () => audioInput.click());
    
    audioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const audio = document.getElementById('bg-music');
        audio.src = url;
        audio.load();
        
        // Reset and re-init
        this.isAudioInitialized = false;
        document.getElementById('audio-status').innerText = 'CUSTOM TRACK LOADED';
        this.initAudio();
      }
    });
    
    const holdBtn = document.getElementById('hold-speed');
    const startHold = () => this.isHoldingSpeed = true;
    const endHold = () => this.isHoldingSpeed = false;
    
    // Switch Track
    const switchBtn = document.getElementById('switch-track');
    switchBtn.addEventListener('click', () => {
      this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
      const audio = document.getElementById('bg-music');
      
      // Ensure the path is correct relative to the base
      audio.src = this.tracks[this.currentTrackIdx];
      audio.load();
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Playback failed:", error);
          document.getElementById('audio-status').innerText = 'RETRYING...';
        });
      }
      
      // Visual feedback
      const names = ['CYBER POP', 'ENERGY DANCE', 'LO-FI POP', 'HEAVY INDUSTRIAL'];
      const status = document.getElementById('song-status');
      if (status) {
        status.innerText = names[this.currentTrackIdx];
        status.style.color = '#fff';
        setTimeout(() => status.style.color = 'var(--neon-cyan)', 1000);
      }
    });
    
    holdBtn.addEventListener('mousedown', startHold);
    holdBtn.addEventListener('touchstart', startHold);
    window.addEventListener('mouseup', endHold);
    window.addEventListener('touchend', endHold);

    this.initPostProcessing();
    this.initCursor();
    this.animate();
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, // Strength (Reduced)
      0.3, // Radius
      0.9  // Threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  initMouseDust() {
    const geo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const mat = new THREE.MeshBasicMaterial({ 
      transparent: true, 
      opacity: 0,
      color: 0xffffff 
    });
    this.mouseDustMesh = new THREE.InstancedMesh(geo, mat, this.mouseDustCount);
    this.scene.add(this.mouseDustMesh);
    
    for(let i = 0; i < this.mouseDustCount; i++) {
      this.mouseDustPositions.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0
      });
    }
  }

  spawnMouseDust(x, y) {
    const p = this.mouseDustPositions[this.mouseDustIdx];
    p.active = true;
    p.life = 1.0;
    
    // Convert 2D mouse to 3D (approximate plane)
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    
    p.x = pos.x;
    p.y = pos.y;
    p.z = pos.z;
    
    p.vx = (Math.random() - 0.5) * 0.1;
    p.vy = (Math.random() - 0.5) * 0.1;
    p.vz = (Math.random() - 0.5) * 0.1;
    
    this.mouseDustIdx = (this.mouseDustIdx + 1) % this.mouseDustCount;
  }

  updateMouseDust() {
    const dummy = new THREE.Object3D();
    for(let i = 0; i < this.mouseDustCount; i++) {
      const p = this.mouseDustPositions[i];
      if (p.active) {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.life -= 0.02;
        
        if (p.life <= 0) {
          p.active = false;
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.set(p.life, p.life, p.life);
        }
      } else {
        dummy.scale.set(0, 0, 0);
      }
      dummy.updateMatrix();
      this.mouseDustMesh.setMatrixAt(i, dummy.matrix);
    }
    this.mouseDustMesh.instanceMatrix.needsUpdate = true;
  }
  initParticles() {
    this.particleCount = 2500;
    this.particleGroups = [];
    
    const particleGeo = new THREE.CylinderGeometry(0.008, 0.001, 0.3, 4);
    particleGeo.rotateX(Math.PI / 2); // Orient along Z axis
    particleGeo.rotateZ(Math.PI / 4); // Rotate 45 deg to make it a square instead of a diamond
    
    const colors = [
      new THREE.Color(0xff007f), // Neon Pink
      new THREE.Color(0x00f2ff), // Cyber Cyan
      new THREE.Color(0xbc13fe), // Electric Violet
      new THREE.Color(0xfff000)  // Laser Yellow
    ];

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide
    });

    // Custom shader injection for the neon-head/white-tail effect
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `varying float vRelativePos;
         varying float vRandom;
         attribute float aRandom;
         void main() {
           vRandom = aRandom;`
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vRelativePos = (position.z + 0.15) / 0.3;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying float vRelativePos;
         varying float vRandom;
         uniform float time;
         void main() {`
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 headColor = diffuseColor.rgb;
         vec3 tailColor = vec3(0.5, 0.5, 0.6); // Even darker tail
         
         // Twinkle effect (Star Dust)
         float twinkle = 0.8 + 0.2 * sin(time * 8.0 + vRandom * 6.28);
         // Head pulse (Glow fade)
         float headPulse = 0.5 + 0.5 * sin(time * 6.0 + vRandom * 10.0);
         
         diffuseColor.rgb = mix(tailColor, headColor, pow(vRelativePos, 1.2));
         // Glow specifically pulses on the head (vRelativePos near 1.0)
         diffuseColor.rgb += headColor * pow(vRelativePos, 4.0) * 0.4 * headPulse; 
         diffuseColor.rgb *= twinkle;`
      );
    };
    
    const mesh = new THREE.InstancedMesh(particleGeo, material, this.particleCount);
    
    // Add a random attribute for twinkling
    const randomAttrib = new THREE.InstancedBufferAttribute(new Float32Array(this.particleCount), 1);
    for(let i = 0; i < this.particleCount; i++) randomAttrib.setX(i, Math.random());
    mesh.geometry.setAttribute('aRandom', randomAttrib);

    const dummy = new THREE.Object3D();
    const positions = [];
    
    for(let i = 0; i < this.particleCount; i++) {
      const x = (Math.random() - 0.5) * 80;
      const y = (Math.random() - 0.5) * 80;
      // Uniformly distribute Z across the entire path [-40, 10]
      const z = Math.random() * 50 - 40;
      
      const s = 0.5 + Math.random() * 1.5; // Varied initial scale
      dummy.position.set(x, y, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      mesh.setColorAt(i, color);
      
      positions.push({ 
        x, y, z, 
        s,
        roll: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        speedVar: 0.8 + Math.random() * 0.4 // 80% to 120% speed variation
      });
    }
    
    this.scene.add(mesh);
    mesh.frustumCulled = false; // Ensure they are always rendered
    
    this.particleGroups = [{ mesh, positions, count: this.particleCount }];
    this.initMouseDust();

    // Add some lights so shapes are visible
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(1, 1, 1);
    this.scene.add(light1);
    const light2 = new THREE.AmbientLight(0x404040);
    this.scene.add(light2);
  }

  initAudio() {
    if (this.isAudioInitialized) return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const audio = document.getElementById('bg-music');
    const statusEl = document.getElementById('audio-status');
    const btnEl = document.getElementById('start-audio');
    
    statusEl.innerText = 'LOADING...';
    
    audio.play().then(() => {
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        const source = this.audioContext.createMediaElementSource(audio);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
      
      this.isAudioInitialized = true;
      statusEl.innerText = 'SONG ACTIVE';
      statusEl.style.color = '#00f2ff';
      btnEl.innerText = 'SYNCED';
      this.createVizBars();
    }).catch(err => {
      console.error("Audio Play Error:", err);
      statusEl.innerText = 'PLAY ERROR';
      statusEl.style.color = '#ff007f';
      btnEl.innerText = 'RETRY PLAY';
    });
  }

  createVizBars() {
    const container = document.getElementById('audio-viz');
    container.innerHTML = '';
    for(let i = 0; i < 64; i++) {
      const bar = document.createElement('div');
      bar.className = 'viz-bar';
      container.appendChild(bar);
    }
  }

  toggleDither() {
    const isPink = this.material.uniforms.color2.value.getHex() === 0xff007f;
    gsap.to(this.material.uniforms.color2.value, {
      r: isPink ? 0 : 1,
      g: isPink ? 0.95 : 0,
      b: isPink ? 1 : 0.5,
      duration: 1
    });
  }

  onMouseMove(e) {
    this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    // Spawns tail-less star-dust particles on swipe
    this.spawnMouseDust(this.targetMouse.x, this.targetMouse.y);

    // Update HUD tilt & cursor visuals
    const tiltX = this.targetMouse.y * 10;
    const tiltY = -this.targetMouse.x * 10;
    gsap.to('.header, .status-panel, .controls', { rotationX: tiltX, rotationY: tiltY, duration: 0.5 });
    gsap.to('.cursor', { x: e.clientX, y: e.clientY, duration: 0.1 });
    gsap.to('.cursor-dot', { x: e.clientX, y: e.clientY, duration: 0.01 });
  }

  initCursor() {
    // Already handled in onMouseMove and CSS
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  updateAudio(time) {
    let avg = 0;
    
    if (this.isAudioInitialized) {
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Get average frequency
      let sum = 0;
      for(let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
        
        // Update viz bars
        if (i < 64) {
          const bars = document.querySelectorAll('.viz-bar');
          if (bars[i]) {
            bars[i].style.height = (this.dataArray[i] / 255 * 100) + 'px';
            bars[i].style.backgroundColor = `hsl(${280 + (this.dataArray[i]/255 * 80)}, 100%, 50%)`;
          }
        }
      }
      avg = sum / this.dataArray.length;
    }

    this.updateDynamics(time, avg);
  }

  updateDynamics(time, avg) {
    // Manual Speed Logic (Smoother/Slower Transitions)
    if (this.isHoldingSpeed) {
      this.manualSpeedMult = THREE.MathUtils.lerp(this.manualSpeedMult, 20.0, 0.015);
    } else {
      this.manualSpeedMult = THREE.MathUtils.lerp(this.manualSpeedMult, 1.0, 0.025);
    }

    // Sync Audio Playback Rate (Optional but feels cool)
    const audio = document.getElementById('bg-music');
    if (audio && this.isAudioInitialized) {
      audio.playbackRate = 1.0 + (this.manualSpeedMult - 1.0) * 0.05;
    }
    
    document.getElementById('speed-mult').innerText = this.manualSpeedMult.toFixed(2) + 'x';
    const glitchWarning = document.getElementById('glitch-warning');
    if (this.manualSpeedMult > 8.0) {
      glitchWarning.classList.remove('hidden');
    } else {
      glitchWarning.classList.add('hidden');
    }

    // Reactivity (Toned down)
    const scale = (1 + (avg / 255) * 0.8) * (1 + (this.manualSpeedMult - 1) * 0.05);
    this.mesh.scale.set(scale, scale, scale);
    this.material.uniforms.intensity.value = 0.5 + (avg / 255) * 2.0 + (this.manualSpeedMult - 1) * 0.5;
    
    // Animate individual particle positions for "traveling" feel
    const speed = (0.1 + (avg / 255) * 1.2) * this.manualSpeedMult; 
    const dummy = new THREE.Object3D();

    this.particleGroups.forEach(group => {
      for(let i = 0; i < group.count; i++) {
        const p = group.positions[i];
        const pSpeed = speed * p.speedVar;
        p.z += pSpeed;
        
        const rot = 0.02 + (avg / 255) * 0.2 + (this.manualSpeedMult - 1) * 0.05;
        
        if (p.z > 10) {
          p.z = -40;
          p.x = (Math.random() - 0.5) * 80;
          p.y = (Math.random() - 0.5) * 80;
        }
        
        // Drift Effect
        p.driftPhase += 0.02;
        const driftX = Math.sin(p.driftPhase) * 0.05;
        const driftY = Math.cos(p.driftPhase * 0.8) * 0.05;
        
        dummy.position.set(p.x + driftX, p.y + driftY, p.z);
        
        // TAIL EFFECT: Scale on Z axis based on speed
        const tailLength = p.s * (1 + speed * 8); 
        dummy.scale.set(p.s, p.s, tailLength);
        
        // Keep them oriented forward (Z), but add some roll for dynamism
        p.roll += 0.02 + (avg / 255) * 0.1;
        dummy.rotation.set(0, 0, p.roll); 
        
        dummy.updateMatrix();
        group.mesh.setMatrixAt(i, dummy.matrix);
      }
      group.mesh.instanceMatrix.needsUpdate = true;
    });

    // Dynamic Bloom based on speed
    if (this.bloomPass) {
      this.bloomPass.strength = 1.0 + (avg / 255) * 1.5 + (this.manualSpeedMult - 1) * 0.2;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const time = (performance.now() - this.startTime) / 1000;
    this.material.uniforms.time.value = time;
    
    this.updateAudio(time);
    
    // Smooth camera movement
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;
    
    this.camera.position.x = this.mouse.x * 2;
    this.camera.position.y = this.mouse.y * 2;
    this.camera.lookAt(0, 0, 0);
    
    this.mesh.rotation.x += 0.005;
    this.mesh.rotation.y += 0.01;
    
    this.updateMouseDust();
    this.composer.render();
    
    // Update Timestamp
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time * 1000) % 1000);
    document.getElementById('timestamp').innerText = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    
    // Update FPS (Dynamic based on speed)
    const baseFps = 60 + Math.random() * 2;
    const boostFps = (this.manualSpeedMult - 1.0) * 8;
    document.getElementById('fps-counter').innerText = Math.round(baseFps + boostFps);
  }
}

new CyberDither();
