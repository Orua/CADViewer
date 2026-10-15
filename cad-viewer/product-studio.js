// Keep this portable lighting source identical in CadViewer and WebCAD.
// Camera-space product lighting: side softbox, opposite rim, dark lower flag.
export const PRODUCT_STUDIO = Object.freeze({azimuth:-65,elevation:25,key:1.3,fill:0.45,ambient:0.4});
export const PRODUCT_STUDIO_SHADER = /* glsl */`
float productSoftbox(vec3 ray,vec3 center,float width,float height,float blur){
  center=normalize(center);
  vec3 across=normalize(cross(vec3(0.0,1.0,0.0),center));
  vec3 up=cross(center,across);
  float facing=dot(ray,center);
  vec2 p=vec2(dot(ray,across),dot(ray,up))/max(facing,0.01);
  return (1.0-smoothstep(width,width+blur,abs(p.x)))
       *(1.0-smoothstep(height,height+blur,abs(p.y)))
       *smoothstep(0.05,0.2,facing);
}
vec3 productStudioRadiance(vec3 ray,float roughness,vec3 keyDirection,vec3 levels){
  float blur=0.04+roughness*roughness*1.8;
  float key=productSoftbox(ray,keyDirection,0.65,0.85,blur);
  float rim=productSoftbox(ray,vec3(0.88,0.14,-0.30),0.10,0.95,blur);
  float flag=productSoftbox(ray,vec3(0.15,-0.62,0.77),0.38,0.20,0.12+blur);
  float room=mix(0.10,0.28,smoothstep(-0.8,0.9,ray.y));
  vec3 light=vec3(room)*levels.z*(1.0-0.72*flag);
  // Broader rough reflections carry the same finite source energy.
  light+=vec3(1.0,0.98,0.94)*key*4.0*levels.x/(1.0+blur*2.0);
  light+=vec3(0.92,0.96,1.0)*rim*2.4*levels.y/(1.0+blur*2.0);
  return light;
}
vec3 productStudioSpecular(vec3 normal,vec3 viewDirection,vec3 f0,float roughness,vec3 keyDirection,vec3 levels,vec3 surfacePoint){
  float nv=max(dot(normal,viewDirection),0.001);
  vec3 ray=reflect(-viewDirection,normal);
  // A finite studio, rather than an infinitely distant sky: reflection cards
  // move across a flat face as its position or the view changes.
  float projected=dot(surfacePoint,ray);
  float distanceToRoom=-projected+sqrt(max(projected*projected+2.25-dot(surfacePoint,surfacePoint),0.01));
  ray=normalize(surfacePoint+ray*distanceToRoom);
  // Split-sum environment BRDF fit used by the common metallic-roughness model.
  vec4 r=roughness*vec4(-1.0,-0.0275,-0.572,0.022)+vec4(1.0,0.0425,1.04,-0.04);
  float a004=min(r.x*r.x,exp2(-9.28*nv))*r.x+r.y;
  vec2 fab=vec2(-1.04,1.04)*a004+r.zw;
  return productStudioRadiance(ray,roughness,keyDirection,levels)*(f0*fab.x+fab.y);
}
`;
