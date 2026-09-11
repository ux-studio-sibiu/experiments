# <effect-name>

<One-line description of the effect and the site/reference it's from.>
Zero dependencies, pure <Canvas2D | CSS | WebGL>.

## Quick start

```html
<div id="fx" style="position:fixed; inset:0;"></div>
<script type="module">
  import { create<EffectName> } from './<effect-name>.js';
  const fx = create<EffectName>({ container: document.getElementById('fx') });
</script>
```

Or drop it in with a plain `<script src="<effect-name>.js">` — it also exposes
`window.create<EffectName>`.

Open [`index.html`](index.html) for a working demo with live sliders.

## Options

All options can also be changed at runtime via `fx.set(name, value)`.

| Option | Default | Description |
| --- | --- | --- |
| `container` | `document.body` | Element the effect fills. |
| `paramA` | `0.5` | … |

## API

```js
const fx = create<EffectName>(options);
fx.set(name, value);  // change any option live (returns fx, chainable)
fx.start() / fx.stop();
fx.destroy();         // stop, detach listeners, remove DOM
```

## Recipes

```js
// <describe a notable preset>
create<EffectName>({ /* … */ });
```

> Note: <state whether this is a faithful reproduction or a byte-for-byte copy
> of the source, and any known differences.>
