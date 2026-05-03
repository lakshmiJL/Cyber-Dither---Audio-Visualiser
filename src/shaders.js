export const ditherVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ditherFragmentShader = `
  uniform float time;
  uniform float intensity;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Efficient Bayer 4x4 for stability
  float bayer4(vec2 uv) {
    vec2 p = floor(mod(uv, 4.0));
    int x = int(p.x);
    int y = int(p.y);
    int index = y * 4 + x;
    
    if (index == 0) return 0.0; if (index == 1) return 0.5;
    if (index == 2) return 0.125; if (index == 3) return 0.625;
    if (index == 4) return 0.75; if (index == 5) return 0.25;
    if (index == 6) return 0.875; if (index == 7) return 0.375;
    if (index == 8) return 0.1875; if (index == 9) return 0.6875;
    if (index == 10) return 0.0625; if (index == 11) return 0.5625;
    if (index == 12) return 0.9375; if (index == 13) return 0.4375;
    if (index == 14) return 0.8125; if (index == 15) return 0.3125;
    return 0.0;
  }

  void main() {
    float light = dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))) * 0.5 + 0.5;
    light += sin(time * 2.0) * 0.1; // Pulsing light
    
    // Scale for dither pattern
    vec2 ditherCoord = gl_FragCoord.xy / 2.0;
    float threshold = bayer4(ditherCoord);
    
    float ramp = light * intensity;
    float dither = ramp > threshold ? 1.0 : 0.0;
    
    vec3 finalColor = mix(color1, color2, dither);
    
    // Add some noise and scanline effect
    float scanline = sin(gl_FragCoord.y * 0.5) * 0.1;
    finalColor -= scanline;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const particleVertexShader = `
  varying vec2 vUv;
  varying float vRelativePos;
  attribute vec3 instanceColor;
  attribute mat4 instanceMatrix;
  varying vec3 vInstanceColor;

  void main() {
    vUv = uv;
    // After rotateX(PI/2), the original height (Y) is now on the Z axis
    // height was 1.0, so Z ranges from -0.5 to 0.5
    vRelativePos = (position.z + 0.5);
    vInstanceColor = instanceColor;
    
    // Apply instance matrix
    vec4 mvPosition = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
  }
`;

export const particleFragmentShader = `
  varying vec2 vUv;
  varying float vRelativePos;
  varying vec3 vInstanceColor;

  void main() {
    // Front/Head (vRelativePos near 1.0) is neon color
    // Back/Tail (vRelativePos near 0.0) is white/faded
    
    vec3 headColor = vInstanceColor;
    vec3 tailColor = vec3(0.9, 0.9, 1.0); // Slightly blue-white tail
    
    // Smoothly blend (using a sharper curve for the tail)
    float mixFactor = pow(vRelativePos, 1.2);
    vec3 finalColor = mix(tailColor, headColor, mixFactor);
    
    // Add a glowing core to the head
    float glow = pow(vRelativePos, 4.0);
    finalColor += headColor * glow * 0.8;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
