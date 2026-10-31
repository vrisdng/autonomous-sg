export async function prepareReceipt(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPEG, PNG or WebP photo. For HEIC or PDF, export a JPEG or paste the receipt text.');
 if(file.size>15*1024*1024)throw new Error('Photo is over 15 MB. Choose a smaller image.');
 const uri=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=uri;await image.decode();
  const ratio=Math.min(1,2200/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo preview unavailable.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.92);
 }finally{URL.revokeObjectURL(uri);}
}
export async function rotateReceipt(uri:string){
 const image=new Image();image.src=uri;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.height;canvas.height=image.width;
 const ctx=canvas.getContext('2d')!;ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0);return canvas.toDataURL('image/jpeg',0.92);
}
