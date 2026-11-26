(() => {
    // Delayed Action 1.1.0 — picture-card explicit and device target compatibility; standalone browser resource.
    const DOMAIN = 'delayed_action', EVENT = DOMAIN + '_list_actions_response', CONFIG_EVENT = DOMAIN + '_get_config_response';
    const DEFAULT_DOMAINS = 'automation climate cover fan humidifier input_boolean input_select lawn_mower light lock media_player scene script select switch vacuum water_heater'.split(' ');
    const SERVICES = { light: ['turn_on', 'turn_off', 'toggle'], switch: ['turn_on', 'turn_off', 'toggle'], input_boolean: ['turn_on', 'turn_off', 'toggle'], fan: ['turn_on', 'turn_off', 'toggle'], humidifier: ['turn_on', 'turn_off', 'toggle'], climate: ['turn_on', 'turn_off', 'toggle'], water_heater: ['turn_on', 'turn_off'], script: ['turn_on', 'turn_off', 'toggle'], cover: ['open_cover', 'close_cover', 'stop_cover'], lock: ['lock', 'unlock', 'open'], vacuum: ['start', 'pause', 'stop', 'return_to_base', 'locate'], lawn_mower: ['start_mowing', 'pause', 'dock'], scene: ['turn_on'], automation: ['turn_on', 'turn_off', 'trigger'], select: ['select_option'], input_select: ['select_option'], media_player: ['turn_on', 'turn_off', 'media_play', 'media_pause', 'media_stop', 'media_next_track', 'media_previous_track', 'volume_up', 'volume_down', 'volume_mute', 'select_source'] };
    const label = v => v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
    const entityDomain = e => e.split('.')[0];
    function resolveEntity(node) { for (const c of [node.config, node._config, node.__config, node.___config]) {
        const e = typeof c === 'string' ? c : c?.entity;
        if (typeof e === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(e))
            return e;
    } for (const e of [node.entityId, node.entity, node.stateObj?.entity_id, node._stateObj?.entity_id, node.getAttribute('entity')])
        if (typeof e === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(e))
            return e; return null; }
    function kind(node) { const tag = node.localName; if (/^(hui-|mushroom-).*-badge$/.test(tag))
        return 'badge'; if (/^hui-.*-entity-row$/.test(tag) || tag === 'hui-generic-entity-row')
        return 'row'; if (['button-card', 'bubble-card', 'better-thermostat-ui-card'].includes(tag))
        return 'card'; if (/^(hui-|mushroom-).*-card$/.test(tag) && !/stack-card$|grid-card$|entities-card$|conditional-card$/.test(tag))
        return 'card'; return null; }
    function parentAcross(node) { return node.parentElement || node.getRootNode()?.host || null; }
    const adapters = new Map(), adapterEvents = new EventTarget();
    let adapterOrder = 0;
    function registerAdapter(adapter) { if (!adapter || typeof adapter.id !== 'string' || !adapter.id.trim() || typeof adapter.selector !== 'string' || !adapter.selector.trim() || typeof adapter.resolve !== 'function' || (adapter.priority !== undefined && !Number.isFinite(adapter.priority)))
        throw new TypeError('Invalid Delayed Action adapter'); document.createElement('div').matches(adapter.selector); if (adapters.has(adapter.id))
        throw Error('Adapter already registered: ' + adapter.id); const entry = { ...adapter, priority: adapter.priority ?? 0, order: adapterOrder++ }; adapters.set(entry.id, entry); adapterEvents.dispatchEvent(new Event('change')); return () => { if (adapters.get(entry.id) === entry) {
        adapters.delete(entry.id);
        adapterEvents.dispatchEvent(new Event('change'));
    } }; }
    function listAdapters() { return [...adapters.values()].sort((a, b) => b.priority - a.priority || a.order - b.order).map(({ id, selector, priority }) => ({ id, selector, priority })); }
    // Only explicit card surfaces: never inspect arbitrary colored descendants.
    function findCardSurface(node, type) {
        if (type === 'badge') {
            if (node.localName === 'ha-badge')
                return node.shadowRoot?.querySelector('.badge') || node;
            const badge = node.shadowRoot?.querySelector('ha-badge') || node.querySelector?.('ha-badge');
            if (badge)
                return badge.shadowRoot?.querySelector('.badge') || badge.querySelector('.badge') || badge;
            return node.shadowRoot?.querySelector('.badge, ha-assist-chip') || node;
        }
        if (type === 'card')
            return node.localName === 'ha-card' ? node :
                node.shadowRoot?.querySelector('ha-card') || node.querySelector?.('ha-card') || node;
        return node;
    }
    function resolveTargets(node, hass) { for (const adapter of [...adapters.values()].sort((a, b) => b.priority - a.priority || a.order - b.order)) {
        try {
            if (!node.matches(adapter.selector))
                continue;
            const result = adapter.resolve(node, { hass, resolveEntity });
            if (!Array.isArray(result))
                throw TypeError('resolve must return an array');
            const targets = [];
            for (const item of result) {
                if (!item || typeof item.entityId !== 'string' || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(item.entityId))
                    continue;
                const anchor = item.anchor ?? node;
                if (typeof anchor.getBoundingClientRect !== 'function' || !anchor.isConnected)
                    continue;
                const type = item.kind ?? kind(node) ?? 'card', placement = item.placement ?? (type === 'badge' ? 'bottom' : 'right'), strategy = item.strategy ?? 'auto';
                if (!['card', 'row', 'badge'].includes(type) || !['right', 'left', 'top', 'bottom'].includes(placement) || !['auto', 'attached', 'overlay'].includes(strategy))
                    continue;
                if (targets.some(t => t.anchor === anchor && t.entity === item.entityId && t.placement === placement))
                    continue;
                const surface = item.surface ?? findCardSurface(anchor, type), container = item.container ?? surface;
                const background = item.background ?? 'auto';
                if (!['auto','solid','media','image','transparent'].includes(background)) continue;
                const imageElement = item.imageElement ?? null;
                targets.push({ host: node, anchor, surface, container, strategy, entity: item.entityId, type, placement, offset: Number.isFinite(item.offset) ? item.offset : 0, adapterId: adapter.id, adapterPriority: adapter.priority, background, imageElement, preferredAction: item.preferredAction ?? null, preferredSource: item.preferredSource ?? null });
            }
            if (targets.length)
                return targets;
        }
        catch (error) {
            if (!adapter.warned) {
                adapter.warned = true;
                console.warn('Delayed Action adapter failed:', adapter.id, error);
            }
        }
    } return []; }
    function singleTarget(node, type) {
        const entityId = resolveEntity(node);
        if (!entityId)
            return [];
        const surface = findCardSurface(node, type);
        // Wait for Lit's first render rather than attaching to an unpainted wrapper.
        if (type === 'badge' && surface === node && !node.shadowRoot)
            return [];
        return [{ entityId, anchor: surface, surface, container: surface, kind: type,
                placement: type === 'badge' ? 'bottom' : 'right', offset: -2,
                strategy: 'auto' }];
    }
    // The outer hui-card is a Lovelace layout wrapper, not a painted card.
    // Wait for the media card's real surface instead of falling back to a wrapper.
    function mediaTarget(node) {
        const entityId = resolveEntity(node);
        const surface = findCardSurface(node, 'card');
        if (!entityId || surface.localName !== 'ha-card' || !surface.querySelector('.background > .color-block'))
            return [];
        return [{entityId, anchor: surface, surface, container: surface, kind: 'card', placement: 'right', offset: -2, strategy: 'auto'}];
    }
    // Home Assistant resolves device targets through its entity registry.
    // Match the service domain, not the icon, device name or image filename.
    function pictureTarget(node, {hass}) {
        const config = node._config ?? node.___config ?? node.__config ?? node.config;
        const surface = findCardSurface(node, 'card');
        const imageElement = surface.querySelector?.('img');
        if (!config || surface.localName !== 'ha-card' || !imageElement) return [];
        const entities = new Map();
        const values = value => Array.isArray(value) ? value : value == null ? [] : [value];
        const add = (value, domain = null, preferredAction = null, preferredSource = null) => {
            for (const id of values(value)) {
                if (typeof id !== 'string' || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(id) || (domain && entityDomain(id) !== domain)) continue;
                if (!hass?.states?.[id]) continue;
                if (!entities.has(id)) entities.set(id, {preferredAction, preferredSource});
            }
        };
        for (const action of [config.tap_action ?? (config.image_entity ? {action:'more-info'} : null), config.hold_action, config.double_tap_action]) {
            switch (action?.action) {
                case 'toggle': add(config.entity, null, 'toggle'); break;
                case 'more-info': add(action.entity ?? config.entity ?? config.camera_image ?? config.image_entity); break;
                case 'perform-action': case 'call-service': {
                    const service = action.perform_action || action.service;
                    if (typeof service !== 'string' || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(service)) break;
                    const [domain, name] = service.split('.');
                    const data = action.data ?? action.service_data ?? {};
                    const preferred = (SERVICES[domain] || []).includes(name) ? name : null;
                    const source = name === 'select_source' && typeof data.source === 'string' ? data.source : null;
                    // Explicit entity targets are authoritative. A service may be in
                    // a different domain (e.g. homeassistant.toggle or a custom integration).
                    // Only preselect an action that the delayed_action backend can call
                    // on this entity's own domain; otherwise retain the ordinary dialog.
                    for (const id of values(action.target?.entity_id ?? action.data?.entity_id ?? action.service_data?.entity_id)) {
                        if (typeof id !== 'string') continue;
                        const entityService = entityDomain(id);
                        const compatible = (domain === entityService || domain === 'homeassistant') && (SERVICES[entityService] || []).includes(name);
                        add(id, null, compatible ? name : null, compatible ? source : null);
                    }
                    const devices = new Set(values(action.target?.device_id ?? data.device_id));
                    if (devices.size) {
                        for (const entry of Object.values(hass?.entities ?? {})) {
                            if (!entry || !devices.has(entry.device_id) || entry.disabled_by || typeof entry.entity_id !== 'string') continue;
                            if (domain === 'homeassistant') {
                                if ((SERVICES[entityDomain(entry.entity_id)] || []).includes(name)) add(entry.entity_id, null, name);
                            } else {
                                add(entry.entity_id, domain, preferred, source);
                            }
                        }
                    }
                    break;
                }
            }
        }
        return [...entities].map(([entityId, preferred]) => ({entityId, ...preferred, anchor:surface, surface, kind:'card', placement:'right', offset:-2, strategy:'auto', background:'image', imageElement}));
    }
    const builtins = [{id:'picture', selector:'hui-picture-card', priority:100, resolve:pictureTarget}, { id: 'media-control', selector: 'hui-media-control-card', priority: 100, resolve: mediaTarget }, { id: 'native', selector: 'hui-tile-card,hui-button-card,hui-entity-card,hui-entity-button-card,hui-light-card,hui-cover-card,hui-thermostat-card', priority: 100, resolve: n => singleTarget(n, 'card') }, { id: 'mushroom', selector: '*', priority: 100, resolve: n => n.localName.startsWith('mushroom-') && kind(n) === 'card' ? singleTarget(n, 'card') : [] }, { id: 'bubble', selector: 'bubble-card', priority: 100, resolve: n => singleTarget(n, 'card') }, { id: 'button-card', selector: 'button-card', priority: 100, resolve: n => singleTarget(n, 'card') }, { id: 'better-thermostat', selector: 'better-thermostat-ui-card', priority: 100, resolve: n => singleTarget(n, 'card') }, { id: 'entity-row', selector: '*', priority: 100, resolve: n => kind(n) === 'row' ? singleTarget(n, 'row') : [] }, { id: 'badge', selector: '*', priority: 100, resolve: n => kind(n) === 'badge' ? singleTarget(n, 'badge') : [] }, { id: 'generic', selector: '*', priority: -1000, resolve: n => { if (!n.localName.includes('-') || n.localName === 'hui-card' || ['hui-media-control-card','hui-picture-card'].includes(n.localName) || /^(ha-|mwc-|md-|paper-|iron-)/.test(n.localName) || /stack-card$|grid-card$|entities-card$|conditional-card$/.test(n.localName))
                return []; const type = kind(n) || (n.localName.endsWith('-card') ? 'card' : null); return type ? singleTarget(n, type) : []; } }];
    for (const a of builtins)
        registerAdapter(a);
    window.DelayedAction = Object.freeze({ apiVersion: 1, registerAdapter, listAdapters });
    const pending = window.DelayedActionAdapters;
    window.DelayedActionAdapters = [];
    if (Array.isArray(pending))
        for (const a of pending)
            try {
                registerAdapter(a);
            }
            catch (e) {
                console.warn(e);
            }
    window.dispatchEvent(new Event('delayed-action-ready'));
    function isAncestor(ancestor, node) {
        for (let p = parentAcross(node); p; p = parentAcross(p))
            if (p === ancestor) return true;
        return false;
    }
    function duplicateTarget(t, candidates) {
        return candidates.some(o => {
            if (o === t || o.host === t.host || o.entity !== t.entity || o.type !== t.type || o.placement !== t.placement)
                return false;
            const above = isAncestor(o.host, t.host);
            const below = isAncestor(t.host, o.host);
            if (!above && !below) return false;
            // Prefer specific adapters over generic ancestors. Equal-priority
            // nested candidates retain the existing outer-card/row behaviour.
            return o.adapterPriority > t.adapterPriority || (above && o.adapterPriority === t.adapterPriority);
        });
    }
    function sameTarget(a, b) { return ['host', 'anchor', 'surface', 'container', 'strategy', 'entity', 'type', 'placement', 'offset', 'adapterId', 'background', 'imageElement', 'preferredAction', 'preferredSource'].every(k => a[k] === b[k]); }
    function anchorPosition(r, p, offset = 0) { const x = r.left + r.width / 2, y = r.top + r.height / 2; switch (p) {
        case 'left': return { x: r.left - offset, y };
        case 'top': return { x, y: r.top - offset };
        case 'bottom': return { x, y: r.bottom + offset };
        default: return { x: r.right + offset, y };
    } }
    function indicatorPosition(r, p, offset = 0) { return anchorPosition(r, p, offset - 6); }
    function actionsFor(hass, entity) { const d = entityDomain(entity), available = hass.services?.[d]; return (SERVICES[d] || []).filter(a => !available || Object.hasOwn(available, a)); }
    function buildPayload(entity, action, mode, value, option) { const p = { entity_id: entity, action }; if (mode === 'delay') {
        if (!Number.isSafeInteger(value) || value < 0)
            throw Error('Enter a valid delay.');
        p.delay = value;
    }
    else {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
            throw Error('Choose a future date and time.');
        p.datetime = date.toISOString();
    } if (action === 'select_option') {
        if (typeof option !== 'string' || !option.length)
            throw Error('Choose an option.');
        p.data = { option };
    } if (action === 'select_source') {
        if (typeof option !== 'string' || !option.length) throw Error('Choose a source.');
        p.data = {source: option};
    } if (action === 'volume_mute')
        p.data = { is_volume_muted: true }; return p; }
    function el(tag, text, attrs = {}) { const n = document.createElement(tag); if (text != null)
        n.textContent = text; for (const [k, v] of Object.entries(attrs))
        n.setAttribute(k, String(v)); return n; }
    class TaskStore extends EventTarget {
        constructor() { super(); this.tasks = {}; this.domains = DEFAULT_DOMAINS; this.hass = null; this.connection = null; this.generation = 0; this.unsubs = []; this.error = ''; this.ready = false; }
        changed() { this.dispatchEvent(new Event('change')); }
        async bind(hass) { if (!hass?.connection)
            return; this.hass = hass; if (this.connection === hass.connection)
            return; this.disconnect(); this.hass = hass; this.connection = hass.connection; const generation = this.generation; try {
            for (const [type, callback] of [[EVENT, event => { this.tasks = event.data?.actions || {}; this.error = ''; this.ready = true; this.changed(); }], [CONFIG_EVENT, event => { if (Array.isArray(event.data?.domains))
                        this.domains = event.data.domains; this.changed(); }]]) {
                const unsub = await hass.connection.subscribeEvents(e => { if (generation === this.generation)
                    callback(e); }, type);
                if (generation !== this.generation) {
                    unsub();
                    return;
                }
                this.unsubs.push(unsub);
            }
            await hass.callService(DOMAIN, 'get_config').catch(e => this.report(e));
            await this.refresh();
        }
        catch (e) {
            if (generation === this.generation) {
                this.disconnect();
                this.report(e);
            }
        } }
        disconnect() { this.generation++; for (const unsub of this.unsubs.splice(0))
            Promise.resolve().then(unsub).catch(console.warn); this.connection = null; this.ready = false; }
        report(e) { this.error = e?.message || String(e); this.changed(); }
        async refresh() { if (!this.hass || !this.connection)
            return; try {
            await this.hass.callService(DOMAIN, 'list');
        }
        catch (e) {
            this.report(e);
        } }
        async execute(p) { await this.hass.callService(DOMAIN, 'execute', p); await this.refresh(); }
        async cancel(entity, task) { await this.hass.callService(DOMAIN, 'cancel', { entity_id: entity, task_id: task }); await this.refresh(); }
        pending(entity) { return Object.values(this.tasks[entity] || {}).filter(t => new Date(t.due).getTime() > Date.now()); }
    }
    const store = new TaskStore();
    const dialogCSS = `dialog{color:var(--primary-text-color,#222);background:var(--card-background-color,#fff);border:0;border-radius:16px;width:min(440px,calc(100vw - 32px));max-height:85dvh;box-sizing:border-box;padding:20px;box-shadow:0 12px 40px #0005}dialog::backdrop{background:#0008}h2{margin:0 0 6px;font-size:20px}p{margin:0 0 16px;color:var(--secondary-text-color,#666)}form{display:grid;gap:12px}label{display:grid;gap:5px;font-weight:500}input,select,button{font:inherit;color:inherit}input,select{box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid var(--divider-color,#aaa);border-radius:8px;background:var(--card-background-color,#fff)}.time{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.buttons{display:flex;justify-content:flex-end;gap:8px}button{cursor:pointer;border:0;border-radius:8px;padding:10px 16px;background:var(--secondary-background-color,#eee)}button[type=submit]{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}button:disabled{opacity:.5}.error{color:var(--error-color,#db4437)}[hidden]{display:none!important}`;
    let activeDialog = null;
    function openDialog(entity, preferredAction = null, preferredSource = null) { const hass = store.hass; if (!hass?.states?.[entity])
        return; if (activeDialog)
        activeDialog.close(); const wrapper = el('div'), root = wrapper.attachShadow({ mode: 'open' }), dialog = el('dialog'), form = el('form'); activeDialog = dialog; root.append(el('style', dialogCSS), dialog); dialog.append(el('h2', 'Delayed Action'), el('p', hass.states[entity].attributes.friendly_name || entity), form); const field = (title, node) => { const l = el('label', title); l.append(node); return l; }; const action = el('select', null, { required: '' }); for (const a of actionsFor(hass, entity))
        action.append(el('option', label(a), { value: a }));
        if ([...action.options].some(o => o.value === preferredAction)) action.value = preferredAction;
        const option = el('select'); const optionField = field('Option', option), mode = el('select'); mode.append(el('option', 'Delay', { value: 'delay' }), el('option', 'At a specific time', { value: 'datetime' })); const time = el('div', null, { class: 'time' }), inputs = ['Hours', 'Minutes', 'Seconds'].map((name, i) => { const input = el('input', null, { type: 'number', min: 0, step: 1, value: i === 1 ? 5 : 0, inputmode: 'numeric' }); if (i)
        input.max = '59'; time.append(field(name, input)); return input; }); const date = el('input', null, { type: 'datetime-local' }), dateField = field('Date and time', date), error = el('div', null, { class: 'error', role: 'alert' }), buttons = el('div', null, { class: 'buttons' }), cancel = el('button', 'Cancel', { type: 'button' }), submit = el('button', 'Schedule', { type: 'submit' }); buttons.append(cancel, submit); form.append(field('Action', action), optionField, field('Schedule', mode), time, dateField, error, buttons); let lastOptionAction = null;
    function update() {
        const needsOption = ['select_option', 'select_source'].includes(action.value);
        if (lastOptionAction !== action.value) {
            const attrs = hass.states[entity].attributes;
            const sourceMode = action.value === 'select_source';
            const items = sourceMode ? (attrs.source_list || []) : (attrs.options || []);
            const options = new Set(Array.isArray(items) ? items : []);
            if (sourceMode && preferredSource) options.add(preferredSource);
            option.replaceChildren(el('option', sourceMode ? 'Choose a source' : 'Choose an option', {value:''}));
            for (const o of options) if (typeof o === 'string') option.append(el('option', o, {value:o}));
            option.value = sourceMode && preferredSource ? preferredSource : '';
            optionField.firstChild.textContent = sourceMode ? 'Source' : 'Option';
            lastOptionAction = action.value;
        }
        optionField.hidden = !needsOption; time.hidden = mode.value !== 'delay'; dateField.hidden = !time.hidden; date.required = !dateField.hidden; for (const i of inputs)
        i.disabled = time.hidden; option.disabled = optionField.hidden; option.required = !optionField.hidden; submit.disabled = !action.value; } action.addEventListener('change', update); mode.addEventListener('change', update); update(); cancel.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', () => { wrapper.remove(); if (activeDialog === dialog)
        activeDialog = null; }, { once: true }); form.addEventListener('submit', async (e) => { e.preventDefault(); error.textContent = ''; submit.disabled = true; try {
        const v = inputs.map(i => Number(i.value));
        await store.execute(buildPayload(entity, action.value, mode.value, mode.value === 'delay' ? v[0] * 3600 + v[1] * 60 + v[2] : date.value, option.value));
        dialog.close();
    }
    catch (err) {
        error.textContent = err?.message || String(err);
        submit.disabled = false;
    } }); (document.querySelector('home-assistant')?.shadowRoot || document.body).append(wrapper); dialog.showModal(); }
    function visibleColor(value) {
        return Boolean(value && value !== 'transparent' &&
            !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(value) && !/\/\s*0(?:\.0+)?%?\s*\)$/.test(value));
    }
    function surfacePaint(record, read = getComputedStyle) {
        const { surface, host, placement } = record;
        const style = read(surface);
        const side = placement[0].toUpperCase() + placement.slice(1);
        const token = name => style.getPropertyValue(name).trim();
        const defaultBackground = token('--ha-card-background') || token('--card-background-color') || '#fff';
        let background = visibleColor(style.backgroundColor) ? style.backgroundColor : defaultBackground;
        let filter = 'none';
        // HA's media-control card paints its background independently of ha-card.
        // Its off state applies grayscale(1) to the entire .background layer.
        // Use only the documented render nodes, not icons, labels or other controls.
        if (record.background === 'media' || (record.background === 'auto' && (host.localName === 'hui-media-control-card' || record.adapterId === 'media-control'))) {
            const backdrop = surface.querySelector('.background');
            const block = backdrop?.querySelector('.color-block');
            const placeholder = backdrop?.querySelector('.no-img');
            if (backdrop && block) {
                const placeholderStyle = placeholder && read(placeholder);
                const paintStyle = placeholderStyle && Number(placeholderStyle.opacity) > 0 &&
                    visibleColor(placeholderStyle.backgroundColor) ? placeholderStyle : read(block);
                if (visibleColor(paintStyle.backgroundColor))
                    background = paintStyle.backgroundColor;
                filter = read(backdrop).filter || 'none';
            }
        }
        if (record.background === 'transparent') background = 'transparent';
        const borderColor = style['border' + side + 'Color'];
        const borderWidth = style['border' + side + 'Width'];
        const hasBorder = style['border' + side + 'Style'] !== 'none' && parseFloat(borderWidth) > 0;
        return { background, filter,
            borderColor: hasBorder ? borderColor : token('--ha-card-border-color') || token('--divider-color') || '#e0e0e0',
            borderWidth: record.background === 'transparent' ? '0px' : hasBorder ? borderWidth : (token('--ha-card-border-width') || '1px'),
            accent: token('--accent-color') || '#03a9f4', inactive: token('--disabled-text-color') || '#888' };
    }
    // Use browser image rendering, not canvas pixel reads. The visible part is a
    // geometrically aligned copy; the tiny overhang reflects the last pixels at
    // the selected edge. No sampling, CORS permission or unrelated icon colors.
    function imageSource(record) {
        if (['solid','transparent'].includes(record.background)) return null;
        if (record.imageElement?.isConnected) {
            const image = record.imageElement;
            if (image.localName === 'img' && image.complete && image.naturalWidth && (image.currentSrc || image.src)) return image;
            return null;
        }
        if (record.adapterId === 'media-control' || record.background === 'media') {
            const image = record.surface.querySelector('.background > .image');
            if (image && Number(getComputedStyle(image).opacity) === 1 && getComputedStyle(image).backgroundImage !== 'none') return image;
            return null;
        }
        return getComputedStyle(record.surface).backgroundImage !== 'none' ? record.surface : null;
    }
    function updateImagePaint(record) {
        const {button, placement} = record;
        const source = imageSource(record);
        let layer = button.querySelector('.da-image-paint');
        if (!source) { layer?.remove(); return; }
        const r = source.getBoundingClientRect(), b = button.getBoundingClientRect(), css = getComputedStyle(source);
        if (!r.width || !r.height || !b.width || !b.height) { layer?.remove(); return; }
        // Convert viewport coordinates to the indicator's local padding box.
        const sx = b.width / button.offsetWidth || 1, sy = b.height / button.offsetHeight || 1;
        const left = b.left + button.clientLeft * sx, top = b.top + button.clientTop * sy;
        const w = r.width / sx, h = r.height / sy, x = (r.left-left)/sx, y = (r.top-top)/sy;
        const image = source.localName === 'img';
        const edges = image ? [0,0,0,0] : ['Top','Right','Bottom','Left'].map(side => parseFloat(css['border'+side+'Width']) || 0);
        // Reflect half a CSS pixel inside a painted CSS edge to avoid subpixel
        // sampling across the first/last repeat tile at the transparent border.
        if (!image) edges[['top','right','bottom','left'].indexOf(placement)] += 0.5;
        if (!layer) { layer = el('span', null, {class:'da-image-paint','aria-hidden':'true'}); button.prepend(layer); }
        const tag = image ? 'img' : 'span';
        if (layer.children.length !== 2 || layer.firstElementChild.localName !== tag) {
            layer.replaceChildren(el(tag),el(tag));
        }
        const filter = record.adapterId === 'media-control' ? getComputedStyle(source.parentElement).filter : css.filter;
        layer.style.filter = filter || 'none';
        for (const child of layer.children) {
            Object.assign(child.style,{position:'absolute',display:'block',boxSizing:'border-box',width:w+'px',height:h+'px',margin:'0',padding:css.padding,border:'0',maxWidth:'none',maxHeight:'none',pointerEvents:'none',opacity:css.opacity});
            if (image) {
                const src = source.currentSrc || source.src;
                if (child.getAttribute('src') !== src) child.src = src;
                child.alt = '';
                child.style.objectFit = css.objectFit;
                child.style.objectPosition = css.objectPosition;
            } else {
                Object.assign(child.style,{backgroundColor:css.backgroundColor,backgroundImage:css.backgroundImage,backgroundSize:css.backgroundSize,backgroundPosition:css.backgroundPosition,backgroundRepeat:css.backgroundRepeat,backgroundOrigin:css.backgroundOrigin,backgroundClip:css.backgroundClip,borderStyle:'solid',borderColor:'transparent',borderWidth:css.borderWidth,clipPath:'inset('+edges.map(v=>v+'px').join(' ')+')'});
            }
        }
        const [main,mirror] = layer.children;
        Object.assign(main.style,{left:x+'px',top:y+'px',transform:'none'});
        // Reflect the source at its edge, including the one-pixel card border.
        const dx = placement==='right'?w-2*edges[1]:placement==='left'?-w+2*edges[3]:0;
        const dy = placement==='bottom'?h-2*edges[2]:placement==='top'?-h+2*edges[0]:0;
        Object.assign(mirror.style,{left:(x+dx)+'px',top:(y+dy)+'px',transform:dx?'scaleX(-1)':'scaleY(-1)'});
    }
    // Mount locally, outside card-internal clipping when necessary. The painted
    // surface remains the anchor and the color/image source, regardless of mount.
    function attachmentPoint(target, view) {
        if (target.strategy === 'overlay') return null;
        const chain=[];
        for (let n=target.container; n && n!==view; n=parentAcross(n)) chain.push(n);
        const clips = n => {
            const css=getComputedStyle(n);
            return /hidden|clip|scroll|auto/.test(css.overflowX+' '+css.overflowY) || /paint|strict|content/.test(css.contain);
        };
        // Scrollports are meant to clip local children, not be escaped.
        // Skip clipped internal surfaces, but stop at the dashboard scrollport.
        let limit=chain.indexOf(target.host);
        if(limit<0) limit=0;
        let start=0;
        for(let i=0;i<=limit;i++) if(clips(chain[i])) start=i+1;
        for(let i=start;i<chain.length;i++) {
            const n=chain[i], css=getComputedStyle(n);
            if (!n?.isConnected || !n.style || css.display==='contents' || css.display==='none' ||
                /^(button|input|select|textarea|img|svg|video|canvas)$/.test(n.localName) || clips(n)) continue;
            if (i>limit && /^(hui-view|hui-sections-view|hui-masonry-view|hui-panel-view)$/.test(n.localName)) break;
            // A mount in a component's shadow root is rendered even without a slot.
            const parent=i>0 && n.shadowRoot ? n.shadowRoot : n;
            return {container:n,parent};
        }
        return null;
    }
    // Restrict the mount's box to the existing content extent. Unlike a
    // zero-sized overflow:visible attachment, a clipped box cannot enlarge it.
    // Scroll offsets are included so these are content boundaries, not the
    // currently visible slice; the browser handles motion/clipping on scroll.
    function contentBounds(container,view) {
        // The document is a scrollport too. A display:contents view has no
        // client box, so relying on the view alone can leak into page overflow.
        const doc=container.ownerDocument, win=doc.defaultView;
        const scroller=doc.scrollingElement || doc.documentElement;
        const left=-win.scrollX, top=-win.scrollY;
        const bounds={left,top,right:left+scroller.scrollWidth,bottom:top+scroller.scrollHeight};
        let needsViewBox=false;
        for(let n=container; n; n=parentAcross(n)) {
            const css=getComputedStyle(n);
            if(n===view) needsViewBox=true;
            if(n===doc.documentElement || n===doc.body) continue;
            const scrollX=/auto|scroll|hidden/.test(css.overflowX), scrollY=/auto|scroll|hidden/.test(css.overflowY);
            const isViewBox=needsViewBox && n.clientWidth>0 && n.clientHeight>0;
            if ((!isViewBox&&!scrollX&&!scrollY)||!n.clientWidth||!n.clientHeight) continue;
            if(isViewBox) needsViewBox=false;
            const r=n.getBoundingClientRect(), sx=r.width/(n.offsetWidth||r.width)||1, sy=r.height/(n.offsetHeight||r.height)||1;
            const l=r.left+(n.clientLeft-(scrollX?n.scrollLeft:0))*sx;
            const t=r.top+(n.clientTop-(scrollY?n.scrollTop:0))*sy;
            if(isViewBox||scrollX) {bounds.left=Math.max(bounds.left,l);bounds.right=Math.min(bounds.right,l+n.scrollWidth*sx);}
            if(isViewBox||scrollY) {bounds.top=Math.max(bounds.top,t);bounds.bottom=Math.min(bounds.bottom,t+n.scrollHeight*sy);}
        }
        return bounds;
    }
    const mountedContainers = new WeakMap();
    function acquireContainer(c) { let s = mountedContainers.get(c); if (!s) {
        const position = c.style.getPropertyValue('position'), priority = c.style.getPropertyPriority('position'), changed = getComputedStyle(c).position === 'static';
        if (changed)
            c.style.setProperty('position', 'relative');
        s = { count: 0, position, priority, changed };
        mountedContainers.set(c, s);
    } s.count++; }
    function releaseContainer(c) { const s = mountedContainers.get(c); if (!s || --s.count > 0)
        return; if (s.changed && c.style.getPropertyValue('position') === 'relative') {
        if (s.position)
            c.style.setProperty('position', s.position, s.priority);
        else
            c.style.removeProperty('position');
    } mountedContainers.delete(c); }
    // The original cornerButton is the visual reference: round background,
    // one-sided border, centered inactive/active dot. Only geometry is normalized.
    const indicatorCSS = `
  :host{position:absolute;left:0;top:0;width:0;height:0;overflow:clip;contain:paint;pointer-events:none;z-index:5;display:block}
  :host([data-overlay]){position:fixed;inset:0;width:auto;height:auto;overflow:clip;contain:paint}
  .cornerButton{all:unset;position:absolute;display:grid;place-items:center;box-sizing:border-box;
    width:24px;height:24px;border-radius:12px;border:0;pointer-events:auto;cursor:pointer;
    touch-action:manipulation;transform:translate(-50%,-50%);isolation:isolate}
  .cornerButton::before{content:'';position:absolute;inset:0;border-radius:inherit;
    background:var(--da-background,var(--ha-card-background,var(--card-background-color,#fff)));
    filter:var(--da-background-filter,none);z-index:-1;pointer-events:none}
  .da-image-paint{position:absolute;inset:0;display:block;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:-1}
  .cornerButton[data-placement=right]{border-right:var(--da-border-width,1px) solid var(--da-border-color,#e0e0e0)}
  .cornerButton[data-placement=left]{border-left:var(--da-border-width,1px) solid var(--da-border-color,#e0e0e0)}
  .cornerButton[data-placement=top]{border-top:var(--da-border-width,1px) solid var(--da-border-color,#e0e0e0)}
  .cornerButton[data-placement=bottom]{border-bottom:var(--da-border-width,1px) solid var(--da-border-color,#e0e0e0)}
  .cornerButton[data-kind=badge]{width:14px;height:14px;border-radius:7px}
  .cornerButtonIndicator{display:block;position:absolute;top:50%;left:50%;width:12px;height:12px;
    border-radius:20px;transform:translate(-50%,-50%);background:var(--da-inactive,#888);pointer-events:none}
  .cornerButton[data-kind=badge] .cornerButtonIndicator{width:6px;height:6px}
  .cornerButton.active .cornerButtonIndicator{background:var(--da-accent,#03a9f4);animation:blink-animation 1s infinite}
  .cornerButton:focus-visible{outline:2px solid var(--primary-color,#03a9f4)}
  @keyframes blink-animation{0%,100%{opacity:1}50%{opacity:0}}
  @media(prefers-reduced-motion:reduce){.cornerButton.active .cornerButtonIndicator{animation:none}}
  .cornerButton[hidden]{display:none}
`;
    function cardElements(target) {
        const button = el('button', null, { type: 'button', class: 'cornerButton',
            'data-kind': target.type, 'data-placement': target.placement });
        button.append(el('span', null, { class: 'cornerButtonIndicator' }));
        button.hidden = true;
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openDialog(target.entity, target.preferredAction, target.preferredSource); });
        for (const name of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu']) {
            button.addEventListener(name, event => event.stopPropagation());
        }
        return button;
    }
    class CardDiscovery {
        constructor() { this.root = null; this.records = new Set(); this.observed = new Set(); this.visible = new Map(); this.anchors = new Map(); this.scanFrame = 0; this.layoutFrame = 0; this.layer = null; this.mutations = new MutationObserver(() => this.scheduleScan()); this.resize = new ResizeObserver(() => this.scheduleLayout()); this.intersection = new IntersectionObserver(entries => { for (const e of entries)
            this.visible.set(e.target, e.isIntersecting); this.scheduleLayout(); }); this.onChange = () => this.scheduleScan(); store.addEventListener('change', this.onChange); adapterEvents.addEventListener('change', this.onChange); window.addEventListener('resize', () => this.scheduleLayout(), { passive: true }); window.addEventListener('scroll', () => { if ([...this.records].some(record=>!record.mount)) this.scheduleLayout(); }, { passive: true, capture: true }); this.tick = setInterval(() => { this.scheduleScan(); this.updateIndicators(); }, 2000); }
        setRoot(root) { if (this.root === root)
            return; this.root = root; this.mutations.disconnect(); this.observed.clear(); for (const record of [...this.records])
            this.remove(record); this.scheduleScan(); }
        scheduleScan() { if (!this.scanFrame)
            this.scanFrame = requestAnimationFrame(() => { this.scanFrame = 0; this.scan(); }); }
        scheduleLayout() { if (!this.layoutFrame)
            this.layoutFrame = requestAnimationFrame(() => { this.layoutFrame = 0; this.layout(); }); }
        ensureLayer() { if (this.layer?.isConnected)
            return; const p = document.querySelector('home-assistant')?.shadowRoot || document.body; this.layer = el('div', null, { 'data-delayed-action-layer': '', 'data-overlay': '' }); this.layer.attachShadow({ mode: 'open' }).append(el('style', indicatorCSS)); p.append(this.layer); }
        scan() { if (!this.root?.isConnected)
            return; this.ensureLayer(); const candidates = [], roots = new Set(); const walk = n => { if (n === this.layer || n.localName === 'delayed-action-card' || n.hasAttribute?.('data-delayed-action-attachment'))
            return; if (n.nodeType === 1 && n.localName.includes('-'))
            for (const t of resolveTargets(n, store.hass))
                if (store.hass?.states?.[t.entity] && store.domains.includes(entityDomain(t.entity)) && actionsFor(store.hass, t.entity).length)
                    candidates.push(t); if (n.shadowRoot) {
            roots.add(n.shadowRoot);
            walk(n.shadowRoot);
        } for (const c of n.children || [])
            walk(c); }; roots.add(this.root); walk(this.root); if ([...this.observed].some(r => !roots.has(r))) {
            this.mutations.disconnect();
            this.observed.clear();
        } for (const r of roots)
            if (!this.observed.has(r)) {
                this.mutations.observe(r, { childList: true, subtree: true });
                this.observed.add(r);
            } const targets = candidates.filter(t => !duplicateTarget(t, candidates)); for (const r of [...this.records])
            if (!r.button.isConnected || !targets.some(t => sameTarget(r, t)))
                this.remove(r); for (const t of targets) {
            if ([...this.records].some(r => sameTarget(r, t)))
                continue;
            const button = cardElements(t);
            let mount = null;
            const point=attachmentPoint(t,this.root);
            if (point) {
                try {
                    acquireContainer(point.container);
                    mount = el('div', null, { 'data-delayed-action-attachment': '' });
                    mount.attachShadow({ mode: 'open' }).append(el('style', indicatorCSS), button);
                    for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu'])
                        mount.addEventListener(ev, e => e.stopPropagation());
                    point.parent.append(mount);
                    if (!mount.getClientRects().length)
                        throw new Error('Attachment container does not render its children');
                }
                catch (e) {
                    mount?.remove();
                    mount = null;
                    releaseContainer(point.container);
                    console.warn(e);
                }
            }
            if (!mount)
                this.layer.shadowRoot.append(button);
            this.records.add({ ...t, button, mount, mountContainer:mount?point.container:null });
            const count = this.anchors.get(t.anchor) || 0;
            if (!count) {
                this.resize.observe(t.anchor);
                this.intersection.observe(t.anchor);
            }
            this.anchors.set(t.anchor, count + 1);
        } this.updateIndicators(); this.scheduleLayout(); }
        updateIndicators() { for (const { entity, button } of this.records) {
            const pending = store.pending(entity);
            button.classList.toggle('active', pending.length > 0);
            const text = 'Delayed Action: ' + entity + (pending.length ? ' (' + pending.length + ' pending)' : '');
            button.title = text;
            button.setAttribute('aria-label', text);
        } }
        remove(r) { r.button.remove(); if (r.mount) {
            r.mount.remove();
            releaseContainer(r.mountContainer);
        } this.records.delete(r); const a = r.anchor, count = this.anchors.get(a) || 1; if (count === 1) {
            this.resize.unobserve(a);
            this.intersection.unobserve(a);
            this.visible.delete(a);
            this.anchors.delete(a);
        }
        else
            this.anchors.set(a, count - 1); }
        layout() { const occupied = new Map();
            // Remove previous attachment extents from the measurement in one batch.
            for(const {mount} of this.records) if(mount) Object.assign(mount.style,{left:'0px',top:'0px',width:'0px',height:'0px'});
            const bounds=new Map();
            for(const record of this.records) if(record.mount) bounds.set(record,contentBounds(record.mountContainer,this.root));
            for (const record of this.records) {
            const { anchor, button, type, placement, offset } = record;
            let mount = record.mount;
            const r = anchor.getBoundingClientRect();
            let { x, y } = indicatorPosition(r, placement, offset + (type === 'badge' ? 4 : 0));
            const key = placement + '|' + offset;
            let slots = occupied.get(anchor);
            if (!slots) {
                slots = new Map();
                occupied.set(anchor, slots);
            }
            const index = slots.get(key) || 0;
            slots.set(key, index + 1);
            if (placement === 'left' || placement === 'right')
                y += index * (type === 'badge' ? 16 : 26);
            else
                x += index * (type === 'badge' ? 16 : 26);
            const show = anchor.isConnected && r.width > 0 && r.height > 0 && (mount || (this.visible.get(anchor) !== false && x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight));
            button.hidden = !show;
            if (!show) continue;
            const paint = surfacePaint(record);
            for (const [k, v] of Object.entries({ '--da-background': paint.background, '--da-background-filter': paint.filter, '--da-border-width': paint.borderWidth, '--da-border-color': paint.borderColor, '--da-accent': paint.accent, '--da-inactive': paint.inactive })) {
                if (v)
                    button.style.setProperty(k, v);
                else
                    button.style.removeProperty(k);
            }
            if (mount) {
                const origin=mount.getBoundingClientRect(), p=record.mountContainer, pr=p.getBoundingClientRect();
                const sx=pr.width/(p.offsetWidth||pr.width)||1, sy=pr.height/(p.offsetHeight||pr.height)||1;
                const radius=(type==='badge'?7:12)+2, limit=bounds.get(record);
                const l=Math.max(x-radius*sx,limit.left), t=Math.max(y-radius*sy,limit.top);
                const right=Math.min(x+radius*sx,limit.right), bottom=Math.min(y+radius*sy,limit.bottom);
                Object.assign(mount.style,{left:(l-origin.left)/sx+'px',top:(t-origin.top)/sy+'px',width:Math.max(0,(right-l)/sx)+'px',height:Math.max(0,(bottom-t)/sy)+'px'});
                x=(x-l)/sx; y=(y-t)/sy;
            }
            button.style.left = x + 'px';
            button.style.top = y + 'px';
            updateImagePaint(record);
        } }
    }
    const cardCSS = `.body{padding:16px;display:grid;gap:12px}.group{display:grid;gap:6px}h3{margin:0;font-size:15px}.task{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.detail{display:grid;gap:3px;font-size:14px}.due{color:var(--secondary-text-color)}button{font:inherit;color:var(--error-color,#db4437);background:none;border:1px solid currentColor;border-radius:8px;padding:6px 10px;cursor:pointer}.error{color:var(--error-color,#db4437)}`;
    class DelayedActionCard extends HTMLElement {
        constructor() { super(); this.attachShadow({ mode: 'open' }); this.onChange = () => this.render(); }
        setConfig(c) { this.config = c; this.render(); }
        set hass(h) { this._hass = h; void store.bind(h); this.render(); }
        get hass() { return this._hass; }
        getCardSize() { return Math.max(1, Object.keys(store.tasks).length); }
        connectedCallback() { store.addEventListener('change', this.onChange); this.render(); }
        disconnectedCallback() { store.removeEventListener('change', this.onChange); }
        render() { const card = el('ha-card', null, { header: this.config?.title || 'Delayed Actions' }), body = el('div', null, { class: 'body' }); card.append(body); if (store.error)
            body.append(el('div', store.error, { class: 'error', role: 'alert' })); const groups = Object.entries(store.tasks).filter(([, t]) => Object.keys(t).length); if (!groups.length)
            body.append(el('div', store.ready ? 'No scheduled actions' : 'Loading scheduled actions…')); for (const [entity, tasks] of groups) {
            const group = el('section', null, { class: 'group' });
            group.append(el('h3', this.hass?.states?.[entity]?.attributes?.friendly_name || entity));
            for (const task of Object.values(tasks).sort((a, b) => new Date(a.due) - new Date(b.due))) {
                const row = el('div', null, { class: 'task' }), detail = el('div', null, { class: 'detail' });
                detail.append(el('span', label(task.action)), el('span', new Date(task.due).toLocaleString(), { class: 'due' }));
                const cancel = el('button', 'Cancel', { type: 'button' });
                cancel.addEventListener('click', async () => { cancel.disabled = true; try {
                    await store.cancel(entity, task.task_id);
                }
                catch (e) {
                    store.report(e);
                    cancel.disabled = false;
                } });
                row.append(detail, cancel);
                group.append(row);
            }
            body.append(group);
        } this.shadowRoot.replaceChildren(el('style', cardCSS), card); }
    }
    function findView(root) { if (!root)
        return null; if (root.localName === 'hui-view')
        return root; for (const c of root.children || []) {
        const r = findView(c);
        if (r)
            return r;
    } return root.shadowRoot ? findView(root.shadowRoot) : null; }
    function start() { if (window.__delayedActionFrontend)
        return; window.__delayedActionFrontend = true; const discovery = new CardDiscovery(); function connect() { const home = document.querySelector('home-assistant'); if (!home)
        return; if (home.hass)
        void store.bind(home.hass); discovery.setRoot(findView(home)); } connect(); setInterval(connect, 1000); setInterval(() => void store.refresh(), 10000); window.addEventListener('location-changed', () => requestAnimationFrame(connect)); }
    if (!customElements.get('delayed-action-card'))
        customElements.define('delayed-action-card', DelayedActionCard);
    window.customCards = window.customCards || [];
    if (!window.customCards.some(c => c.type === 'delayed-action-card'))
        window.customCards.push({ type: 'delayed-action-card', name: 'Delayed Action Card', description: 'Shows and manages delayed actions', preview: true, documentationURL: 'https://github.com/BRUNOsys-UG/delayed-action-card' });
    start();
})();
