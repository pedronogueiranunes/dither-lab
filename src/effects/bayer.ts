export const bayer = {
  name: "Ordered Bayer",
  params: { scale: 2, levels: 2 },
  frag: `
float bayer(vec2 p, int n) {
 ivec2 q=ivec2(mod(p,float(n))); int value=0;
 for(int i=0;i<3;i++){if((1<<i)>=n)break;int x=(q.x>>i)&1,y=(q.y>>i)&1;value=value*4+((x^y)*2+y);}
 return (float(value)+0.5)/float(n*n);
}`,
};
