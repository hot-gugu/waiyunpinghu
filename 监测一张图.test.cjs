const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const store=new Map(),session=new Map();let app,template;
// Keep relative-time fixtures within the current day, including tests run after midnight.
const fixtureNow=new Date();fixtureNow.setHours(12,0,0,0);
class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[fixtureNow.getTime()]));}static now(){return fixtureNow.getTime();}}
const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))});
const context={console,Date:FixtureDate,URLSearchParams,localStorage:storage(store),sessionStorage:storage(session),location:{search:'',href:''},document:{},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},naive:{},Vue:{ref:value=>({value}),reactive:x=>x,computed:get=>({get value(){return get();}}),watch:()=>{},onMounted:()=>{},onBeforeUnmount:()=>{},nextTick:()=>Promise.resolve(),createApp:config=>{template=config.template;return {component(){return this;},use(){return this;},mount(){app=config.setup();}};}}};context.window=context;vm.createContext(context);
for(const f of ['报警来源规则.js','基础配置规则.js','误报类型字典.js','报警演示数据.js','今日报警演示数据.js','责任区域数据.js','处置状态演示数据.js','监测一张图数据.js','监测一张图.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),context,{filename:f});
const M=context.MonitorData;
assert.equal(context.AlarmEventLevels.types.length,22);
const r={id:'test',status:'待复核',result:'-'};
assert.equal(M.phase(r,{},{}),'待复核');r.status='已复核';r.result='误报';assert.equal(M.phase(r,{},{}),'误报');r.result='计划内事件';assert.equal(M.phase(r,{},{}),'计划内事件');r.result='确认违规';assert.equal(M.phase(r,{},{}),'待接收');assert.equal(M.phase(r,{test:{}},{}),'待处置');assert.equal(M.phase(r,{test:{}},{test:{}}),'已处置');
assert.equal(M.locate({device:'unknown-device'}),undefined);
assert.equal(new Set(M.devices.map(x=>x.id)).size,M.devices.length);
assert(M.devices.every(d=>d.x>=0&&d.x<=1&&d.y>=0&&d.y<=1));assert(M.devices.some(d=>!d.online));assert(M.devices.some(d=>d.kind==='fire'));
assert(app.events.value.every(r=>r.time.startsWith(new Date().toLocaleDateString('sv-SE'))));
const allPhases=new Set(app.events.value.map(r=>r.phase));for(const s of ['待复核','待接收','待处置','已处置','误报','计划内事件'])assert(allPhases.has(s),'today fixture missing '+s);
const ranked=[{id:'done',phase:'已处置',level:'一级',time:'2099'},{id:'low',phase:'待复核',level:'四级',time:'2099'},{id:'high',phase:'待接收',level:'一级',time:'2000'}].sort(M.sort);assert.equal(ranked[0].id,'high');assert.equal(ranked[2].id,'done');
app.filter.kind='fire';assert(app.devices.value.length>0);assert(app.devices.value.every(d=>d.kind==='fire'));assert(app.events.value.every(r=>{const d=M.locate(r);return d&&d.kind==='fire';}));app.filter.type='违规吸烟';assert.equal(app.devices.value.length,0);app.reset();
const original=app.devices.value.length;app.filter.online='offline';assert(app.devices.value.every(d=>!d.online));app.reset();assert.equal(app.devices.value.length,original);
app.filter.building='warehouse-1';assert(app.devices.value.every(d=>d.buildingId==='warehouse-1'));app.reset();app.filter.keyword='no-such-alarm';assert.equal(app.events.value.length,0);assert.equal(app.devices.value.length,0);app.reset();app.filter.period='custom';app.filter.range=null;assert(app.events.value.every(r=>r.time.startsWith(new Date().toLocaleDateString('sv-SE'))));app.reset();
const found=app.events.value.find(r=>r.deviceId);app.pickEvent(found);assert.equal(app.selectedDevice.value,found.deviceId);assert(app.events.value.every(r=>r.deviceId===found.deviceId));assert.equal(app.detailMode.value,'event');app.clearDevice();assert.equal(app.selectedDevice.value,null);
for(const id of ['CASE-MOBILE-DEMO-PENDING-01','CASE-MOBILE-DEMO-DONE-01'])assert(app.events.value.some(r=>r.id===id));
const pending=app.events.value.find(r=>r.phase==='待复核');app.goAction(pending);assert.equal(app.actionMode.value,'review');assert.equal(app.actionOpen.value,true);assert.equal(context.location.href,'');assert(session.has('park-monitor-view-v1'));
const process=app.events.value.find(r=>r.phase==='待处置');app.goAction(process);assert.equal(app.actionMode.value,'process');assert.equal(app.actionTarget.value.id,process.id);assert.equal(app.actionLabel(process),'处置');assert.equal(app.actionLabel(pending),'复核');assert.equal(app.actionLabel({kind:'ai',phase:'待接收'}),'接收');assert.equal(context.location.href,'');
const finished=app.events.value.find(r=>r.phase==='已处置');const before=context.location.href;app.goAction(finished);assert.equal(context.location.href,before);
app.filter.period='all';assert(app.events.value.every(r=>r.time.slice(0,10)===new Date().toLocaleDateString('sv-SE')));
assert(template.includes('直播流未接入'));assert(template.includes('报警视频片段未接入'));assert(!template.includes('<select'));
console.log('PASS: six stages, fixture coverage, sorting, location, filters, fire isolation, selection, navigation and state persistence.');

for(const [w,h] of [[1432,1084],[1920,1080]]){
 app.view.w=w-(w>=1750?300+380:280+340)-48;app.view.h=h-230;app.view.zoom=1;app.view.x=app.view.y=0;
 const style=app.imageStyle.value;assert(parseFloat(style.width)>=app.view.w-.01);assert(parseFloat(style.height)>=app.view.h-.01);
 for(const g of app.markers.value)assert(g.x>=0&&g.x<=1&&g.y>=0&&g.y<=1);
 const first=app.markers.value.find(g=>g.items.length>1);if(first){const before=app.view.zoom;app.cluster(first);assert(app.view.zoom>before);}
}
app.view.zoom=5;app.zoom(2);assert.equal(app.view.zoom,5);app.zoom(.001);assert.equal(app.view.zoom,1);
// Exercise the actual cross-page review submit handler with an isolated storage and DOM.
{
 let result='确认违规',mis='',confirmCount=0,fail=false;
 const data=new Map(),submit={textContent:'提交复核结果',parentElement:{before(){}}},cancel={textContent:'取消'},area={value:'现场核实'},fields={misreportType:{value:'',selectedOptions:[{textContent:'其他误报'}]},reviewEventType:{value:'人员入侵'},reviewAlarmLevel:{value:'一级'}};
 const err={style:{},setAttribute(){},textContent:''};
 const doc={createElement:tag=>tag==='p'?err:{style:{},append(){}},querySelector:sel=>sel==='[data-review-result][aria-pressed="true"]'?{dataset:{reviewResult:result}}:sel==='textarea'?area:null,querySelectorAll:()=>[submit,cancel],body:{prepend(){}} ,getElementById:id=>fields[id]};
 const c={window:{ALARM_DEMO_RECORDS:[{id:'new',status:'待复核',result:'-',type:'人员入侵'}]},document:doc,location:{search:'?fromMap=1&alarmId=new',pathname:'/AI识别的违章复核.html',href:''},URLSearchParams,Date,AlarmEventLevels:context.AlarmEventLevels,confirm:()=>{confirmCount++;return true;},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}}};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/监测一张图返回.js','utf8'),c);
 result='误报';submit.onclick();assert(err.textContent.includes('误报类型'));assert.equal(confirmCount,0);
 result='确认违规';fail=true;submit.onclick();assert(err.textContent.includes('保存失败'));assert.equal(c.location.href,'');
 fail=false;submit.onclick();assert.equal(c.location.href,'方案图册.html');const saved=JSON.parse(data.get('global-alarm-center-v1')).extra[0];assert.equal(saved.status,'已复核');assert.equal(saved.result,'确认违规');submit.onclick();assert(err.textContent.includes('已复核'));
}
console.log('PASS: viewport geometry at 1432/1920, zoom limits, review validation, storage failure, successful save and duplicate prevention.');

