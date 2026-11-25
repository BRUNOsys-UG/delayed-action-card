// Delayed Action 1.1.0 -- browser entry, also usable without the optional bundled selector.
const DOMAIN = "delayed_action";
const EVENT = "delayed_action_list_actions_response";
const CONFIG_EVENT = "delayed_action_get_config_response";
const DEFAULT_DOMAINS = "automation climate cover fan humidifier input_boolean input_select lawn_mower light lock media_player scene script select switch vacuum water_heater".split(" ");
const SERVICES = {
  light: ["turn_on","turn_off","toggle"], switch: ["turn_on","turn_off","toggle"],
  input_boolean: ["turn_on","turn_off","toggle"], fan: ["turn_on","turn_off","toggle"],
  humidifier: ["turn_on","turn_off","toggle"], climate: ["turn_on","turn_off","toggle"],
  water_heater: ["turn_on","turn_off"], script: ["turn_on","turn_off","toggle"],
  cover: ["open_cover","close_cover","stop_cover"], lock: ["lock","unlock","open"],
  vacuum: ["start","pause","stop","return_to_base","locate"],
  lawn_mower: ["start_mowing","pause","dock"], scene: ["turn_on"],
  automation: ["turn_on","turn_off","trigger"], select: ["select_option"], input_select: ["select_option"],
  media_player: ["turn_on","turn_off","media_play","media_pause","media_stop","media_next_track","media_previous_track","volume_up","volume_down","volume_mute"]
};
const label = value => value.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
const entityDomain = entity => entity.split(".")[0];
function resolveEntity(node) {
  for (const config of [node.config,node._config,node.__config,node.___config]) {
    const entity = typeof config === "string" ? config : config?.entity;
    if (typeof entity === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(entity)) return entity;
  }
  for (const entity of [node.entityId,node.entity,node.stateObj?.entity_id,node._stateObj?.entity_id,node.getAttribute("entity")]) {
    if (typeof entity === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(entity)) return entity;
  }
  return null;
}
function kind(node) {
  const tag = node.localName;
  if (/^(hui-|mushroom-).*-badge$/.test(tag)) return "badge";
  if (/^hui-.*-entity-row$/.test(tag) || tag === "hui-generic-entity-row") return "row";
  if (["button-card","bubble-card","better-thermostat-ui-card"].includes(tag)) return "card";
  if (/^(hui-|mushroom-).*-card$/.test(tag) && !/stack-card$|grid-card$|entities-card$|conditional-card$/.test(tag)) return "card";
  return null;
}
function parentAcross(node) {
  return node.parentElement || node.getRootNode()?.host || null;
}
function isNestedDuplicate(node, entity, type, candidates) {
  for (let parent = parentAcross(node); parent; parent = parentAcross(parent)) {
    const other = candidates.get(parent);
    if (other?.entity === entity && other.type === type) return true;
  }
  return false;
}
function actionsFor(hass, entity) {
  const domain = entityDomain(entity);
  const available = hass.services?.[domain];
  return (SERVICES[domain] || []).filter(action => !available || Object.hasOwn(available, action));
}
function buildPayload(entity, action, mode, value, option) {
  const payload = {entity_id:entity,action};
  if (mode === "delay") {
    if (!Number.isSafeInteger(value) || value < 0) throw Error("Enter a valid delay.");
    payload.delay = value;
  } else {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw Error("Choose a future date and time.");
    payload.datetime = date.toISOString();
  }
  if (action === "select_option") {
    if (typeof option !== "string" || !option.length) throw Error("Choose an option.");
    payload.data = {option};
  }
  if (action === "volume_mute") payload.data = {is_volume_muted:true};
  return payload;
}
function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node;
}
class TaskStore extends EventTarget {
  constructor() { super(); this.tasks = {}; this.domains = DEFAULT_DOMAINS; this.hass = null; this.connection = null; this.generation = 0; this.unsubs = []; this.error = ""; this.ready = false; }
  changed() { this.dispatchEvent(new Event("change")); }
  async bind(hass) {
    if (!hass?.connection) return;
    this.hass = hass;
    if (this.connection === hass.connection) return;
    this.disconnect();
    this.hass = hass;
    this.connection = hass.connection;
    const generation = this.generation;
    try {
      for (const [type, callback] of [
        [EVENT, event => { this.tasks = event.data?.actions || {}; this.error = ""; this.ready = true; this.changed(); }],
        [CONFIG_EVENT, event => { if (Array.isArray(event.data?.domains)) this.domains = event.data.domains; this.changed(); }]
      ]) {
        const unsubscribe = await hass.connection.subscribeEvents(event => {
          if (generation === this.generation) callback(event);
        }, type);
        if (generation !== this.generation) { unsubscribe(); return; }
        this.unsubs.push(unsubscribe);
      }
      await hass.callService(DOMAIN,"get_config").catch(error => this.report(error));
      await this.refresh();
    } catch (error) { if (generation === this.generation) { this.disconnect(); this.report(error); } }
  }
  disconnect() {
    this.generation++;
    for (const unsubscribe of this.unsubs.splice(0)) Promise.resolve().then(unsubscribe).catch(console.warn);
    this.connection = null; this.ready = false;
  }
  report(error) { this.error = error?.message || String(error); this.changed(); }
  async refresh() {
    if (!this.hass || !this.connection) return;
    try { await this.hass.callService(DOMAIN,"list"); } catch (error) { this.report(error); }
  }
  async execute(payload) { await this.hass.callService(DOMAIN,"execute",payload); await this.refresh(); }
  async cancel(entity, task) { await this.hass.callService(DOMAIN,"cancel",{entity_id:entity,task_id:task}); await this.refresh(); }
  pending(entity) { return Object.values(this.tasks[entity] || {}).filter(task => new Date(task.due).getTime() > Date.now()); }
}
const store = new TaskStore();
const dialogCSS = `
  dialog{color:var(--primary-text-color,#222);background:var(--card-background-color,#fff);border:0;border-radius:16px;width:min(440px,calc(100vw - 32px));max-height:85dvh;box-sizing:border-box;padding:20px;box-shadow:0 12px 40px #0005}
  dialog::backdrop{background:#0008} h2{margin:0 0 6px;font-size:20px} p{margin:0 0 16px;color:var(--secondary-text-color,#666)}
  form{display:grid;gap:12px} label{display:grid;gap:5px;font-weight:500} input,select,button{font:inherit;color:inherit} input,select{box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid var(--divider-color,#aaa);border-radius:8px;background:var(--card-background-color,#fff)}
  .time{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.buttons{display:flex;justify-content:flex-end;gap:8px}button{cursor:pointer;border:0;border-radius:8px;padding:10px 16px;background:var(--secondary-background-color,#eee)}button[type=submit]{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}button:disabled{opacity:.5}.error{color:var(--error-color,#db4437)}[hidden]{display:none!important}
`;
let activeDialog = null;
function openDialog(entity) {
  const hass = store.hass;
  if (!hass?.states?.[entity]) return;
  if (activeDialog) activeDialog.close();
  const wrapper = el("div");
  const root = wrapper.attachShadow({mode:"open"});
  root.append(el("style",dialogCSS));
  const dialog = el("dialog");
  activeDialog = dialog;
  root.append(dialog);
  const form = el("form");
  dialog.append(el("h2","Delayed Action"),el("p",hass.states[entity].attributes.friendly_name || entity),form);
  const field = (title,node) => { const l=el("label",title); l.append(node); return l; };
  const action = el("select",null,{required:""});
  for (const item of actionsFor(hass,entity)) action.append(el("option",label(item),{value:item}));
  const option = el("select");
  for (const item of hass.states[entity].attributes.options || []) option.append(el("option",item,{value:item}));
  const optionField = field("Option",option);
  const mode = el("select");
  mode.append(el("option","Delay",{value:"delay"}),el("option","At a specific time",{value:"datetime"}));
  const time = el("div",null,{class:"time"});
  const inputs = ["Hours","Minutes","Seconds"].map((name,i) => {
    const input = el("input",null,{type:"number",min:0,step:1,value:i===1?5:0,inputmode:"numeric"});
    if (i) input.max = "59";
    time.append(field(name,input)); return input;
  });
  const date = el("input",null,{type:"datetime-local"});
  const dateField = field("Date and time",date);
  const error = el("div",null,{class:"error",role:"alert"});
  const buttons = el("div",null,{class:"buttons"});
  const cancel = el("button","Cancel",{type:"button"});
  const submit = el("button","Schedule",{type:"submit"});
  buttons.append(cancel,submit);
  form.append(field("Action",action),optionField,field("Schedule",mode),time,dateField,error,buttons);
  function update() {
    optionField.hidden = action.value !== "select_option";
    time.hidden = mode.value !== "delay"; dateField.hidden = !time.hidden;
    date.required = !dateField.hidden;
    for (const input of inputs) input.disabled = time.hidden;
    option.disabled = optionField.hidden; option.required = !optionField.hidden;
    submit.disabled = !action.value;
  }
  action.addEventListener("change",update); mode.addEventListener("change",update); update();
  cancel.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{wrapper.remove(); if(activeDialog===dialog) activeDialog=null;},{once:true});
  form.addEventListener("submit",async event=>{
    event.preventDefault(); error.textContent=""; submit.disabled=true;
    try {
      const values=inputs.map(input=>Number(input.value));
      const delay=values[0]*3600+values[1]*60+values[2];
      await store.execute(buildPayload(entity,action.value,mode.value,mode.value==="delay"?delay:date.value,option.value));
      dialog.close();
    } catch (err) {error.textContent=err?.message || String(err); submit.disabled=false;}
  });
  (document.querySelector("home-assistant")?.shadowRoot || document.body).append(wrapper);
  dialog.showModal();
}
const indicatorCSS = `
  :host{position:fixed;inset:0;pointer-events:none;z-index:5;display:block}
  button{position:absolute;pointer-events:auto;box-sizing:border-box;width:22px;height:22px;display:grid;place-items:center;padding:0;border:1px solid var(--ha-card-border-color,var(--divider-color,#ddd));border-radius:50%;background:var(--ha-card-background,var(--card-background-color,#fff));cursor:pointer;touch-action:manipulation;transform:translate(-50%,-50%);}
  button[data-kind=badge]{width:14px;height:14px}
  span{width:10px;height:10px;border-radius:50%;background:var(--disabled-text-color,#888)}
  button[data-kind=badge] span{width:6px;height:6px}
  button.active span{background:var(--accent-color,#03a9f4);animation:pulse 1s infinite}
  button:focus-visible{outline:2px solid var(--primary-color,#03a9f4)}
  @keyframes pulse{50%{opacity:.2}} @media(prefers-reduced-motion:reduce){button.active span{animation:none}}
  button[hidden]{display:none}
`;
class CardDiscovery {
  constructor() {
    this.root=null; this.records=new Map(); this.observed=new Set(); this.visible=new Map();
    this.scanFrame=0; this.layoutFrame=0; this.layer=null;
    this.mutations=new MutationObserver(()=>this.scheduleScan());
    this.resize=new ResizeObserver(()=>this.scheduleLayout());
    this.intersection=new IntersectionObserver(entries=>{for(const entry of entries)this.visible.set(entry.target,entry.isIntersecting);this.scheduleLayout();});
    this.onChange=()=>this.scheduleScan();
    store.addEventListener("change",this.onChange);
    window.addEventListener("resize",()=>this.scheduleLayout(),{passive:true});
    window.addEventListener("scroll",()=>this.scheduleLayout(),{passive:true,capture:true});
    this.tick=setInterval(()=>{this.scheduleScan();this.updateIndicators();},2000);
  }
  setRoot(root) {
    if(this.root===root)return;
    this.root=root; this.mutations.disconnect(); this.observed.clear();
    for(const node of this.records.keys())this.remove(node);
    this.scheduleScan();
  }
  scheduleScan(){if(!this.scanFrame)this.scanFrame=requestAnimationFrame(()=>{this.scanFrame=0;this.scan();});}
  scheduleLayout(){if(!this.layoutFrame)this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;this.layout();});}
  ensureLayer(){
    const parent=document.querySelector("home-assistant")?.shadowRoot || document.body;
    if(this.layer?.isConnected)return;
    this.layer=el("div",null,{"data-delayed-action-layer":""});
    const root=this.layer.attachShadow({mode:"open"});root.append(el("style",indicatorCSS));parent.append(this.layer);
  }
  scan(){
    if(!this.root?.isConnected)return;
    this.ensureLayer();
    const candidates=new Map();const roots=new Set();
    const walk=node=>{
      if(node===this.layer || node.localName==="delayed-action-card")return;
      if(node.nodeType===1){
        const type=kind(node);const entity=type?resolveEntity(node):null;
        if(entity && store.hass?.states?.[entity] && store.domains.includes(entityDomain(entity)) && actionsFor(store.hass,entity).length)candidates.set(node,{entity,type});
      }
      if(node.shadowRoot){roots.add(node.shadowRoot);walk(node.shadowRoot);}
      for(const child of node.children || [])walk(child);
    };
    roots.add(this.root);walk(this.root);
    if([...this.observed].some(root=>!roots.has(root))){this.mutations.disconnect();this.observed.clear();}
    for(const root of roots)if(!this.observed.has(root)){
      this.mutations.observe(root,{childList:true,subtree:true});this.observed.add(root);
    }
    for(const [node,record] of this.records){
      const candidate=candidates.get(node);
      if(!candidate || candidate.entity!==record.entity || isNestedDuplicate(node,candidate.entity,candidate.type,candidates))this.remove(node);
    }
    for(const [node,candidate] of candidates){
      if(this.records.has(node)||isNestedDuplicate(node,candidate.entity,candidate.type,candidates))continue;
      const button=el("button",null,{type:"button","data-kind":candidate.type});
      button.append(el("span"));button.hidden=true;
      button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openDialog(candidate.entity);});
      this.layer.shadowRoot.append(button);this.records.set(node,{...candidate,button});
      this.resize.observe(node);this.intersection.observe(node);
    }
    this.updateIndicators();this.scheduleLayout();
  }
  updateIndicators(){
    for(const {entity,button} of this.records.values()){
      const pending=store.pending(entity);button.classList.toggle("active",pending.length>0);
      const text="Delayed Action: "+entity+(pending.length?" ("+pending.length+" pending)":"");
      button.title=text;button.setAttribute("aria-label",text);
    }
  }
  remove(node){
    this.records.get(node)?.button.remove();this.records.delete(node);
    this.resize.unobserve(node);this.intersection.unobserve(node);this.visible.delete(node);
  }
  layout(){
    for(const [node,{button,type}] of this.records){
      const r=node.getBoundingClientRect();
      const x=type==="badge"?r.left+r.width/2:r.right-2;
      const y=type==="badge"?r.bottom-2:r.top+r.height/2;
      const show=node.isConnected && this.visible.get(node)!==false && r.width>0 && r.height>0 && x>=0 && y>=0 && x<=window.innerWidth && y<=window.innerHeight;
      button.hidden=!show;
      if(show){button.style.left=x+"px";button.style.top=y+"px";}
    }
  }
}
const cardCSS=`
  .body{padding:16px;display:grid;gap:12px}.group{display:grid;gap:6px}h3{margin:0;font-size:15px}.task{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.detail{display:grid;gap:3px;font-size:14px}.due{color:var(--secondary-text-color)}button{font:inherit;color:var(--error-color,#db4437);background:none;border:1px solid currentColor;border-radius:8px;padding:6px 10px;cursor:pointer}.error{color:var(--error-color,#db4437)}
`;
class DelayedActionCard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this.onChange=()=>this.render();}
  setConfig(config){this.config=config;this.render();}
  set hass(hass){this._hass=hass;void store.bind(hass);this.render();}
  get hass(){return this._hass;}
  getCardSize(){return Math.max(1,Object.keys(store.tasks).length);}
  connectedCallback(){store.addEventListener("change",this.onChange);this.render();}
  disconnectedCallback(){store.removeEventListener("change",this.onChange);}
  render(){
    if(!this.shadowRoot)return;
    const card=el("ha-card",null,{header:this.config?.title||"Delayed Actions"});
    const body=el("div",null,{class:"body"});card.append(body);
    if(store.error)body.append(el("div",store.error,{class:"error",role:"alert"}));
    const groups=Object.entries(store.tasks).filter(([,tasks])=>Object.keys(tasks).length);
    if(!groups.length)body.append(el("div",store.ready?"No scheduled actions":"Loading scheduled actions…"));
    for(const [entity,tasks] of groups){
      const group=el("section",null,{class:"group"});
      group.append(el("h3",this.hass?.states?.[entity]?.attributes?.friendly_name||entity));
      for(const task of Object.values(tasks).sort((a,b)=>new Date(a.due)-new Date(b.due))){
        const row=el("div",null,{class:"task"});const detail=el("div",null,{class:"detail"});
        detail.append(el("span",label(task.action)),el("span",new Date(task.due).toLocaleString(),{class:"due"}));
        const cancel=el("button","Cancel",{type:"button"});
        cancel.addEventListener("click",async()=>{cancel.disabled=true;try{await store.cancel(entity,task.task_id);}catch(err){store.report(err);cancel.disabled=false;}});
        row.append(detail,cancel);group.append(row);
      }
      body.append(group);
    }
    this.shadowRoot.replaceChildren(el("style",cardCSS),card);
  }
}
function findView(root){
  if(!root)return null;
  if(root.localName==="hui-view")return root;
  for(const child of root.children||[]){const result=findView(child);if(result)return result;}
  return root.shadowRoot?findView(root.shadowRoot):null;
}
function start(Selector){
  if(window.__delayedActionFrontend)return;
  window.__delayedActionFrontend=true;
  const discovery=new CardDiscovery();
  let selectorView=null;
  if(Selector){
    const instance=new Selector();
    instance.addEventListener("onLovelacePanelLoad",async({detail})=>{
      const view=await detail.HUI_VIEW.element;
      if(view?.isConnected){selectorView=view;discovery.setRoot(view);}
    });
    instance.addEventListener("onPanelLoad",()=>{selectorView=null;});
    instance.listen();
  }
  function connect(){
    const home=document.querySelector("home-assistant");
    if(!home)return;
    if(home.hass)void store.bind(home.hass);
    const view=selectorView?.isConnected?selectorView:findView(home);
    discovery.setRoot(view);
  }
  connect();setInterval(connect,1000);setInterval(()=>void store.refresh(),10000);
  window.addEventListener("location-changed",()=>requestAnimationFrame(connect));
}
if(!customElements.get("delayed-action-card"))customElements.define("delayed-action-card",DelayedActionCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==="delayed-action-card"))window.customCards.push({type:"delayed-action-card",name:"Delayed Action Card",description:"Shows and manages delayed actions",preview:true,documentationURL:"https://github.com/BRUNOsys-UG/delayed-action-card"});
export {start,resolveEntity,kind,buildPayload,actionsFor,isNestedDuplicate,TaskStore};
