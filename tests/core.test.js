import test from "node:test";
import assert from "node:assert/strict";
globalThis.HTMLElement=class{};
globalThis.customElements={get:()=>true};
globalThis.window={customCards:[]};
const {resolveEntity,kind,buildPayload,actionsFor,TaskStore}=await import("../src/core.js");
test("entity discovery supports HA and Mushroom configurations",()=>{for(const key of ["config","_config","__config","___config"])assert.equal(resolveEntity({[key]:{entity:"light.test"},getAttribute:()=>null}),"light.test");});
test("supported card hosts",()=>{for(const tag of ["hui-tile-card","hui-button-card","mushroom-light-card","mushroom-template-card","bubble-card"])assert.equal(kind({localName:tag}),"card");assert.equal(kind({localName:"hui-generic-entity-row"}),"row");assert.equal(kind({localName:"hui-entity-badge"}),"badge");assert.equal(kind({localName:"hui-grid-card"}),null);});
test("backend payload uses data and UTC",()=>{assert.deepEqual(buildPayload("select.test","select_option","delay",0,"A"),{entity_id:"select.test",action:"select_option",delay:0,data:{option:"A"}});assert.equal(buildPayload("light.test","turn_off","datetime","2099-01-01T10:00:00+01:00").datetime,"2099-01-01T09:00:00.000Z");assert.throws(()=>buildPayload("light.test","turn_off","delay",-1));});
test("only registered services offered",()=>assert.deepEqual(actionsFor({services:{light:{turn_off:{}}}},"light.test"),["turn_off"]));
test("task state isolated per entity",()=>{const s=new TaskStore();s.tasks={"light.a":{a:{due:"2099-01-01T00:00:00Z"}},"light.b":{b:{due:"2000-01-01T00:00:00Z"}}};assert.equal(s.pending("light.a").length,1);assert.equal(s.pending("light.b").length,0);});

const {registerAdapter,listAdapters,resolveTargets,anchorPosition}=await import("../src/core.js");
const mockNode=(tag,entity="light.test")=>({localName:tag,config:{entity},isConnected:true,getAttribute:()=>null,getBoundingClientRect:()=>({}),matches(selector){return selector==="*"||selector==="[class],*"||selector.split(",").includes(tag);}});
test("specific adapter overrides generic and unregister restores fallback",()=>{
  const node=mockNode("example-card");
  assert.equal(resolveTargets(node,{} )[0].adapterId,"generic");
  const off=registerAdapter({id:"example",selector:"example-card",priority:10,resolve:element=>[{entityId:"switch.test",anchor:element,placement:"left"}]});
  assert.equal(resolveTargets(node,{})[0].entity,"switch.test");
  assert.ok(listAdapters().some(a=>a.id==="example"));
  assert.throws(()=>registerAdapter({id:"example",selector:"*",resolve:()=>[]}));
  off();off();
  assert.equal(resolveTargets(node,{})[0].adapterId,"generic");
});
test("multi-entity adapters and invalid target isolation",()=>{
  const node=mockNode("multi-card");
  const off=registerAdapter({id:"multi",selector:"multi-card",resolve:element=>[{entityId:"light.one",anchor:element},{entityId:"light.two",anchor:element},{entityId:"light.one",anchor:element},{entityId:"invalid",anchor:element}]});
  assert.deepEqual(resolveTargets(node,{}).map(t=>t.entity),["light.one","light.two"]);off();
});
test("built-in adapters resolve main card types",()=>{
  for(const [tag,id] of [["hui-tile-card","native"],["mushroom-light-card","mushroom"],["bubble-card","bubble"],["button-card","button-card"],["hui-entity-badge","badge"],["hui-generic-entity-row","entity-row"]])assert.equal(resolveTargets(mockNode(tag),{})[0].adapterId,id);
});
test("placement and signed offsets",()=>{
  const r={left:10,top:20,right:110,bottom:60,width:100,height:40};
  assert.deepEqual(anchorPosition(r,"right",-2),{x:108,y:40});
  assert.deepEqual(anchorPosition(r,"bottom",4),{x:60,y:64});
  assert.deepEqual(anchorPosition(r,"left",4),{x:6,y:40});
  assert.deepEqual(anchorPosition(r,"top",4),{x:60,y:16});
});
test("failing adapter falls back without interrupting discovery",()=>{
  const off=registerAdapter({id:"broken",selector:"example-card",priority:50,resolve(){throw Error("broken");}});
  assert.equal(resolveTargets(mockNode("example-card"),{})[0].adapterId,"generic");off();
});