// Unit overview labels and building popup aggregate the same device and alarm sources.
app.reset();
assert.equal(app.buildingMarkers.value.length,8);
for(const b of app.buildingMarkers.value){
 app.pickBuilding(b);assert.equal(app.activeBuilding.value.id,b.id);
 const summary=app.buildingSummary.value,ds=app.siteDevices(b),alarms=app.siteAlarms(b);
 assert.equal(summary.fire+summary.camera,ds.length);
 assert.equal(summary.fireOnline+summary.cameraOnline,ds.filter(d=>d.online).length);
 assert.equal(summary.total,alarms.length);
 assert.equal(summary.verify,alarms.filter(r=>r.phase==='待复核').length);
 assert.equal(summary.process,alarms.filter(r=>['待接收','待处置'].includes(r.phase)).length);
 assert.equal(app.detailMode.value,null);assert.equal(app.selectedDevice.value,null);
}
assert.equal(app.buildingMarkers.value.reduce((n,b)=>n+app.siteDevices(b).length,0),M.devices.length);
app.filter.building='warehouse-2';assert.equal(app.buildingMarkers.value.length,1);assert.equal(app.buildingMarkers.value[0].id,'warehouse-2');
app.reset();assert.equal(app.selectedBuilding.value,null);
assert(template.includes('building-popup'));assert(template.includes('building-pin'));assert(!template.includes('v-for="g in markers"'));
console.log('PASS: full-screen map cover, building-only markers, exact device partition and today alarm aggregation.');

