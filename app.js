import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const input=document.getElementById('fileInput');
const drop=document.getElementById('dropZone');
const btn=document.getElementById('convertBtn');
const status=document.getElementById('status');
const link=document.getElementById('downloadLink');
const rotation=document.getElementById('rotation');
let selectedFile=null;
let oldUrl=null;

function setFile(file){
  if(!file||file.type!=='application/pdf'){
    status.textContent='Please select a PDF file.';
    return;
  }
  selectedFile=file;
  btn.disabled=false;
  status.textContent=`Ready: ${file.name}`;
  link.classList.add('hidden');
}

input.addEventListener('change',()=>setFile(input.files[0]));
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,x=>{
  x.preventDefault();
  drop.classList.add('drag');
}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,x=>{
  x.preventDefault();
  drop.classList.remove('drag');
}));
drop.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));

function cropLabel(canvas, threshold=235){
  const ctx=canvas.getContext('2d');
  const {width,height}=canvas;
  const pixels=ctx.getImageData(0,0,width,height).data;

  // Count dark pixels per row/column. This ignores isolated anti-aliasing/noise
  // that made the previous crop think the entire Letter page was content.
  const rowCounts=new Uint32Array(height);
  const colCounts=new Uint32Array(width);

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      if(r<threshold && g<threshold && b<threshold){
        rowCounts[y]++;
        colCounts[x]++;
      }
    }
  }

  // A row/column must contain a meaningful amount of ink to define the label.
  // This removes tiny stray text/noise far away from the actual shipping label.
  const minRowInk=Math.max(6,Math.floor(width*0.003));
  const minColInk=Math.max(6,Math.floor(height*0.003));

  let minX=width,maxX=-1,minY=height,maxY=-1;
  for(let x=0;x<width;x++){
    if(colCounts[x]>=minColInk){
      minX=Math.min(minX,x);
      maxX=Math.max(maxX,x);
    }
  }
  for(let y=0;y<height;y++){
    if(rowCounts[y]>=minRowInk){
      minY=Math.min(minY,y);
      maxY=Math.max(maxY,y);
    }
  }

  if(maxX<minX || maxY<minY) return canvas;

  // Small safety margin so outer borders/text are not clipped.
  const pad=Math.max(10,Math.round(Math.min(width,height)*0.006));
  minX=Math.max(0,minX-pad);
  minY=Math.max(0,minY-pad);
  maxX=Math.min(width-1,maxX+pad);
  maxY=Math.min(height-1,maxY+pad);

  const cropW=maxX-minX+1;
  const cropH=maxY-minY+1;
  const cropped=document.createElement('canvas');
  cropped.width=cropW;
  cropped.height=cropH;
  const cctx=cropped.getContext('2d',{alpha:false});
  cctx.fillStyle='#fff';
  cctx.fillRect(0,0,cropW,cropH);
  cctx.drawImage(canvas,minX,minY,cropW,cropH,0,0,cropW,cropH);
  return cropped;
}

btn.addEventListener('click',async()=>{
  if(!selectedFile)return;
  btn.disabled=true;
  link.classList.add('hidden');
  status.textContent='Converting…';

  try{
    const bytes=new Uint8Array(await selectedFile.arrayBuffer());
    const src=await pdfjsLib.getDocument({data:bytes}).promise;
    const out=await PDFLib.PDFDocument.create();
    const W=288,H=432; // true 4x6 inches, 72 pt/in
    const angle=Number(rotation.value);

    for(let i=1;i<=src.numPages;i++){
      status.textContent=`Converting page ${i} of ${src.numPages}…`;
      const page=await src.getPage(i);
      const viewport=page.getViewport({scale:3,rotation:angle});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);
      canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:ctx,viewport}).promise;

      const cropped=cropLabel(canvas);
      const png=await new Promise(resolve=>cropped.toBlob(resolve,'image/png'));
      const pngBytes=new Uint8Array(await png.arrayBuffer());
      const image=await out.embedPng(pngBytes);
      const p=out.addPage([W,H]);

      // Scale the cropped label to the largest possible size while preserving ratio.
      const scale=Math.min(W/image.width,H/image.height);
      const w=image.width*scale;
      const h=image.height*scale;
      p.drawImage(image,{x:(W-w)/2,y:(H-h)/2,width:w,height:h});
    }

    const result=await out.save();
    if(oldUrl)URL.revokeObjectURL(oldUrl);
    oldUrl=URL.createObjectURL(new Blob([result],{type:'application/pdf'}));
    link.href=oldUrl;
    link.download=selectedFile.name.replace(/\.pdf$/i,'')+'_4x6_fixed.pdf';
    link.classList.remove('hidden');
    status.textContent=`Done — ${src.numPages} page(s) cropped and converted to 4×6.`;
  }catch(err){
    console.error(err);
    status.textContent='Conversion failed. This PDF may use a format the browser could not render.';
  }finally{
    btn.disabled=false;
  }
});
