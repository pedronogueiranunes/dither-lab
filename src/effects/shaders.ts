import { bayer } from "./bayer";
export const vertex = `#version 300 es
out vec2 v_uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`;
export const header = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
`;
export const source =
  header +
  `
uniform int u_source; uniform float u_aspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
float fbm(vec2 p){float n=0.0,a=0.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+13.1;a*=0.5;}return n;}
void main(){vec2 uv=v_uv;vec2 p=(uv-.5)*vec2(u_resolution.x/u_resolution.y,1);
if(u_source==0){vec2 fit=uv-.5;float target=u_resolution.x/u_resolution.y;fit*=target>u_aspect?vec2(target/u_aspect,1):vec2(1,u_aspect/target);fit+=.5;outColor=vec4(texture(u_tex,clamp(fit,0.0,1.0)).rgb,1);if(any(lessThan(fit,vec2(0)))||any(greaterThan(fit,vec2(1))))outColor=vec4(0,0,0,1);return;}
vec3 c;
if(u_source==1)c=vec3(uv.x,uv.y,.5+.5*sin(u_time));
else if(u_source==2){float n=fbm(p*5.0+u_time*.15);c=vec3(n);}
else if(u_source==3){float d=length(p-vec2(sin(u_time*.7),cos(u_time*.5))*.15);float sphere=sqrt(max(0.0,1.0-pow(d/.35,2.0)));float plane=.12+.25*uv.y;c=vec3(d<.35?sphere:plane);c*=vec3(.9,1,.85);}
else{float f=sin(p.x*7.0+u_time)+cos(p.y*8.0-u_time*.7)+sin(length(p)*14.0-u_time);c=.5+.5*cos(f+vec3(0,2,4));}outColor=vec4(c,1);}`;
export const preprocess =
  header +
  `
uniform float u_brightness,u_contrast,u_gamma,u_pixel;
void main(){vec2 uv=(floor(v_uv*u_resolution/u_pixel)+.5)*u_pixel/u_resolution;vec3 c=texture(u_tex,uv).rgb;c=(c-.5)*u_contrast+.5+u_brightness;c=pow(clamp(c,0.0,1.0),vec3(1.0/u_gamma));outColor=vec4(c,1);}`;
export const dither =
  header +
  `
uniform sampler2D u_noise;uniform int u_algorithm,u_levels,u_mono,u_shape;uniform float u_strength,u_scale,u_angle,u_cell;
${bayer.frag}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec3 c=texture(u_tex,v_uv).rgb;float lum=dot(c,vec3(.2126,.7152,.0722));if(u_mono==1)c=vec3(lum);vec2 p=floor(gl_FragCoord.xy/u_scale);float t=.5;
if(u_algorithm>=1&&u_algorithm<=3)t=bayer(p,u_algorithm==1?2:u_algorithm==2?4:8);
if(u_algorithm==4)t=texelFetch(u_noise,ivec2(mod(p,64.0)),0).r;
if(u_algorithm==6)t=hash(p);
if(u_algorithm==5){float a=radians(u_angle);vec2 q=mat2(cos(a),-sin(a),sin(a),cos(a))*gl_FragCoord.xy/u_cell;vec2 f=fract(q)-.5;
float coverage=clamp(1.0-lum,0.0,1.0);float ink;
if(u_shape==0)ink=step(length(f),sqrt(coverage/3.14159265));
else if(u_shape==1)ink=step(abs(f.y),coverage*.5);
else ink=step(min(abs(f.x),abs(f.y)),(1.0-sqrt(1.0-coverage))*.5);
vec3 qcol=vec3(1.0-ink);outColor=vec4(mix(c,qcol,u_strength),1);return;}
float n=float(u_levels-1);vec3 shifted=clamp(c+(t-.5)*u_strength/n,0.0,1.0);outColor=vec4(floor(shifted*n+.5)/n,1);}`;
export const palette =
  header +
  `
uniform vec3 u_colors[16],u_metric[16];uniform int u_count,u_oklab;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 lab(vec3 c){c=linearRGB(c);vec3 lms=mat3(.4122214708,.2119034982,.0883024619,.5363325363,.6806995451,.2817188376,.0514459929,.1073969566,.6299787005)*c;lms=pow(max(lms,0.0),vec3(1.0/3.0));return mat3(.2104542553,1.9779984951,.0259040371,.793617785,-2.428592205,.7827717662,-.0040720468,.4505937099,-.808675766)*lms;}
void main(){vec3 c=texture(u_tex,v_uv).rgb;vec3 target=u_oklab==1?lab(c):linearRGB(c);float best=1e10;vec3 result=c;for(int i=0;i<16;i++){if(i>=u_count)break;vec3 p=u_metric[i];float d=dot(target-p,target-p);if(d<best){best=d;result=u_colors[i];}}outColor=vec4(result,1);}`;
export const output =
  header +
  `
uniform sampler2D u_before;uniform float u_compare;
void main(){outColor=texture(u_tex,v_uv);if(v_uv.x<u_compare)outColor=texture(u_before,v_uv);if(u_compare>0.0&&abs(v_uv.x-u_compare)<1.0/u_resolution.x)outColor=vec4(1,.5,.25,1);}`;