// The office demonstration is shared with the alarm workflow, not a popup-only fixture.
app.reset();const office=app.buildingMarkers.value.find(b=>b.id==='office');
app.pickBuilding(office);
assert.equal(app.buildingSummary.value.total,3);
assert.equal(app.buildingSummary.value.verify,1);
assert.equal(app.buildingSummary.value.process,1);
assert.equal(new Set(app.buildingSummary.value.events.map(r=>r.type)).size,3);
assert.deepEqual([...new Set(app.buildingSummary.value.events.map(r=>r.phase))].sort(),['已处置','待复核','待处置'].sort());
assert.equal(app.pendingAlarms(office),2);
const pendingOffice=app.buildingSummary.value.events.find(r=>r.phase==='待处置');
pendingOffice.phase='已处置';assert.equal(app.pendingAlarms(office),1);pendingOffice.phase='待处置';
assert(template.includes('待处理报警：'));assert(template.includes("'has-alarm':pendingAlarms(b)>0"));
assert(!template.includes('class="metrics"'));assert(!template.includes('class="filter-scroll"'));
assert(template.includes('overview-filters'));assert(template.includes('n-tree-select'));
assert(app.scopeOptions.every(b=>b.children.length&&b.children.every(f=>f.key&&f.label)));
console.log('PASS: office has 3 distinct types/states; pending counts exclude resolved alarms; filters moved and four top cards removed.');

