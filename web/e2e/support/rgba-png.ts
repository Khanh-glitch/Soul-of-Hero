/** Lossless tiny UI PNGs from pixels already read by the art builder. No Canvas readback,
 * canvas allocation, compression dependency or change to the world-rendering surfaces.
 * Stored DEFLATE blocks intentionally trade a few KB for bounded synchronous work. */
const crcTable = Uint32Array.from({length:256}, (_, n) => {
  for(let bit=0;bit<8;bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(name:string, data:Uint8Array):Uint8Array {
  const out=new Uint8Array(data.length+12), view=new DataView(out.buffer);
  view.setUint32(0,data.length);
  for(let i=0;i<4;i++)out[4+i]=name.charCodeAt(i);
  out.set(data,8);
  let crc=0xffffffff;
  for(let i=4;i<out.length-4;i++)crc=crcTable[(crc^out[i])&255]^(crc>>>8);
  view.setUint32(out.length-4,(crc^0xffffffff)>>>0);
  return out;
}
export function rgbaPngUrl(width:number,height:number,rgba:Uint8ClampedArray|Uint8Array):string {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>1048576||rgba.length!==width*height*4)
    throw new Error('Invalid UI image dimensions');
  const stride=width*4,raw=new Uint8Array((stride+1)*height);
  for(let y=0;y<height;y++)raw.set(rgba.subarray(y*stride,(y+1)*stride),y*(stride+1)+1); // PNG filter=0
  const blocks=Math.ceil(raw.length/65535),z=new Uint8Array(2+raw.length+5*blocks+4);
  z.set([0x78,0x01]);let offset=2,a=1,b=0;
  for(let start=0;start<raw.length;start+=65535){
    const length=Math.min(65535,raw.length-start),last=start+length===raw.length;
    z.set([last?1:0,length&255,length>>>8,(~length)&255,((~length)>>>8)&255],offset);offset+=5;
    z.set(raw.subarray(start,start+length),offset);offset+=length;
  }
  for(const byte of raw){a=(a+byte)%65521;b=(b+a)%65521;}
  new DataView(z.buffer).setUint32(offset,((b<<16)|a)>>>0);
  const ihdr=new Uint8Array(13),header=new DataView(ihdr.buffer);
  header.setUint32(0,width);header.setUint32(4,height);ihdr.set([8,6,0,0,0],8);
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',z),chunk('IEND',new Uint8Array())];
  // Chunk the binary string to avoid argument-stack limits and quadratic concatenation.
  const strings:string[]=[];
  for(const part of parts)for(let i=0;i<part.length;i+=8192)strings.push(String.fromCharCode(...part.subarray(i,i+8192)));
  return 'data:image/png;base64,'+btoa(strings.join(''));
}
