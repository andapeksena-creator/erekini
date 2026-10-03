import http from 'node:http';
import Busboy from 'busboy';

const PORT = Number(process.env.PORT || 3000);
const MAX_BYTES = 15 * 1024 * 1024;
const schema = {
  type: 'object', additionalProperties: false, required: ['invoice_number','issue_date','due_date','currency','supplier','supplier_reg_no','buyer','buyer_reg_no','net_amount','vat_rate','vat_amount','total_amount','confidence_notes'],
  properties: {
    invoice_number:{type:'string'}, issue_date:{type:'string'}, due_date:{type:'string'}, currency:{type:'string'},
    supplier:{type:'string'}, supplier_reg_no:{type:'string'}, buyer:{type:'string'}, buyer_reg_no:{type:'string'},
    net_amount:{type:'string'}, vat_rate:{type:'string'}, vat_amount:{type:'string'}, total_amount:{type:'string'}, confidence_notes:{type:'array',items:{type:'string'}}
  }
};

function send(res, status, body, type='application/json') { res.writeHead(status, {'content-type': `${type}; charset=utf-8`, 'cache-control':'no-store'}); res.end(type === 'application/json' ? JSON.stringify(body) : body); }
function extract(req) { return new Promise((resolve,reject)=>{ const bb=Busboy({headers:req.headers, limits:{fileSize:MAX_BYTES,files:1}}); let file, filename='', mime=''; const chunks=[]; bb.on('file',(_,stream,info)=>{filename=info.filename;mime=info.mimeType;stream.on('data',d=>chunks.push(d));stream.on('limit',()=>reject(new Error('Fails ir lielāks par 15 MB.')));stream.on('end',()=>file=Buffer.concat(chunks));}); bb.on('finish',()=>file?resolve({file,filename,mime}):reject(new Error('Fails nav saņemts.'))); bb.on('error',reject); req.pipe(bb); }); }
async function convert(req,res) {
  if (!process.env.OPENAI_API_KEY) return send(res,500,{error:'OPENAI_API_KEY nav iestatīts servera procesam.'});
  const {file,filename,mime}=await extract(req);
  const uploaded=await fetch('https://api.openai.com/v1/files',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:(()=>{const form=new FormData(); form.append('purpose','user_data'); form.append('file',new Blob([file],{type:mime}),filename); return form;})()});
  if(!uploaded.ok) { const detail=await uploaded.text(); console.error('OpenAI file upload failed',uploaded.status,detail); return send(res,502,{error:'OpenAI faila augšupielāde neizdevās.',detail}); }
  const {id}=await uploaded.json();
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content:[{type:'input_text',text:'Nolasi šo rēķinu. Atgriez tikai strukturētus laukus. Nekad neizdomā trūkstošu informāciju; nezināmu lauku atstāj tukšu un pievieno confidence_notes. Saglabā summas tieši kā dokumentā.'},{type:'input_file',file_id:id}]}],text:{format:{type:'json_schema',name:'invoice_fields',strict:true,schema}}})});
  const data=await response.json(); if(!response.ok) { console.error('OpenAI response failed',response.status,JSON.stringify(data)); return send(res,502,{error:'OpenAI rēķina analīze neizdevās.',detail:data}); }
  let text=data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||'{}';
  try { send(res,200,{fields:JSON.parse(text),source_filename:filename}); } catch { send(res,502,{error:'Neizdevās nolasīt strukturēto atbildi.',detail:text}); }
}
const server=http.createServer(async(req,res)=>{try{if(req.method==='POST'&&req.url==='/api/convert')return await convert(req,res); if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){const html=await import('node:fs/promises').then(fs=>fs.readFile('./dist/index.html','utf8'));return send(res,200,html,'text/html');} send(res,404,{error:'Not found'});}catch(e){console.error('Request failed',e);send(res,400,{error:e.message});}});
server.listen(PORT,()=>console.log(`Rēķins → e-rēķins serveris darbojas uz porta ${PORT}`));