app.reset();assert.equal(app.events.value.length,app.overview.value.total);
const fullCount=app.overview.value.total;
app.chooseAlarmStage('verify');assert.equal(app.events.value.length,app.overview.value.verify);assert(app.events.value.every(r=>r.phase==='待复核'));assert.equal(app.overview.value.total,fullCount);
app.chooseAlarmStage('process');assert.equal(app.events.value.length,app.overview.value.process);assert(app.events.value.every(r=>['待接收','待处置'].includes(r.phase)));
app.chooseAlarmStage('all');assert.equal(app.events.value.length,fullCount);
app.filter.building='support';assert.equal(app.overview.value.total,3);assert.equal(app.events.value.length,3);
app.chooseAlarmStage('verify');assert.equal(app.events.value.length,1);assert.equal(app.overview.value.total,3);
app.reset();assert.equal(app.alarmStage.value,'all');
assert(template.includes('今日报警事件'));assert(template.includes('alarm-stat-cards'));
for(const removed of ['class="side left-side"','class="bottom-summary"','class="legend"','全部历史','自定义'])assert(!template.includes(removed),removed);
console.log('PASS: today-only alarm cards filter the list, keep stable scoped counts and reset selection; old tabs, left list and bottom summary removed.');

app.reset();
const safety=app.safetyOverview.value;
assert.equal(safety.fireTotal+safety.cameraTotal,M.devices.length);
assert.equal(safety.fireOnline+safety.cameraOnline+safety.offline,M.devices.length);
assert.equal(safety.alertBuildings,app.buildingMarkers.value.filter(b=>app.pendingAlarms(b)>0).length);
assert.equal(safety.buildingTotal,8);
assert.equal(Number(safety.onlineRate),Number(((M.devices.length-safety.offline)/M.devices.length*100).toFixed(1)));
app.filter.building='warehouse-2';assert.equal(app.safetyOverview.value.cameraTotal,safety.cameraTotal);app.reset();
assert(template.includes('园区安全概况'));assert(template.includes('safety-overview__grid'));
console.log('PASS: park safety overview uses all configured devices, accurate online/offline totals and buildings with pending alarms.');

app.reset();assert.equal(app.alarmTrend.value.length,7);
assert.equal(app.alarmTrend.value[6].date,new Date().toLocaleDateString('sv-SE'));
assert.equal(app.alarmTrend.value[6].count,app.overview.value.total);
assert.equal(app.trendTotal.value,app.alarmTrend.value.reduce((sum,d)=>sum+d.count,0));
assert.equal(new Set(app.alarmTrend.value.map(d=>d.date)).size,7);
const allTrend=app.trendTotal.value;app.filter.building='warehouse-2';assert.equal(app.trendTotal.value,allTrend);app.reset();
assert(template.includes('设备运行情况'));assert(template.includes('近7日报警趋势'));assert(template.includes('ref="trendCanvas"'));
console.log('PASS: seven calendar-day trend totals match today alarms and remain park-wide under map filtering.');

// Building -> floor navigation and floor-local device state.
app.reset();app.pickBuilding(app.buildingMarkers.value.find(b=>b.id==='office'));app.enterFloor();assert.equal(app.floorBuilding.value.id,'office');assert.equal(app.selectedBuilding.value,null);
vm.runInContext(fs.readFileSync(__dirname+'/楼层监测.js','utf8'),context,{filename:'楼层监测.js'});
const officeFloor=context.MonitorFloorView.setup({building:{id:'office',name:'办公楼'}});
assert.equal(officeFloor.floors.length,3);assert.equal(officeFloor.floor.value,'3');assert.equal(officeFloor.devices.value.length,12);
assert.equal(new Set(officeFloor.devices.value.map(d=>d.type)).size,4);
const originalFloorIds=officeFloor.devices.value.map(d=>d.id);officeFloor.selected.value=originalFloorIds[0];officeFloor.changeFloor('2');assert.equal(officeFloor.currentFloor.value.label,'二层');assert.equal(officeFloor.selected.value,null);assert(officeFloor.devices.value.every(d=>!originalFloorIds.includes(d.id)));assert(officeFloor.devices.value.some(d=>d.status==='报警'));
officeFloor.kind.value='water';assert.equal(officeFloor.visible.value.length,2);assert(officeFloor.visible.value.every(d=>d.type==='water'));
officeFloor.zoomBy(100);officeFloor.resetView();assert.equal(officeFloor.pointStyle(officeFloor.devices.value[0]).left.includes('NaN'),false);
const warehouseFloor=context.MonitorFloorView.setup({building:{id:'warehouse-1',name:'1号仓库'}});assert.equal(warehouseFloor.floors.length,4);warehouseFloor.changeFloor('roof');assert.equal(warehouseFloor.rooms.value[0].name,'消防水箱间');
const entry=fs.readFileSync(__dirname+'/方案图册.html','utf8');assert(entry.indexOf('楼层监测.js')<entry.indexOf('src="监测一张图.js"'));
assert(template.includes('查看详情'));assert(template.includes('monitor-floor-view'));
console.log('PASS: building detail navigation, office/warehouse floor switching, distinct device IDs, four device types, filtering and view reset.');

