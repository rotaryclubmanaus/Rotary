const DEFAULT_USER = "JessicaRotary1";
const DEFAULT_PASS = "JessicaRotary1";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  };
}
function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8", ...corsHeaders()}});
}
async function ensureDb(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS inscricoes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, clube TEXT NOT NULL, modo TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO config(chave,valor) VALUES ('admin_user',?),('admin_pass',?),('wa_presencial',''),('wa_online','')`).bind(DEFAULT_USER,DEFAULT_PASS).run();
}
async function configValue(env,key){const r=await env.DB.prepare("SELECT valor FROM config WHERE chave=?").bind(key).first();return r?r.valor:"";}
async function setConfig(env,key,value){await env.DB.prepare("INSERT INTO config(chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(key,value).run();}
async function isAdmin(request,env){
  const h=request.headers.get("Authorization")||"";
  if(!h.startsWith("Basic ")) return false;
  let raw=""; try{raw=atob(h.slice(6));}catch(e){return false;}
  const i=raw.indexOf(":"); if(i<0)return false;
  const user=raw.slice(0,i), pass=raw.slice(i+1);
  return user===await configValue(env,"admin_user") && pass===await configValue(env,"admin_pass");
}
export default {
  async fetch(request, env) {
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders()});
    await ensureDb(env);
    const url=new URL(request.url), p=url.pathname;
    if(p==="/" && request.method==="GET") return json({ok:true,mensagem:"API do Seminário Rotary funcionando"});
    if(p==="/api/inscricoes" && request.method==="POST"){
      const b=await request.json().catch(()=>null);
      if(!b||!String(b.nome||"").trim()||!String(b.clube||"").trim()||!["Presencial","Online"].includes(b.modo)) return json({error:"Dados inválidos"},400);
      await env.DB.prepare("INSERT INTO inscricoes(nome,clube,modo) VALUES (?,?,?)").bind(String(b.nome).trim().slice(0,160),String(b.clube).trim().slice(0,160),b.modo).run();
      const whatsapp=await configValue(env,b.modo==="Presencial"?"wa_presencial":"wa_online");
      return json({ok:true,whatsapp});
    }
    if(p.startsWith("/api/admin/")){
      if(!await isAdmin(request,env)) return json({error:"Não autorizado"},401);
      if(p==="/api/admin/config" && request.method==="GET") return json({waPresencial:await configValue(env,"wa_presencial"),waOnline:await configValue(env,"wa_online"),adminUser:await configValue(env,"admin_user")});
      if(p==="/api/admin/config" && request.method==="PUT"){
        const b=await request.json().catch(()=>({}));
        if("waPresencial" in b) await setConfig(env,"wa_presencial",String(b.waPresencial||"").trim());
        if("waOnline" in b) await setConfig(env,"wa_online",String(b.waOnline||"").trim());
        return json({ok:true});
      }
      if(p==="/api/admin/credentials" && request.method==="PUT"){
        const b=await request.json().catch(()=>({}));
        if(!String(b.user||"").trim()||!String(b.pass||"")) return json({error:"Usuário e senha são obrigatórios"},400);
        await setConfig(env,"admin_user",String(b.user).trim().slice(0,100)); await setConfig(env,"admin_pass",String(b.pass).slice(0,200)); return json({ok:true});
      }
      if(p==="/api/admin/inscricoes" && request.method==="GET"){
        const r=await env.DB.prepare("SELECT id,nome,clube,modo,datetime(criado_em,'-4 hours') AS criado_em FROM inscricoes ORDER BY id DESC").all();
        const items=(r.results||[]).map(x=>({...x,data:x.criado_em?x.criado_em.replace(/(\d{4})-(\d{2})-(\d{2}) (.*)/,"$3/$2/$1 $4"):""})); return json({items});
      }
      if(p==="/api/admin/inscricoes" && request.method==="DELETE"){await env.DB.prepare("DELETE FROM inscricoes").run();return json({ok:true});}
    }
    return json({error:"Rota não encontrada"},404);
  }
};
