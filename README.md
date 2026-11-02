# Dither Lab

Playground de dithering e fragment shaders. Vite + TypeScript + WebGL2 + Tweakpane, sem backend.

```sh
npm install
npm run dev
```

Node.js 22.12+ recomendado. Abra o endereço exibido pelo Vite. `npm run build` gera `dist/`; `npm run preview` abre a versão de produção.

## Uso

Escolha um dos sete presets, arraste uma imagem/vídeo ou selecione a webcam. Os arquivos ficam no navegador. A webcam exige localhost ou HTTPS e autorização da câmera. O pipeline é fonte → brilho/contraste/gamma/pixelização → dithering → paleta → saída. Cada etapa usa um framebuffer.

GPU: threshold, Bayer 2×2/4×4/8×8, blue noise (void-and-cluster 64×64 gerado uma vez), halftone (pontos/linhas/cruz) e white noise. CPU: Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke, Stucki e Sierra; Worker com OffscreenCanvas quando disponível e transferência de pixels como alternativa. A largura de trabalho padrão é 320 px. A paleta é aplicada após o dithering em distância linear ou OKLab.

Edite o GLSL na parte inferior e escolha a fonte **Shader**. O cabeçalho automático fornece `v_uv`, `outColor`, `u_time` (segundos), `u_resolution` (pixels), `u_mouse` (pixels, origem inferior esquerda) e `u_tex` (mídia carregada). Também é possível escrever um fragment shader completo iniciado por `#version 300 es`. Compilação com debounce de 300 ms; erros mantêm o último shader válido.

Espaço: pausar/reproduzir. **S**: PNG. **R**: gravar WebM (novamente para cancelar). **⌘/Ctrl+Enter**: recompilar. Atalhos não interferem com campos de texto. Use o slider abaixo do canvas para comparar antes/depois.

## Exportar

- **PNG:** resolução interna com escala 1×/2×/4× e nearest-neighbor.
- **SVG Pixel:** runs horizontais de mesma cor viram retângulos. Aviso acima de 200 mil elementos.
- **SVG Halftone:** círculos/linhas/cruzes reais com cobertura da luminância pré-processada; usa primeira/última cor como tinta/papel. Para corresponder ao preview, use halftone mono, força 100% e duas cores ordenadas de escuro para claro.
- **WebM:** `captureStream` + MediaRecorder, com duração/FPS configuráveis. Depende de suporte a WebM; oferecemos erro e GIF/ZIP quando indisponível.
- **GIF / ZIP:** quadros determinísticos, avançando `u_time` manualmente e buscando a posição correspondente de vídeos. GIF tem precisão temporal de centésimos de segundo. ZIP contém PNGs numerados. Uma proteção limita o total a 400 milhões de pixels por exportação. Webcam ao vivo usa WebM.
- **Código HTML:** um arquivo autossuficiente com renderer, algoritmos, parâmetros, shader e mídia incorporada; abre via `file://`, sem rede. Webcam é incorporada como imagem do momento. Preserva pausa/play do projeto. A difusão CPU usa a mesma implementação sequencial nesse HTML.

Exportações usam somente a saída processada, sem o slider de comparação. GIF/ZIP são determinísticos para geradores, shaders e arquivos; vídeos dependem da precisão de busca do decodificador do navegador. Shaders personalizados devem depender de `u_time` para animação determinística.

Presets salvos no navegador, importação/exportação JSON e link compartilhável estão no painel. Imagens/vídeos não são incluídos nos presets/URLs: reabra o arquivo original. HTML exportado incorpora os arquivos e pode ficar grande.

## Adicionar efeito GPU

Crie um arquivo em `src/effects/` com exportação default `{ name, params, frag }`:

```ts
export default {
  name: 'Inverter',
  params: { levels: 2 },
  frag: `void main() {
    outColor = vec4(1.0 - texture(u_tex, v_uv).rgb, 1.0);
  }`,
};
```

Reinicie `npm run dev`. O script inicial descobre os módulos e gera um registro estático, também incorporado no HTML standalone. `params` documenta os parâmetros iniciais do efeito; os controles compartilhados disponíveis são `u_levels`, `u_mono`, `u_strength`, `u_scale`, `u_angle` e `u_cell`. Para um parâmetro novo, adicione-o em `state.ts`, `ui.ts` e no passe em `renderer.ts`. `posterize.ts` é um exemplo funcional. Os arquivos `*.generated.*` são gerados novamente ao iniciar/compilar.

## Verificação

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

Vitest (12 testes) verifica Floyd–Steinberg em cinza 4×4 (~50% branco), todos os kernels, quantização linear/OKLab, blue noise e estado Unicode. Playwright (4 testes) cobre GPU/Worker, recuperação de GLSL inválido, mídia, exportações e HTML sem rede, com abertura dos arquivos e comparação pixel a pixel de Worker/CPU, além de capturas desktop/mobile. A webcam nos testes usa o dispositivo sintético do Chromium.

GPU evita readback durante o preview; CPU lê apenas a resolução reduzida e mantém um único quadro em processamento. 60 fps em 1080p é a meta e depende da GPU, shader e paleta. O contador mostra o desempenho real. Testes headless com renderização de software não certificam essa meta.