const floorWithAlarms=context.MonitorFloorView.setup({building:{id:'office',name:'办公楼'},alarms:app.siteAlarms(app.buildingMarkers.value.find(b=>b.id==='office'))});
assert.equal(floorWithAlarms.floorAlarms.value.length,9);assert.equal(floorWithAlarms.floorStats.value['3'].alarms,5);assert.equal(floorWithAlarms.floorStats.value['3'].offline,1);
assert.equal(floorWithAlarms.floorStats.value['1'].offline,0);assert.equal(floorWithAlarms.floorStats.value['2'].offline,2);assert.equal(floorWithAlarms.floorStats.value['2'].alarms,3);
for(const group of floorWithAlarms.typeStats.value)assert.equal(group.total,group.online+group.offline);
const firstAlarm=floorWithAlarms.floorAlarms.value[0];floorWithAlarms.chooseKind('water');floorWithAlarms.locateAlarm(firstAlarm);assert.equal(floorWithAlarms.kind.value,'all');assert.equal(floorWithAlarms.active.value.id,firstAlarm.pinId);assert.equal(floorWithAlarms.active.value.status,'报警');
floorWithAlarms.chooseKind('camera');assert.equal(floorWithAlarms.selected.value,null);assert(floorWithAlarms.visible.value.every(d=>d.type==='camera'));assert.equal(floorWithAlarms.visible.value.length,4);
floorWithAlarms.changeFloor('2');assert.equal(floorWithAlarms.floorAlarms.value.length,6);assert.equal(floorWithAlarms.floorAlarms.value[0].type,'水浸报警');assert(floorWithAlarms.devices.value.some(d=>d.id===floorWithAlarms.floorAlarms.value[0].pinId&&d.status==='报警'));
floorWithAlarms.changeFloor('1');assert.equal(floorWithAlarms.floorAlarms.value.length,6);
console.log('PASS: per-type online/offline totals, marker filtering, floor exception badges and current-floor alarm-to-pin links stay consistent across floor switches.');

for(const r of floorWithAlarms.floorAlarms.value){assert.equal(r.kind,'fire');assert.equal(floorWithAlarms.actionLabel(r),null);floorWithAlarms.locateAlarm(r);assert.equal(floorWithAlarms.active.value.id,r.pinId);}
for(const [phase,label] of [['待复核','复核'],['待接收','接收'],['待处置','处置']])assert.equal(floorWithAlarms.actionLabel({phase}),label);
assert(!context.MonitorFloorView.template.includes('定位设备'));assert(!context.MonitorFloorView.template.includes('<span><i></i>报警</span>'));assert(context.MonitorFloorView.template.includes('@click.stop="$emit(\'action\',r)"'));assert(template.includes('@action="goAction"'));
console.log('PASS: fire alarms locate without actions, AI alarms reuse phase actions, and device legend contains only online/offline.');

