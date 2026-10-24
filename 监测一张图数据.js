(() => {
 const D=window.ResponsibilityData;
 const anchors={'warehouse-1':[.23,.60],'warehouse-2':[.46,.43],'warehouse-3':[.64,.29],'warehouse-4':[.78,.19],support:[.63,.72]};
 const devices=D.videos.map((v,i)=>{const a=D.areas.find(a=>a.id===v.areaId),f=D.floors.find(f=>f.id===a.floorId),anchor=anchors[f.buildingId];return {id:v.id,name:v.name,kind:'ai',areaId:a.id,floorId:f.id,buildingId:f.buildingId,x:anchor[0]+((i%5)-2)*.018,y:anchor[1]+((Math.floor(i/5)%3)-1)*.024,online:i%17!==0,tags:['AI识别设备',i%2?'固定枪机':'固定球机']};});
 D.buildings.forEach((b,i)=>{const f=D.floors.find(f=>f.buildingId===b.id),a=D.areas.find(a=>a.floorId===f.id);devices.push({id:'fire-'+b.id,name:b.name+'消防监测主机',kind:'fire',areaId:a.id,floorId:f.id,buildingId:b.id,x:anchors[b.id][0]+.045,y:anchors[b.id][1]+.035,online:i!==3,tags:['消防设备','监测主机']});});
 // Include the fire/environment devices already configured in the responsibility scope.
 D.devices.forEach((v,i)=>{const a=D.areas.find(a=>a.id===v.areaId),f=D.floors.find(f=>f.id===a.floorId),anchor=anchors[f.buildingId];devices.push({id:v.id,name:v.name,kind:'fire',areaId:a.id,floorId:f.id,buildingId:f.buildingId,x:anchor[0]+i*.016,y:anchor[1]+.05,online:i!==2,tags:['消防设备','环境监测']});});
 // Explicit legacy-name adapter. Unknown incoming devices are deliberately left unlocated.
 const names=[...new Set((window.ALARM_DEMO_RECORDS||[]).map(r=>r.device))];
 const legacy=Object.fromEntries(names.map((name,i)=>[name,devices.filter(d=>d.kind==='ai')[i*3%devices.filter(d=>d.kind==='ai').length].id]));
 ['仓库作业区摄像头01','装卸通道摄像头02','限制通行区摄像头03','作业平台摄像头04'].forEach((name,i)=>legacy[name]=devices[i*6+2].id);
 const isFire=r=>window.AlarmSourceRules?.isFire(r)||r.kind==='fire'||devices.find(d=>d.id===r.deviceId)?.kind==='fire';
 const fireName=r=>({'烟雾报警':'烟感火灾报警','焰火报警':'电气火灾剩余电流报警','消防通道堵塞':'消防水压偏低'}[r.type]||r.type);
 const phase=(r,receipts,disposals)=>isFire(r)?(r.alarmStatus||r.fireStatus?window.AlarmSourceRules.fireStatus(r):(disposals[r.id]?'已处置':'待处置')):r.status!=='已复核'?'待复核':r.result==='误报'?'误报':r.result==='计划内事件'?'计划内事件':r.result==='确认违规'?(disposals[r.id]?'已处置':receipts[r.id]?'待处置':'待接收'):'待复核';
 const unfinished=s=>['待复核','待接收','待处置'].includes(s);
 const sort=(a,b)=>Number(unfinished(b.phase))-Number(unfinished(a.phase))||(unfinished(a.phase)&&unfinished(b.phase)&&!isFire(a)&&!isFire(b)?['一级','二级','三级','四级'].indexOf(a.level)-['一级','二级','三级','四级'].indexOf(b.level):0)||b.time.localeCompare(a.time)||a.id.localeCompare(b.id);
 const locate=r=>devices.find(d=>d.id===(r.deviceId||legacy[r.device]));
 window.MonitorData={devices,legacy,isFire,fireName,phase,unfinished,sort,locate};
})();
