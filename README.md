# Photo Showcase Motion

一个以地点照片组为单位的摄影展示页原型。

## 使用方式

1. 把每组照片放进 `photos/地点文件夹/`，例如 `photos/02-bali/`。
2. 每个文件夹里优先放一张 `cover.jpg`、`cover.png` 或 `cover.webp` 作为头图；没有 cover 时会自动取第一张图片。
3. 可选：在照片文件夹里添加 `meta.md`，写地点、时间、坐标和备注。
4. 运行 `node server.mjs`，打开终端输出的本地地址。

## meta.md 示例

```md
title: BALI
location: 巴厘岛
chapter: CHAPTER 02
date: 2026
time: 18:30
coordinates: -8.340, 115.092
note: rain · stone · afternoon light
caption: quiet coast before sunset
theme: auto
```

`theme: auto` 会按头图主色自动匹配摄影色系。也可以手动写：

- `ink-glass`
- `moss-field`
- `brandy-cappuccino`
- `oxide-red`
- `ochre-noon`
- `porcelain-white`