const fireRows=floorWithAlarms.floorAlarms.value.filter(r=>r.kind==='fire');
assert(fireRows.some(r=>r.phase==='待处置'));assert(fireRows.some(r=>r.phase==='已处置'));
for(const r of fireRows){assert(r.deviceId&&r.area);assert.equal(r.level,null);assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.time));if(r.phase==='已处置'){assert(r.resolvedAt&&r.resolution);assert.equal(floorWithAlarms.devices.value.find(d=>d.id===r.pinId).status,'在线');}}
assert.equal(floorWithAlarms.floorStats.value['1'].alarms,fireRows.filter(r=>r.phase==='待处置').length);
assert(context.MonitorFloorView.template.includes('{{r.time}}'));assert(!context.MonitorFloorView.template.includes('r.time.slice(11,19)'));assert(context.MonitorFloorView.template.includes('levelTone(r.level)'));assert(context.MonitorFloorView.template.includes('置信度'));assert(template.includes('@detail="pickEvent"'));
console.log('PASS: full alarm fields and detail routes, fire resolved history, active-only badges and restored online devices.');

// Every workflow state must expose the same fields as its source detail page.
app.reset();
for(const phase of ['待复核','误报','计划内事件','待接收','待处置','已处置']){
 const record=app.records.value.find(r=>r.phase===phase);assert(record,'missing '+phase);app.pickEvent(record);
 assert.equal(app.isCaseDetail.value,['待接收','待处置','已处置'].includes(phase));
 assert.deepEqual(Array.from(app.info.value,p=>p[0]),['报警ID','违规事件类型','报警时间','设备名称','置信度','报警等级','责任区域','处置人（责任人）','复核超期']);
 if(phase==='待复核')assert.equal(app.reviewFields.value.length,0);
 if(phase==='误报')assert(app.reviewFields.value.some(([k])=>k==='误报类型'));
 if(phase==='计划内事件')assert(!app.reviewFields.value.some(([k])=>k==='误报类型'||k==='报警等级'));
 if(app.isCaseDetail.value){assert(app.timeline.value.some(n=>n.title==='AI触发报警'));assert(app.timeline.value.some(n=>n.title==='人工复核完成'));}
 if(phase==='已处置'){assert(app.disposal.value.some(([k])=>k==='整改措施'));assert(app.timeline.value.some(n=>n.title==='处置完成'&&n.time));}
 if(phase==='待接收')assert.equal(app.detailRecord.value.receipt,undefined);
 if(phase==='待处置')assert(app.detailRecord.value.receipt&&!app.detailRecord.value.disposal);
}
assert(template.includes('处置记录'));assert(template.includes('暂无可播放的报警视频'));assert(template.includes('报警截图'));assert(template.includes('map-alarm-detail'));
console.log('PASS: six detail states match source fields, conditional review/disposal sections, timelines and video fallback.');

