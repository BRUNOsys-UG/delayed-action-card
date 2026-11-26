# Delayed Action adapter API (v1)

A card adapter maps a rendered host to zero or more entity targets. Scheduling, task state, dialog and indicator rendering are owned by Delayed Action.

## Loading

Add your adapter as a separate Lovelace JavaScript module resource. Either resource may load first:

```js
const adapter = {
  id: "my-card-library",
  selector: "my-custom-card",
  priority: 200,
  resolve(element, { hass, resolveEntity }) {
    const entityId = resolveEntity(element);
    return entityId ? [{
      entityId,
      anchor: element,
      placement: "right",
      offset: -6
    }] : [];
  }
};

if (window.DelayedAction) {
  window.DelayedAction.registerAdapter(adapter);
} else {
  (window.DelayedActionAdapters ??= []).push(adapter);
}
```

The API also dispatches `delayed-action-ready` on window when initialized.

## Contract

```ts
interface CardAdapter {
  id: string;
  selector: string;
  priority?: number;
  resolve(element: HTMLElement, context: {
    hass: unknown;
    resolveEntity(element: HTMLElement): string | null;
  }): CardTarget[];
}

interface CardTarget {
  entityId: string;
  anchor?: HTMLElement;
  placement?: "right" | "bottom" | "top" | "left";
  offset?: number;
  kind?: "card" | "row" | "badge";
  strategy?: "auto" | "attached" | "overlay";
  surface?: HTMLElement;
  container?: HTMLElement;
}
```

- `id` must be unique. `selector` is a CSS selector matching the host, not a shadow-piercing selector.
- Resolution is synchronous, side-effect free and may be called repeatedly as the dashboard changes. Return an empty array while a card is not ready.
- Higher priority wins; equal priorities use registration order. First matching adapter that returns valid targets wins. Exceptions are isolated.
- Built-in adapters have priority 100; custom adapters default to 0; the generic fallback uses -1000. Use 200 to override a built-in adapter.
- Anchor defaults to the host. Offsets are pixels, positive outwards, negative inwards. The renderer adds a six-pixel inward inset to every placement. The indicator draws only its outward-facing border.
- Return multiple targets to support multiple entities; use separate anchors for best placement. Targets sharing the same anchor/placement/offset are stacked.
- The scheduler domain whitelist and available HA services still apply. Closed shadow roots are not traversable.
- `registerAdapter` returns an unregister function; registration/removal triggers discovery automatically.
- `window.DelayedAction.listAdapters()` returns metadata in priority order. `window.DelayedAction.apiVersion === 1`.

## Example: two entity rows

```js
const adapter = {
  id: "dual-switch",
  selector: "dual-switch-card",
  priority: 200,
  resolve(element) {
    return [...(element.shadowRoot?.querySelectorAll("[data-entity]") ?? [])]
      .map(anchor => ({
        entityId: anchor.dataset.entity,
        anchor,
        placement: "right",
        offset: -2
      }));
  }
};
if (window.DelayedAction) window.DelayedAction.registerAdapter(adapter);
else (window.DelayedActionAdapters ??= []).push(adapter);
```

No backend changes are needed to add adapters.

## Attachment strategies

`auto` (default) and `attached` prefer a local attachment that follows the card while scrolling. `overlay` explicitly requests the separate overlay. Set `surface` to the element providing the card colors and border, and `container` to a suitable attachment container. Specialized adapters handle native media and picture cards. Complex image compositions may not be reproduced exactly.
