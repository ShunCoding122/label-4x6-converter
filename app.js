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
  if(!file||file.type!=='application/pdf'){status.textContent='Please select a PDF file.';return;}
  selectedFile=file; btn.disabled=false; status.textContent=`Ready: ${file.name}`; link.classList.add('hidden');
}
input.addEventListener('change',()=>setFile(input.files[0]));
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));

function cropWhiteMargins(canvas, threshold=245){
  const ctx=canvas.getContext('2d');
  const {width,height}=canvas;
  const data=ctx.getImageData(0,0,width,height).data;
  let minX=width,minY=height,maxX=-1,maxY=-1;

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      if(r<threshold||g<threshold||b<threshold){
        if(x<minX)minX=x;
        if(x>maxX)maxX=x;
        if(y<minY)minY=y;
        if(y>maxY)maxY=y;
      }
    }
  }

  if(maxX<minX||maxY<minY)return canvas;

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
  btn.disabled=true; link.classList.add('hidden'); status.textContent='Converting…';
  try{
    const bytes=new Uint8Array(await selectedFile.arrayBuffer());
    const src=await pdfjsLib.getDocument({data:bytes}).promise;
    const out=await PDFLib.PDFDocument.create();
    const W=288,H=432;
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

      const cropped=cropWhiteMargins(canvas,245);
      const png=await new Promise(r=>cropped.toBlob(r,'image/png'));
      const pngBytes=new Uint8Array(await png.arrayBuffer());
      const image=await out.embedPng(pngBytes);
      const p=out.addPage([W,H]);
      const scale=Math.min(W/image.width,H/image.height);
      const w=image.width*scale,h=image.height*scale;
      p.drawImage(image,{x:(W-w)/2,y:(H-h)/2,width:w,height:h});
    }

    const result=await out.save();
    if(oldUrl)URL.revokeObjectURL(oldUrl);
    oldUrl=URL.createObjectURL(new Blob([result],{type:'application/pdf'}));
    link.href=oldUrl;
    link.download=selectedFile.name.replace(/\.pdf$/i,'')+'_4x6_fixed.pdf';
    link.classList.remove('hidden');
    status.textContent=`Done — ${src.numPages} page(s) converted to cropped 4×6.`;
  }catch(err){
    console.error(err);
    status.textContent='Conversion failed. This PDF may use a format the browser could not render.';
  }finally{
    btn.disabled=false;
  }
});
