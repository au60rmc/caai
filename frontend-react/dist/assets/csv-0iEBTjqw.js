function f(n){const o=[];let s=[],t="",l=!1;for(let e=0;e<n.length;e++){const c=n[e];l?c==='"'?n[e+1]==='"'?(t+='"',e++):l=!1:t+=c:c==='"'?l=!0:c===","?(s.push(t),t=""):c===`
`||c==="\r"?(c==="\r"&&n[e+1]===`
`&&e++,s.push(t),t="",s.some(i=>i!=="")&&o.push(s),s=[]):t+=c}return s.push(t),s.some(e=>e!=="")&&o.push(s),o}function r(n){const o=n==null?"":String(n);return/[",\n]/.test(o)?'"'+o.replace(/"/g,'""')+'"':o}function u(n,o){return[n.map(r).join(","),...o.map(s=>s.map(r).join(","))].join(`
`)}function a(n,o,s){const t=new Blob(["\uFEFF"+u(o,s)],{type:"text/csv;charset=utf-8"}),l=URL.createObjectURL(t),e=document.createElement("a");e.href=l,e.download=n,e.click(),URL.revokeObjectURL(l)}export{a as d,f as p};
