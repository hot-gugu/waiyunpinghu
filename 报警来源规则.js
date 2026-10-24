(() => {
 const isFire=r=>!!r&&(r.kind==='fire'||r.sourceType==='fire'||r.source==='fire'||String(r.deviceId||'').startsWith('fire-')||String(r.id||'').startsWith('FIRE-DEMO-'));
 const fireStatus=r=>['已处置','已恢复'].includes(r?.alarmStatus||r?.fireStatus)?'已处置':'待处置';
 const fireName=r=>({'烟雾报警':'烟感火灾报警','焰火报警':'电气火灾剩余电流报警','消防通道堵塞':'消防水压偏低'}[r.type]||r.type);
 window.AlarmSourceRules={isFire,isAI:r=>!isFire(r),fireStatus,fireName};
})();
