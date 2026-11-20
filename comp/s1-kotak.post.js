// s1-kotak post pipeline: MSAA half-float scene -> depth pass -> soft blur (fake DOF) + bloom -> filmic composite.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

export function makePost(renderer, W, H) {
  const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const RT = (w, h, extra = {}) => new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), { ...hf, ...extra });
  const rtS = RT(W, H, { depthBuffer: true, samples: 4 });
  const rtDepth = RT(W / 2, H / 2, { depthBuffer: true });
  const rtRefl = RT(W / 2, H / 2, { depthBuffer: true });
  const rtH = RT(W / 2, H / 2), rtB1 = RT(W / 2, H / 2), rtB2 = RT(W / 2, H / 2);
  const rtQ = RT(W / 4, H / 4), rtQ1 = RT(W / 4, H / 4), rtQ2 = RT(W / 4, H / 4);

  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const SM = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }

  const copyMat = SM('uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', { t: { value: null } });
  const blurMat = SM(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * 0.2270270270;
      c += (texture2D(t, vUv + dir * 1.3846153846).rgb + texture2D(t, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(t, vUv + dir * 3.2307692308).rgb + texture2D(t, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
  const brightMat = SM(`uniform sampler2D t; uniform float thr; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * (max(l - thr, 0.) / max(l, 1e-4)), 1.); }`, { t: { value: null }, thr: { value: 0.85 } });
  const compMat = SM(`uniform sampler2D tS, tSoft, tBloom, tD; uniform float focus, range, maxCoc, bloomK, expo, vig, time; uniform vec3 tint;
    varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float d = texture2D(tD, uv).r * 60.;
      float coc = smoothstep(range * 0.55, range * 2.1, abs(d - focus)) * maxCoc;
      vec2 c = uv - .5; vec2 off = c * (0.0016 + 0.008 * dot(c, c));
      vec3 sharp = vec3(texture2D(tS, uv + off).r, texture2D(tS, uv).g, texture2D(tS, uv - off).b);
      vec3 soft = texture2D(tSoft, uv).rgb;
      vec3 col = mix(sharp, soft, coc);
      col += texture2D(tBloom, uv).rgb * bloomK;
      col *= expo;
      col = aces(col);
      col = mix(col, col * tint, 0.5);
      float v = smoothstep(0.95, 0.25, length(c * vec2(1.05, 0.72)));
      col *= mix(1. - vig, 1., v);
      col += (hash(uv * vec2(1080., 1920.) + time) - .5) * 0.018;
      gl_FragColor = vec4(col, 1.);
      #include <colorspace_fragment>
    }`, { tS: { value: null }, tSoft: { value: null }, tBloom: { value: null }, tD: { value: null }, focus: { value: 9 }, range: { value: 3 }, maxCoc: { value: 0.8 }, bloomK: { value: 0.6 }, expo: { value: 1 }, vig: { value: 0.5 }, time: { value: 0 }, tint: { value: new THREE.Color(1.0, 0.96, 1.06) } });

  const depthMat = new THREE.ShaderMaterial({
    vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vD; void main(){ gl_FragColor = vec4(vD / 60., 0., 0., 1.); }', side: THREE.DoubleSide,
  });

  return {
    rtRefl,
    /** renders scene to rtS (+depth + blur + bloom) and composites to the canvas */
    finish(scene, cam, o) {
      renderer.setRenderTarget(rtS); renderer.clear(); renderer.render(scene, cam);
      // depth
      const bg = scene.background, fog = scene.fog;
      o.hideForDepth.forEach((m) => { m.__v = m.visible; m.visible = false; });
      scene.background = null; scene.fog = null; scene.overrideMaterial = depthMat;
      renderer.setClearColor(0xffffff, 1);
      renderer.setRenderTarget(rtDepth); renderer.clear(); renderer.render(scene, cam);
      scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
      o.hideForDepth.forEach((m) => { m.visible = m.__v; });
      // soft copy (fake defocus) and bloom
      copyMat.uniforms.t.value = rtS.texture; pass(copyMat, rtH);
      blurMat.uniforms.t.value = rtH.texture; blurMat.uniforms.dir.value.set(1.6 / (W / 2), 0); pass(blurMat, rtB1);
      blurMat.uniforms.t.value = rtB1.texture; blurMat.uniforms.dir.value.set(0, 1.6 / (H / 2)); pass(blurMat, rtB2);
      blurMat.uniforms.t.value = rtB2.texture; blurMat.uniforms.dir.value.set(2.6 / (W / 2), 0); pass(blurMat, rtB1);
      blurMat.uniforms.t.value = rtB1.texture; blurMat.uniforms.dir.value.set(0, 2.6 / (H / 2)); pass(blurMat, rtB2);
      brightMat.uniforms.t.value = rtH.texture; brightMat.uniforms.thr.value = o.bloomThr ?? 0.85; pass(brightMat, rtQ);
      for (let i = 0; i < 2; i++) {
        const s = 1.4 + i * 1.8;
        blurMat.uniforms.t.value = i ? rtQ2.texture : rtQ.texture; blurMat.uniforms.dir.value.set(s / (W / 4), 0); pass(blurMat, rtQ1);
        blurMat.uniforms.t.value = rtQ1.texture; blurMat.uniforms.dir.value.set(0, s / (H / 4)); pass(blurMat, rtQ2);
      }
      const u = compMat.uniforms;
      u.tS.value = rtS.texture; u.tSoft.value = rtB2.texture; u.tBloom.value = rtQ2.texture; u.tD.value = rtDepth.texture;
      u.focus.value = o.focus; u.range.value = o.range; u.maxCoc.value = o.maxCoc; u.bloomK.value = o.bloomK ?? 0.6; u.expo.value = o.expo ?? 1; u.vig.value = o.vig ?? 0.5; u.time.value = 0.37;
      renderer.setClearColor(0x000000, 1);
      pass(compMat, null);
    },
  };
}