// In-map operations validate, confirm, persist and update the shared records without navigation.
app.reset();let confirmations=0;context.confirm=()=>{confirmations++;return true;};
const inMap=app.records.value.find(r=>r.phase==='待复核');app.goAction(inMap);const unchangedLocation=context.location.href;
app.submitAction();assert(app.actionError.value.includes('复核结果'));assert.equal(confirmations,0);
app.actionForm.value.result='误报';app.submitAction();assert(app.actionError.value.includes('误报类型'));assert.equal(confirmations,0);
app.actionForm.value.result='确认违规';context.confirm=()=>false;app.submitAction();assert.equal(app.actionOpen.value,true);assert.equal(app.records.value.find(r=>r.id===inMap.id).phase,'待复核');
context.confirm=()=>{confirmations++;return true;};const originalSave=context.localStorage.setItem;context.localStorage.setItem=()=>{throw Error('quota');};app.submitAction();assert(app.actionError.value.includes('保存失败'));assert.equal(app.actionOpen.value,true);assert.equal(app.records.value.find(r=>r.id===inMap.id).phase,'待复核');context.localStorage.setItem=originalSave;
app.submitAction();assert.equal(app.actionOpen.value,false);assert.equal(app.records.value.find(r=>r.id===inMap.id).phase,'待接收');
app.goAction(app.records.value.find(r=>r.id===inMap.id));assert.equal(app.actionOpen.value,false);assert.equal(app.records.value.find(r=>r.id===inMap.id).phase,'待处置');
app.goAction(app.records.value.find(r=>r.id===inMap.id));app.submitAction();assert(app.actionError.value.includes('违规人员'));app.actionForm.value.violator=app.actionPeople.value[0].value;app.submitAction();assert(app.actionError.value.includes('处理经过'));app.actionForm.value.description='核实并教育';app.submitAction();assert(app.actionError.value.includes('整改措施'));app.actionForm.value.measures='已整改';app.submitAction();assert.equal(app.records.value.find(r=>r.id===inMap.id).phase,'已处置');assert.equal(app.actionOpen.value,false);assert.equal(context.location.href,unchangedLocation);
const savedDisposal=JSON.parse(store.get('alarm-case-disposals-v1'))[inMap.id];assert.equal(savedDisposal.measures,'已整改');app.submitAction();assert(app.actionError.value.includes('已处置'));assert.equal(JSON.parse(store.get('alarm-case-disposals-v1'))[inMap.id].time,savedDisposal.time);
const mis=app.records.value.find(r=>r.phase==='待复核');app.goAction(mis);app.actionForm.value.result='误报';app.actionForm.value.misreportId=app.misreportOptions.value[0].value;app.submitAction();assert.equal(app.records.value.find(r=>r.id===mis.id).phase,'误报');
let failedUpload=false;app.uploadAction({file:{file:{type:'text/plain',size:10}},onError:()=>failedUpload=true});assert(failedUpload);assert(app.actionError.value.includes('2MB'));
assert(!fs.readFileSync(__dirname+'/监测一张图.js','utf8').includes('location.href='));
console.log('PASS: in-map review, misreport dictionary, receive and disposal, required fields, confirmation cancellation, storage failure and duplicate prevention; no navigation.');

// Fire events never enter the AI review / disposal workflow.
for(const r of app.records.value.filter(r=>r.kind==='fire')){
 assert(['待处置','已处置'].includes(r.phase));
 assert(!app.actionLabel(r));
 app.pickEvent(r);assert.equal(app.isCaseDetail.value,false);
}
assert(!context.MonitorFloorView.template.includes('处置记录'));
app.actionForm.value.violator=app.actionPeople.value.find(p=>p.label.startsWith('刘刚（')).value;
assert(app.actionHistory.value.count>=26);
assert.equal(app.actionHistory.value.distribution.reduce((sum,r)=>sum+r.count,0),app.actionHistory.value.count);
assert(app.actionHistory.value.latestType);
assert(template.includes('actionHistory.latestType'));
assert(template.includes('actionHistory.distribution'));
assert(!template.includes('map-action-photo" alt="报警现场照片"'));
console.log('PASS: fire details are read-only; disposal form reuses case fields and person history totals/distribution.');

assert.equal(M.phase({kind:'fire',id:'fire-active'}, {}, {}),'待处置');
assert.equal(M.phase({kind:'fire',id:'fire-complete',alarmStatus:'已处置'}, {}, {}),'已处置');
assert.equal(M.phase({kind:'fire',id:'fire-stored'}, {}, {'fire-stored':{}}),'已处置');
app.reset();app.pickBuilding(app.buildingMarkers.value.find(b=>b.id==='warehouse-2'));
assert(app.buildingSummary.value.events.some(r=>r.kind==='fire'&&r.phase==='已处置'));
assert(context.MonitorFloorView.template.includes('<teleport to="body"><div v-if="fireDetail"'));
assert(fs.readFileSync(__dirname+'/监测一张图.css','utf8').includes('.floor-fire-detail-mask{z-index:80}'));
console.log('PASS: fire completed state appears in building records; floor detail escapes the header stacking context.');

assert(app.records.value.filter(r=>r.kind==='fire').every(r=>r.level===null));

assert(!template.split('<div v-if="actionOpen"')[0].includes('n-radio-group'),'removed screen filters must remain absent');

