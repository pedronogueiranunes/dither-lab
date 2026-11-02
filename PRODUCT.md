# Dither Lab
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Vite + TypeScript, DOM puro, WebGL2, Tweakpane. Sem backend ou three.js.

## Purpose
Playground para experimentar dithering e shaders em tempo real com mídia local,
webcam ou geradores, editar GLSL e exportar imagens, vetores, animações e HTML autônomo.

## Constraints
Todo processamento acontece no cliente. Pipeline linear com framebuffers.
A difusão de erro roda em Worker, com largura padrão de 320 pixels.
Presets JSON, localStorage e URL; arquivos locais não são incluídos no estado.

## Brand commitments
Tema escuro minimalista, tipografia mono. Canvas à esquerda, controles à direita,
editor GLSL embaixo. Interface em português.

## Audience
Pessoas experimentando shaders e dithering; nenhum perfil mais específico foi definido.
