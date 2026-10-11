(function(root){
  'use strict';
  // Only read-only problem materials. Input grids, receipts and stored data stay intact.
  const selector='.data-box table,.exhibit-table table,.theory-card figure.table-scroll table,.question figure.table-scroll table';
  function prepare(host=document){
    host.querySelectorAll(selector).forEach(table=>{
      if(table.dataset.studyTableReady||table.closest('.kclep-shell,.entry-wrap')||table.querySelector('input,select,textarea'))return;
      table.dataset.studyTableReady='true';table.classList.add('study-data-table');
      let parent=table.parentElement;
      while(parent&&!parent.matches('.question,.theory-card')){parent.classList.add('study-data-container');parent=parent.parentElement;}
      const headers=table.tHead?.rows,bodyRows=[...table.tBodies].flatMap(body=>[...body.rows]);
      // A single record with many conditions is clearer as labelled vertical pairs.
      if(headers?.length===1&&headers[0].cells.length>=4&&bodyRows.length===1&&!table.querySelector('[colspan],[rowspan]')&&headers[0].cells.length===bodyRows[0].cells.length){
        const headCells=[...headers[0].cells],values=[...bodyRows[0].cells],body=document.createElement('tbody');
        headCells.forEach((cell,i)=>{const row=document.createElement('tr');cell.scope='row';row.append(cell,values[i]);body.append(row)});
        table.querySelectorAll('thead,tbody,colgroup').forEach(node=>node.remove());table.append(body);table.classList.add('study-data-pairs');
      }else if(!headers?.length&&bodyRows.length&&!table.querySelector('[colspan],[rowspan]')&&bodyRows.every(row=>row.cells.length>=4&&row.cells.length%2===0&&[...row.cells].every((cell,i)=>cell.tagName===(i%2?'TD':'TH')))){
        const body=document.createElement('tbody');bodyRows.forEach(row=>{const cells=[...row.cells];for(let i=0;i<cells.length;i+=2){const pair=document.createElement('tr');cells[i].scope='row';pair.append(cells[i],cells[i+1]);body.append(pair)}});
        table.querySelectorAll('tbody,colgroup').forEach(node=>node.remove());table.append(body);table.classList.add('study-data-pairs');
      }else if(headers?.length===1&&headers[0].cells.length>=4&&!table.querySelector('[colspan],[rowspan]')&&bodyRows.every(row=>row.cells.length===headers[0].cells.length)){
        // Preserve the original matrix on wide screens; label every value on narrow cards.
        const labels=[...headers[0].cells].map(cell=>cell.textContent.trim());
        bodyRows.forEach(row=>[...row.cells].forEach((cell,i)=>{cell.dataset.studyLabel=labels[i]}));table.classList.add('study-data-records');
      }
    });
  }
  root.TrainingDataTables={prepare};
  function start(){const questions=document.getElementById('questions');if(!questions)return;prepare(questions);new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(node=>node.nodeType===1)))prepare(questions)}).observe(questions,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