// Ledger-equivalent person selection: draft selection only commits on confirmation.
app.actionForm.value.violator=null;
app.openPersonPicker();assert.equal(app.personPickerShow.value,true);assert.equal(app.personOrg.value,'company');
const candidate=app.pickerPeople.value[0];assert(candidate&&app.pickerOrgs.value.length);
app.personDraft.value=candidate.value;app.personPickerShow.value=false;assert.equal(app.actionForm.value.violator,null);
app.openPersonPicker();app.personDraft.value=candidate.value;app.confirmPerson();assert.equal(app.actionForm.value.violator,candidate.value);assert.equal(app.personPickerShow.value,false);
app.personSearch.value='not-a-person';assert.equal(app.pickerRows.value.length,0);app.personSearch.value='';
app.personOrg.value=candidate.departmentId;assert(app.pickerRows.value.some(p=>p.id===candidate.id));
app.changeViolatorType('external');assert.equal(app.actionForm.value.violator,null);assert.equal(app.actionForm.value.externalName,'');
const pendingPersonCase=app.records.value.find(r=>r.phase==='待接收');assert(pendingPersonCase);
context.confirm=()=>true;app.goAction(pendingPersonCase);app.goAction(app.records.value.find(r=>r.id===pendingPersonCase.id));
app.changeViolatorType('external');app.submitAction();assert(app.actionError.value.includes('外来人员姓名'));
app.actionForm.value.externalName='测试访客';app.actionForm.value.externalPhone='123';app.submitAction();assert(app.actionError.value.includes('11位手机号码'));
app.actionForm.value.externalPhone='13912345678';app.actionForm.value.description='现场核实';app.actionForm.value.measures='已整改';app.submitAction();
const externalSaved=JSON.parse(store.get('alarm-case-disposals-v1'))[pendingPersonCase.id];assert.equal(externalSaved.violatorType,'external');assert.equal(externalSaved.violator,'测试访客（13912345678）');
const compileContext={console};vm.createContext(compileContext);vm.runInContext(fs.readFileSync(__dirname+'/assets/vendor/vue.global.prod.js','utf8'),compileContext);compileContext.Vue.compile(template,{decodeEntities:value=>value.replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&quot;',String.fromCharCode(34)).replaceAll('&amp;','&')});
console.log('PASS: personnel picker confirmation/cancellation, organization/name filtering, external validation/persistence and Vue template compilation.');

assert(template.includes('<n-config-provider abstract :theme="null"'),"personnel modal provider must not create a full-height screen flex item");

for(const floorId of ['1','2','3']){
 const ds=floorWithAlarms.devicesForFloor(floorId),flood=ds.filter(d=>d.type==='flood');assert.equal(flood.length,2);assert(flood.every(d=>d.fullType==='水浸监测装置'));
 const alarms=floorWithAlarms.alarmsForFloor(floorId).filter(r=>r.type==='水浸报警');assert.equal(alarms.filter(r=>r.phase==='待处置').length,1);assert.equal(alarms.filter(r=>r.phase==='已处置').length,1);
 assert(alarms.every(r=>r.kind==='fire'&&r.level===null&&flood.some(d=>d.id===r.pinId)&&!floorWithAlarms.actionLabel(r)));
 assert.equal(ds.length,12);
}
floorWithAlarms.chooseKind('flood');assert.equal(floorWithAlarms.visible.value.length,2);assert(floorWithAlarms.visible.value.every(d=>d.type==='flood'));
const floodAlarm=floorWithAlarms.floorAlarms.value.find(r=>r.type==='水浸报警'&&r.phase==='待处置');floorWithAlarms.locateAlarm(floodAlarm);assert.equal(floorWithAlarms.active.value.id,floodAlarm.pinId);
console.log('PASS: flood device category/counts/filtering, pending/resolved read-only alarms and pin location on each warehouse floor.');

assert.equal(app.displayPhase('待接收'),'待接收');assert.equal(app.displayPhase('已处置'),'已处置');assert(!app.timeline.value.some(n=>/接收/.test(n.title)));
