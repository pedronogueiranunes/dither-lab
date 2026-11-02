// A minimal example extension. Add a file like this and restart Vite.
export default {
  name: "Posterize (exemplo)",
  params: { levels: 4 },
  frag: `void main() {
    vec3 color = texture(u_tex, v_uv).rgb;
    if (u_mono == 1) color = vec3(dot(color, vec3(0.2126, 0.7152, 0.0722)));
    float steps = float(u_levels - 1);
    vec3 quantized = floor(color * steps + 0.5) / steps;
    outColor = vec4(mix(color, quantized, u_strength), 1.0);
  }`,
};
