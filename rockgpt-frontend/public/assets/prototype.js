
const $=id=>document.getElementById(id);
const sc=$("sc"),list=$("list"),input=$("input"),sendBtn=$("send"),tray=$("tray"),comp=$("comp"),app=$("app"),empty=$("empty"),hist=$("hist"),modal=$("modal");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SD={enter:true,intro:true,size:"m",scroll:true,instr:""};
let SET={...SD};try{SET={...SD,...JSON.parse(localStorage.getItem("rockgpt_set")||"{}")}}catch(e){}
const saveSet=()=>{try{localStorage.setItem("rockgpt_set",JSON.stringify(SET))}catch(e){}};
document.documentElement.dataset.size=SET.size;
let FAST=false;try{FAST=localStorage.getItem("rockgpt_fast")==="1"}catch(e){}
/* ===== CONFIG: connect your backend ===== */
const CONFIG={
API_URL:"",   // chat endpoint, e.g. "/api/chat". Empty = demo replies.
AUTH_URL:"",  // POST {AUTH_URL}/signin|signup|verify|forgot -> {user:{name,email}}. Empty = demo accounts.
GOOGLE_URL:"" // Google OAuth start URL. Empty = demo sign-in.
};
async function askRock(messages,onChunk,signal){
const ab=()=>new DOMException("Aborted","AbortError");
if(!CONFIG.API_URL){
const nap=ms=>new Promise((r,j)=>{if(signal&&signal.aborted)return j(ab());const t=setTimeout(r,ms);signal&&signal.addEventListener("abort",()=>{clearTimeout(t);j(ab())},{once:true})});
const last=messages[messages.length-1],n=(last.attachments||[]).length;
const demo=`## Hi, I'm ROCKGPT\n\nThis is **demo mode**.${n?` I received ${n} attachment${n>1?"s":""}: ${last.attachments.map(a=>"`"+a.name+"`").join(", ")}.`:""}\n\nConnect your API in \`CONFIG.API_URL\` for real answers. What you can try:\n\n1. Press **Stop** while I'm writing\n2. Copy the code below\n3. Rate or read this reply aloud\n\n> Everything here runs in your browser.\n\n\`\`\`js\nconsole.log("ROCKGPT");\n\`\`\``;
await nap(2200);
for(let i=0;i<demo.length;i+=9){onChunk(demo.slice(0,i+9));await nap(60)}
onChunk(demo);return}
const res=await fetch(CONFIG.API_URL,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",signal,body:JSON.stringify({messages,fast:FAST,instructions:SET.instr})});
if(!res.ok)throw new Error("bad");
const rd=res.body.getReader(),dc=new TextDecoder();let full="";
for(;;){const{done,value}=await rd.read();if(done)break;full+=dc.decode(value,{stream:true});onChunk(full)}
}
async function auth(path,body){
if(!CONFIG.AUTH_URL){await sleep(600);return{user:{name:body.name||(body.email||"guest").split("@")[0],email:body.email||"guest@local"}}}
const r=await fetch(CONFIG.AUTH_URL+"/"+path,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(body)});
const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Something went wrong. Try again.");return j}

/* ===== Icons ===== */
const I={
user:'<path d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1"/><circle cx="12" cy="8" r="4"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon:'<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
plus:'<path d="M12 5v14M5 12h14"/>'};
const sv=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const GG='<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
$("clip").innerHTML=sv("plus",22);$("mic").innerHTML=sv("mic",20);
$("tl").innerHTML=sv("moon",17)+"Theme";$("tLight").innerHTML=sv("sun",15)+"Light";$("tDark").innerHTML=sv("moon",15)+"Dark";

/* ===== Logo (knot mark) ===== */
const LOGO_S="data:image/webp;base64,UklGRsQjAABXRUJQVlA4WAoAAAAQAAAAnwAAnwAAQUxQSLAiAAAB/yckSPD/eGtEpO4TDiJJUqSmPfjp8y+Y3kJE/ycA7yT+dkkm32yT3D6x3W1mSD7ZrRZjPia3s1VpuyQTAG3d1nZ5FUcESPLM2G1JaLvtx68jAyCZSAD2HLgEAEe2JHhIjjuO4MOWbNiPU1JyCNDebSNJW5LRWyRxpg9SCyDEzLR2peo8b9lmZvx02jdwZgDA1xQPjwlpewZfwwf7E0DineGgbSNBivnDnpn9ewYRMQH91wf6ls08Kih06lnSaUsfamUzdhhCpeoh0kqpPM2Hshh6VBoTBZWkzFZSeYym91L5tXLrw7ZtmZ3Wu573/b6xNcslbhAhOASnhlOl1Nvt7u7u7u67st3qAt3UvRTaEsEhxBax5Wvmk/d9nj9GMqRNf/JXREyAH23bFkmybet5vv83Dw/KGszMKvPQqw+DGXXuy+gBtwClMfQxRGbmMTLT/k8ws98gIvWImAD+f0sB+1rFiWAREA+mX2u4JBqdqRHo9Il87SDeARsv3b2nsa2Jzh6fe/BLjwDefY3ggUt+/rYrhun72Xd+63pw7msAH6N/7bfMAK2hgBl4gYX//psv4OUcJxTu634ICIZ0m+LhPb/++ejOaRK56Tch4lI2NHUS/mIUOYc5hl5xGVFSztzATCR6eel1RDlnsftmlJQzNVPn6K4l22/E5Fy163y0wpmqeSAstk8UzfWVJtXARU3O0RuHEM604Yj7P7Xv6GHXKivD9V3XPEnC5hHkXCQExxlmKzz5/g8+vOrrFR+qPrhV/u6P74chz9eE0fPwWz+84Coxr3nvfcydr9ZPHA7nTcy9FTvX5DpTf+qP/yMbb2hbXTWvSxGsBe2S1cObLzt2ytm55SCrTbjnt58YtcSnipRImRVa1RSCuPbQrU/nzs4dxtMt15grfuft4nwspCKShSgaEI9UK+Yr1aXpypc5d5p/Yta3Fcap73xg3XIr5FF8vRJNElcksV4yPFLzzTDkCn0AO0eozD2AMZsLZN/wmVqrpLuvN5tpWXcNbWaM+JLChdbM7ANi5wbjffRuYGbKysKXxEC6GMjQ9Ey6NJwNW2y46FseP7nh80e9ngvMfXDOWbfWmmFGZQGnnGGybm2ljPjMOe/UV0Zm6tvejp0LJP4uwXdYECUisV7BsT5kw43UNZplblVdzRsh8W/82ZPYVy0REcB8fv2OWKUzRFQDNjPKQIX2fFmZdMF0yWfiTLLzN/1ZGqXDMLOvHiIOjWYGEPldjM6YoWply1+JDKSzUuQatKx6iaVfshN3fmaWPp0zta8C4iQAjI3tmB5aP+qPVbGkS0sFCLwQY+DaoshSFjNpNsemhkamxg9OJNaeay0dPHa0BJzIV5hLAvhdl9949XAwID+hu03ozDNMnBY3TaoMDisxn05vumDX1olJR9+rRx+9/7P3L4B3X0HewdDzX3zrhXD0YMx8JcvzLWk3WzYws7XXaeplQC6B9nU3XnvhliZdo5h1E0/nkc+9ewbEf4U4B1f90Su3wrGH2yObGpWkDNF2YnTmmWDE4b++fTwa3m3gPRr2/M4bNgOmiAj9m5l5gWf/9mpw7itAPNz0HjU4+cCpsenR1cIRtJiuIV0Wo4BR+5nPn3zH140oEX2GELf97P12P2aIeAashll89wvAH04il/3wy8TK9NGjV+zUzEyxqGGrGJ3FqplZ0Vg+cPkGOPSvb0FxfbhoPP87X9mEEMHOph775199Qt3ZJdReezuqiX3Gv3CoZWBKLK0xhQDGUmFq6PDBid11xdP6xWtRkS7O4K4fuAWCcxwyOpn7ZUzOJmHni2uYR4qpa0pxYAql5DMYgOiyECmHssVL1wioJo3Xf/8uogMR5Y4fuwVTJ5y10XPzWs5i45JdBIdRKa9peSeYAkWMG+k0VkpMrRw7NryjSqdF/F1fP4y5yKXf+XzUPGe1KZdsPmsEtg0hgjC52s4TwWMGpkVlyjpgUUG04k7PTNJdfGT4VTdC83V3YuY5642ZaeSsMGGE6EBsY301cw6Mzqj5RGgHBYm5U7X26IKNV3oALnLBdTe/rIF6vhKFqmFnA5xA6Wycv1pmIHSPWs6sEqIa7VIN05HjI0P0v/Dk4mVER9/pYRDCHLafMYvQdY8UeVswEQWsiJXxRYllGWghaqFiKxO+rzj7mDvPROg3aonjYMwdZXfHFzMHIDQsFywKgqk6PxTMWi7EGLQNaBg9tLU06ePRw3opjn5DROjTDAPpMAMRkTMBHj3q5bkR//h+px3I+pBENVEMc44T9z+44xtXXQhFLNvgrbK6fBUE57rk//8dJ/pDlEToambiGGAUkTMw7sE/N57/xgDE0pGQoNFckSbsf/+9R+CV61cSi6WVmZrETf/2L9N3vKhCFAeMD0tgj6oTo9OURASWnp0/vNBebrH0ZH16eNPOndsA1Ppz7Ytwz4WTDUuui2NKojhRwuTxf/7n00Cq1yyZhhhplZgx+i7e9/bZ1339TqKThRoknZYH8QKYkjjyRw7te+jxhZhpvWgnC4HO2kWvuGt7HYf1gbr3Pjeef3SRTpGtJorXJHnrXwCJacmuU5VYhtIXFlTS9j5Jw8PUXvWD13Lq1CXdoQwhAhq94+RH3/95mg2CSypJ4lT1eCagCpN33/zxY4hYLxO9ET84x9aWsy7mNpUWVevHfrLEoyVi1bGjqcUQLDMNOnxwiRLnAvKNPzI0QXcwh6qpJWT3/dsXAXRrao1Kc0hGQhi6/0GnICKRS/Y9+NFHFKwbau/CDS7hdyzSKVpfU2gs0pM/i7cSQGzTymwFDcEHYoijD+AURZxa7fOXZIeuligWzfPMH/w44MXUvXBbs9lIqqmD2kf/qgMQ0fm6O/zFZ5AepuFS3KBEmsdMuzidmMos+NP/RZLTM42ZkxhizDFCrUtnWv7o79IZYiiCqnn2/fbvPYoTDSaEX9ucVJ2IA2kc+G61LuDR5vDw6tMLPSjt9/CDcvFm4jADnBpz9dO/TNI5fSI6hVr+VwG3l+7GMe+sm1FmIZZlkbL/9/ZCokqnyMVro0/TxDnTuG42lwXc8iNrRoaXv3wcsQ7HXdUoA4K7MJeyWkx/Dc+y2IbjbcGMIFOfHcE6jCdyo7eGUGrhOPR7nwWvJd2dTq6JzrukIo44ridYNndC11frSXmqpIvtuBo3IK1ch2PZxZF/wRcdQHBGWkYiw7fnuqgcPun6MOdM8zS+49/Ba6C303IdiZjhkgojckKWgEc2NuvVNJ7MO4jcjAzGxW2CLIhLj98nkW4rvDOIpPCwtkiHuJMHUHqrWfTpl/7nFNUQnCACZmZOT3vnXOqiiJNUtC+X69a0LqZt7RCehw5IdxOTBdD6h3HanwbBmZGYpocRBaefok+NprEePnI/5DmdZnSKZ/n4SsvwtYqhfrik/5lLKjVxia9WTBB2NVQGAldg0uGKL4rRf1KAibbC6AKALz4YxHpoHi3Uj388w19w+9DMxqGqZEfD/JMLB1dhYaVYWVyspiMNhQ3z/blsywZcUvF+ogbCum0Mai19Dz2zwBlHwydqkslJxMQqX/JKd18WpciBvbDuBXe+obL0rEplfHuaSj538Mn75+aOHM+8LehYs+7HizPAXRWrlTSpNDZgYunGASnbkF4p0w8hegYqEMMs2RyrT+HUlT+K0SlUO5Y/fxh32eUjlreCj9E0VNOkWgHuuHht8dT+g7lmvtZYwxlq6/a0mibVWm1snZiykcEa0/3A7c+QlUW0KKaFoIKU4PS8n3PdrFKLQecfiox829J/e8txaqI4NTEzxQvw9Ec+/NBSc/15n/2y64/jcxMZiFDMgDGKDEjQXsKD/6xxPsaQEC0mrsRwIPbro0pXN1LB2sdh/Rs+9ok1WggI6tAogDgwNS9w4B3vfHS0PW99mcTlSuYEotqyGJ5BG2bWDW7pF1dCMCVQqKgzA5/f8HqlUxhOK3VdgXTPffOThZqogZji6FvNCYv3vPUDeNcPQk5MUI0UJwAZWASN3aTFbZeLccvNWzJVlDxI9FEN5Wdd7ELN4+rAkP/cKu2IAzVEEW99AWoe/uMPP08ifXRGL6amxUrpsQEJEQW1DhovwwWnbPiBFx//bE50amWohKoolC+6LfoOS9Ky9CnUhpOYZT6tpl4weqoJrheYeuy/LgPfy2gSPULUwrWEfGDHCKVF7QLvJeecyd1fP/rEQgSHWbFSiUYxDd9ZCXQdCUV1FKobhoeLldWl2eXjx1tStnR8w/Cm0fFUADUn3YDoyX9/Ai9dxPw06gFiaBTC3IAch1CiWZfgPdejgItc9YYNerS0+aJaeCiWG0EtzMAMDhCGXVvWAMNrygcOHD8RimraGLeVils5li+4dOqi8zauT0DNSTeIZk+/GnwXZmYw12Fl0+AENhA4aVFVo3ZpL3q3AWLutqtw06mwvDQZCwvlyV15ITGFNgaYn2plo7jWqfv+7i/fmqSVWtPSeky8H4nqlleXFj//yOmRHZdcNgEq0g0tzd48RdJl54iJdGDNCnF2QMbeUAYwAiCKPimW2La//dHt4I1KPj8qMWg8njp1RZow3yHM+GI9JV52Qb/31fHJ3TdVpBXqRZnlYdMNt141hOK6IC5y07VEIYk//NHAfNRrnHpmYE8vaCFknYjb8km8vuhtL2s6J+LUc3w8JhrL+XKoJF+zlgUAS9es7qibQIQqIPPS2DizubEyn6dta5w23fial24BdR3gjC3XijkX3v5HcQGX8tSSDOyYBMHqROsnW/qdv3WJS7o4YXYsSjC3PD9x1AcaPIsirNctW1RA6RYal40AJBt2TZ8+mSQLFdOqbLn+tosxcx3glKsnsLFTd9sSxv14BuNWvpyUEkRhKhc8+YP/NB68EwGxpPbodBIIokd3GCE5j0MYVp0aeSHChi598/xH//CV9x+F2oaZIU4V1WSoISG5/PWXoNIFp+xYx2tPj9MpfJJBOz4loQTkaSIyccE3bYt4cSIi5ipHskkRDdWjjVqIYZKnMiIbkjtqNhCh/ikzm//s2z9wFCa2nc+S1IhesuqF37AL69I5sfHN/x7dkvn259ABKZ9YcqrtFHTdvDoEYuJFnKN+6tRkwDuWs7GlSrmDp45i6diui1UYqGPzvhg8zL/3bR9Wmpff2XxqKTHTfLZ699fT2zH+d3fhl5QHDsnA5PFHK4+RlhcTsUYlelPFKeIYKfduUG14X8xOPe5Wz+f4o74cnb4LYcCeVz9rani4/6//NWPo5S/ND+YUechP7n4aZ10QTIxl4314Bu3DvZV/B5mPL4OuM3MhliIOnMSJxj3pJr/cTPTJm51fnZmxvVIO3bZJ3aBwyR8e2WBiKo69f/rPGdPf/PxjB6N41fnlR9pYl860sZA+vAsdmOP8J0zBCmt0k6cOlgqYzh869PbLufV7qJgNHV/XoKxu5gsx/vUTFLbjdd9pC+K8RS55YVbh5D1bJ4vGcLVa3bRxdR7pJpyTbrF9n2B7x19e0hZTsqFuRrHgommMS+Xfr4HtXxdNfCyzC9qmu/nSydp3H+h2FD7TNgHES8lHUceJscuGQmOovn7rRrdMn6k98kPUHTzX3p0LJjFWusn2lkXVspp/P3iadzstTdODV4iUl/H0gfrnKOyoz9k4nyJ0+rl7JAL5ZZtCc3RmuDmVrCA5R4wCqP36VndAZM95uZm5cqQLJNuCj1lz9QU4QeT6ocJHDc+Ojsds11j8Qv4yYg8K6ciqo6u5e486M2/LF1xLWq016o3acmA54iC6L1PZ03PyrswASevdrLlOi+aj15EAwua1SVmUJQcbsjq8Rz51H8Gu+sTOBS9dwP4aDDGduRWfJNWKhDKXCE7UTj5Dd8E9c8n2DBGxmrMOscmhxuM3/WFC18pUI5ZROHJs1PLn2yd/QPehZBNTy1WkI/oHPukU8DZyS9MnFcHVr8Q5ynp0309lJzv4yiCCxdigq9j6pbv+JdBVKCdigRI+1KhmVw8tPs3ewbOXZs7R84/UK+C1KtXEm0/T65tgUbW2vxLuhDs+fU0hSAxW6QI2PWeu18K0xEhsPHSw2Z65SpJVugZO7xiLVZEOdY/8l3XgNF90+Eqldnk6kXOUtRdcVthbZP9rE0WDRp8gHcRNQbpAXobVLC81WxgtquGgaF8RmmCfJ1yQ460Dk18l6cAzP1etVCrVoZRTzAXe3vw0z53emOzIMVWLqbcumYh1EVr5fFZmqovV6uq6fUZvgZQIJy4hx65zMRXpiG5/VboAFkK9UqkR9WbO/ImfEfdcOb3ie/93dEOGqmqo0mcTEzpDCCGKRj3cbDWzlu8RqglmpqEuWb5rXakJXUXuxnfzvPylmnqjDsM1Aqh89Bn/nLk/HT71qcvqaqaq5ntIspPoOig9Roi2uNRcWfcovRO1CCokzqU7havz0CPKvbgOSfjGJ3649AlDHcrVmU6D38c/N57Xf9Pc8NN7rw6qMWoIcQ6UC4aRjmgel4ikh6Q1FoLr4qimkACazBdv+I/TJ24oYqx3MV9ciAPn7IftdxbExbiotcZ17UD9R3DPiUj1L6rRDT+Z7wqqMYZQtAWBi7djDsjxNY+U4WBabH0K6+jUBEUAZyo/+ssfzHZPqU13IdovkODxf2i/HfJW1cVQSh3KU12A2/AD0IWE137HiYqrjXyqTtSgGmJ7hMnUOP9qogeLdTIjJktHpVIG3yECCBlEgIDoc/7x+k+uNq4o0/G0x+fEJWy8J3y/+dAqRrLUWmtc1rsE/95e9nQ6uXe4dHi3dG8jYBqjtvbfxryjducWNU8RtJIU0dVPrq5OHgFEBEUkyEwAgcKXfnX46COrN4Xq0FgXNFwKLzlst+CFrM0zOZVSSzRcBz5cjOsydY3jirk/nCP05q++GWIZY8SCm04QAIk8/3YxXFqJ4KdDxW37+zfiQMBiCmC4JA/tMi7l4JOj1cs2F/0r63/yvo2RBNBitTkUfeKRVmdG/23PRcLvLP7lsoDDOaukeVQLYJHRITEAgamvv4EoFCPNdEhZWvyxv9mEExEjySAATXQILktH83j+lO6rpqecc7zhLd9Zqvd0hmJ1BudEXGRM5A1DQXotGjMiyZeffFhqyeRcLielqXZgeTKF0ekCL/j+ncRYUrPKUiu75md+pcNJYmITaEyFQ3ucZVPbeJRqKUu7dhwqHD3zJbe+9E5coczEtbfgzmjRs6f9uaESpVmyFaUUVYnRVFv5KVwEEFFe/r3bsNBeaK/E6jUX/8U3kiAmgIQGmGBuYXdNEhvaxsM4ncOkopHeViysqZQdhQAwezkyqIRfso9cEE5jSMcfOERmWoYihOKZfasQ1DAJDH3LTz47i4Yi14te9Oq/vwLHfBgRmYrgzHaRJuIv5WBwSc4hY3muvShXyulMcBFZJk5uqsZBOT6+/OGLtFjMEMZP/PvyclaEIhaUxerpB/ZFL4apSlaOXLIlzrbRUN+087of3CoO0kiwJUlLRI5dK4hU2MnREySdQzELvSLlN7xtKkuTCIyJnXeh+cEIw6eO/G9RQ1Gd/OM/du2nNrfbtDSUcyuysv8x9S7EEENst9Pte7boqQxgeLt3IJgQlDIUcO0doybg2CgLh0mcExoUvQLztzcf/PWQClFqBYjyfGQwnuvtiXtLSEqYycvucUZtu2/HkLfn25n5w58+UEpaxqgWipVy+soXXvk9e5p0NQyNiBwfP36M06ErzAHC2hGO0F2RPHbRyP4Lpz/Or6xbcRGRTowrGbBwAXl2Qm2BH94nEnBmmybyolUWoRTSsDq1e/eM5K0Sh0bXGHKrBx878OVnn8iWA52FVte84BtfkfLlZTG6TIxznOwwKsE61PPZQySOS8p2C5KxJGpcQBgMXEqanUJMUur78IqKtZpTYckycxJNqpr79RedPyWtVmnOacBZWlNbCiePh3ahyX//13//7kunqhw94ozu9RFm6W/ECOo48qFVHDg+YyulZTTJEPMN08iZOFF20SyGUABLD9DTWqNNK3xFA6qpK1aDTl28a20zsbzIY5HHHFfxSQWzcp7P/d3bPrZA8SxGV7HKOKfOYCiEaI4PfRxvQMJP2JKirbUQ8+bIgIwJmrFdIKHElV7OVtxoUpRFWRSleR9YWg3N8Zkt69eO1J2oKRpCWF48+fT+vX/w9gfLuuRLGL11ldPYRVl4Hvi342AAniu1/T8lMwmxSNeeiUzFXJNm9XdXFSGT1kmsW+dydTTBuyhmIllugsRUGubTtFoTK1fmw0qrvbrcnqgFI67SZ5RPfJFl+ivJ+JP/+CG80lWoPGP/N2kNNJZuLQP2VWTDT86nAi1dNPp1Vi4xpK3MMJGiMElr4rKYaStqlBiNKEkoNBkvS6NN/78ZKbFDqD3xg1cEMHo63mePCmDLUMZAb1cIsOOnoWIz7/oCIfuBq5dUzfJoKmmaaBZLVYfFJJOyzCw6V9Vxjzj6jf79H0xReo2V7/qHZa/0mfCrlppkZoxBXTdlZQzomt//NlvFNBplf4j76K0M+yeO59WEpG5RshIocMQslKvBSBo2a1RH6dcRfgZB+gJf887o1/PtFmOSNsoyxtBtvWaoPPNYiFaoFX4z0peY3zCx7cpbZx975FSbRl1L1TbOR5OoVrSrlFHiCccLnkev4N/8kI9Uya7GWKTfmMWXop5oiIsM1sSWEOOBxSQiMY9TnKlP/OTM5EqxcuLoiYXTQ7q4EksIYkEKCp/aanteePWr6NPjP+cMEvrTlDNUiqISEXNqItZexAaB4yQgp48mRVhutdo7sTMQh9XXtNvtUGbtp/+yXi5XKJNCiKn5WtEqJMAPPB97nK756ZOiQv0MxJ+BMBxPrss8quJA8lXO2InwGCZw4vjS4lJYXji/odKfBsBBCGXmjn4meF9Lar5MnTMCiYhn7E9J6RXe8BYfgfVkF3YGsCGsjOYOMY3OaiccdiaLexGAo0eWomZL43tw/cVIb+P0+Cktluhb4I5fIUiv2J6NYgBr6I/hTNId0740RIgilj6N6ECUh9V1sBDUZXPzt2FnsNKP5MPmkC7WkUTd9EsbiVV6JU5dak4H0VrEepxduL7qgxpiONV0P24wxiNPiXZQHR2bW51df6m6PszbLNYDk2kE6wI4CfJ934JZSq8Ye5AIRHZgV7ZMv6ITLyraJkGdiYmJ7WXA5rNPmDkwWLMltBYPPj81WUKY6yf67QjdxRG59ZcgpEJ/XERXsfomosNol305vnWN9waiBDzJ7LPoYPC8yqIHBNbe98WltPbMe530gifpM7mQ7uJL5aqfGmOMgX5he82k23qh/3gh1iuJb3xRrI1PVIIGk1LzxvaWY8DCyCGlZ/6xdx5rrrv/Y076eKYf2YOCOEJMbv/WTVgOrBSbXKtCtyuIdhgncHQXF17+HfNJZWRYgkZP0NZWZwPD8zsWpZtw9P17w4YvgO9mHMD3Cq4cWU4sRja87uuAmMhKYfPVpuK77cFY0TMp9Zt+qR0lziShDMHHGOO2Y8bAnZy/ql66YMKR/Yf5jjreS5cjrYbJnG16z0cCtRe9cQ+oec9aE73yTd+7O4I3VS5GeuARBBAXw8RP/9yKc2l7M3lU9cHaY9XSDw7PXzW0B4aw8tR9f3AZIB5JTjyz21hs3PlHz7v9lvMgSiIM0I4/1PqR+/70RZKD1Lf353gMnBA0fe0bnzopTouwM89DMErL1j7Dc+lk8+vV9wBD0NXDf3PzGF0/+y0KJAlh3/PwGKi5hIG2ssX5Z45d8GePffgjH9hbbDfzXfq4NzVm7vrmpScfRqOVjfNOl1q4aGE0a8tzgefV4wGsGxjWefxT/33ksXyugrNRWxAwTDTnGKjRmrMywurixh+965r4LoiuQ3nqQIwbn3/XpRQHm3W14IotYyfKEGM7K+pPCN3dRnzyStBoPcBUg5oZXR0VKlPDM1gTWtXRUWei3mWrC9WLr67g6J696Zfv2w+sMGaRkLfnrg/zFi0vF6pPhF5bRzzvsugwsx6gQWtAKL2ysTqOFetqY2dNLNfBTlfXI/0I6/7ge68fGmnDiKZp4h+ZiYVa0i7L7ewvXDqqIk6k19TgoGaU+083ZoZqVaHFBVbswM5gPl9cKc6MNCWtjyy3184Tal6zGTkLELahIlAG6+OwmvDQh4+l0Vf8UEoEZYjmd3KGWbteqbhszaCRNkdOnZctlTGJ5XDF5ABAAwlRoxZ5PLsUVv7tHQfbvgziaimlRB0o1owg/RinQ+pExlEziGTST4zvX14plkpLjAErYIeRIaoayjJvSRzF1PPx94f2PW87PilRNKLWU9VwIdYXLKRp6mU0x9rIdKi+7eD8womlU23jue0BZtsuK8toiJDofhYTDv7Hw3h99tdu+nuZSBL1dL4oGucj9CtxpZ6KKNnACPE7lmfj4rMnDmacoR3O9AtPPOYlgHg1pxp7qHmO/+N7cIpRvHnPnn9xtzHKcL5uX4H1lczldZ8IrREjjnFbfiSdn1s8opzVxr77WvUQwMyMSIjqVqbiOPwXfzuPKGBw5MenL/hae3BhPT8ruZwznU0rlQQdiREf3myff6jIw5EvInZWTV/0kZDNz4uImEOcqZOBaDCzB39gDIosW2DHb++bf/rTb/4x2SfZ/EjiE4mGiS5vvvKHX/zqF973Ojm+eNw3fK4IrULEg0eMwZqdftsdDqr0h4exb/iX//2Xf0WfyZFQTR2oWWzXri7+5rNf/vBbBvB44CC56z9fMF22CpckqslAzPa+cQOQCOudB9a8n0a3hEO1apoIlHl9+9hH//Smp99QQfrdxg0QD2y987YrZ6pEI4p08dIjFkXun7qAqhcGKxUuXTW7TJ6Y34JFlcro1OoH31zMDAPByuTA4p3Cmsuv2b1r42iFPk3LIpbmamPe5i4jYVCJf8AaKx9cv26yBvnph+/9bBVA2VKPAjinCiTTk5um1o9WJJZfN9FWxFdGqgIEO34F6YBSftMC3WXyX+9bO15vxYVHTtIpDDiTY4sT1Vl6f+9f5KkIPS3Y3E0ksoGkvM5KXWgoKq0foLc4M7NB3UlBRDqEf3x4twp9WLD210FZ5YXXZFFtprWmQt783ZgqAmamyuB1jYfo9dxswWwJkPM7Hyzh1XqJw9LLq46eZYgxSPG6kajJ/e95i5X9YePp33hbxIsZIBLgxltQurvQzvJSV3fcpI6Dus4ZD+Lc1BGLfZjwhT9/1wI9k+d953WY9JCiLNplyV2cKz03W7APxDH7sY/vP5b5sd3X3XwJCD0lhtKKYuHaKXNfNdyJhJ+wdAWoeaAMrgqoCT2tKEIedXlql3J2ilu5JPt7/o4tLeIF0JKK0NWQGMtYxCzdiZwVsqcLRxRXfQGRqzoN0UAq9IwarSzzIt/IV7ALh3bc3uImoMEldBdCVpYhxqjjIF85qz0EQZIFxAZg5uhukMcYTc00TZIncLFSIJj0SkB6mlC0FI0YcVWNJ69AtrJYpgAGNJVOg6XlGM1icOG48tx6N8S9MFaOZCfrE41UANIxRxQnAsLKyVYo8hBCOvcU8hzdTTnmyoOnG1m9KnXvHEvWoJgX76Q9u6DEGHJzTxxA7KuOHNQcn/+Z69t5xbm0lihFw3mnrYXF6AUrrXrqI09zFnq845rgXvuNW3NN04iIomllq11qYmVZ0sw+/uGAnQV324mbgSljr737/NgeqZBtDBEnoFIbXf3Yfz2JVwbr3XJGJ92C68DD8Gv+9jPDIQ8lgOCoVP2Pvv7510IE968cXjxw/g2X75iqVAywUM4/te+NZ4hgSwXv1LzbuBGIF6C+YWJTPZFYHD41uwSUYFPZ0ruwsYibAE5M6VdcyMYzrrknBZA9RZBuZsaO0qn3hzgD7vA1oaD3jffLExlWUDgg7gAAADASAJ0BKqAAoAA+KRCGQiGhC8fqAAwBQlpbuDAAAsbHwB/APwA/QD+Qfv73+ESZ+zGcvaPfwnLnJJSvQ/GJGfPRYADLKiBT/7cpeSmcf05YyO4JS6/tf0is67kUo7Ucddw9qP9x9rS1lsxk9O8/oinYrywyKxwCxNI513G3pPriulHlhzCXuUL/CwExNUcGPoKIfnnbqiaYgQAA/u56sP1Sj7XGQgf//8cFTH6oheqaAt/qlH2uAARX6qCVHlawI39VGL9VXv1YH95V7MqPeVe4r9VFL+qpf9VpfX9o//kQd/1UvPqqKP///sLQAAA=";
const logo=(c="")=>`<img class="logo ${c}" src="${LOGO_S}" alt="" draggable="false">`;
["sMark","hMark","mLogo","eMark"].forEach(i=>$(i).innerHTML=logo());
{const im=new Image();im.onload=()=>{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");x.fillStyle="#000";x.beginPath();x.arc(32,32,32,0,7);x.fill();x.drawImage(im,9,9,46,46);document.querySelector("link[rel=icon]").href=c.toDataURL("image/png")};im.src=LOGO_S}

/* ===== Intro ===== */
const intro=$("intro"),icon=$("iIcon"),root=document.documentElement,appMode=root.classList.contains("app-mode");
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
let flown=false;
const seen=el=>{const r=el.getBoundingClientRect();return el.getClientRects().length>0&&r.width>0&&r.right>0&&r.left<innerWidth&&r.top<innerHeight};
function flyIn(){
if(flown)return;flown=true;
intro.classList.add("fly");root.classList.add("reveal");
icon.getAnimations().forEach(x=>x.cancel());icon.style.opacity=1;
const done=()=>{root.classList.add("landed");setTimeout(()=>intro.remove(),120)};
const tg=[$("hMark"),$("sMark")].find(seen);
if(!tg||!icon.animate){done();return}
const a=icon.getBoundingClientRect(),b=tg.getBoundingClientRect();
const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2),k=b.width/a.width;
icon.animate([{transform:"translate(0,0) scale(1)"},{transform:`translate(${dx}px,${dy}px) scale(${k})`}],{duration:RM?1:850,easing:"cubic-bezier(.65,0,.35,1)",fill:"forwards"}).onfinish=done}
function startIntro(){
"ROCKGPT".split("").forEach((c,i)=>{const sp=document.createElement("span"),n=document.createElement("i");n.textContent=c;n.style.animationDelay=((appMode?.15:1.0)+i*.05)+"s";sp.appendChild(n);$("word").appendChild(sp)});
const DUR=appMode?1500:(RM?1200:2600);
intro.onclick=flyIn;addEventListener("keydown",flyIn,{once:true});
requestAnimationFrame(()=>{intro.classList.add("go");
if(!appMode){icon.style.opacity=1;
icon.animate(RM?[{opacity:0},{opacity:1}]:[{opacity:0,clipPath:"circle(0% at 50% 50%)",transform:"rotate(-80deg) scale(.84)"},{opacity:1,clipPath:"circle(74% at 50% 50%)",transform:"rotate(0deg) scale(1)"}],{duration:RM?500:1350,delay:RM?0:150,easing:"cubic-bezier(.22,1,.36,1)",fill:"backwards"})}
setTimeout(flyIn,DUR)})}
let forceIntro=false;try{forceIntro=!!sessionStorage.getItem("rg_force");sessionStorage.removeItem("rg_force")}catch(e){}
if(SET.intro||forceIntro)startIntro();else{root.classList.add("reveal","landed");intro.remove()}

/* ===== Theme ===== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem("rockgpt_theme",t)}catch(e){}
document.querySelector('meta[name=theme-color]').content=t==="light"?"#ffffff":"#0d0d0d";
document.querySelectorAll("#tseg button").forEach(b=>b.classList.toggle("on",b.dataset.t===t))}
$("tseg").onclick=e=>{const b=e.target.closest("button");if(b)setTheme(b.dataset.t)};
setTheme(document.documentElement.dataset.theme||"dark");

/* ===== Viewport ===== */
const setVH=()=>{document.documentElement.style.setProperty("--vh",(window.visualViewport?visualViewport.height:innerHeight)+"px");scrollTo(0,0)};
setVH();addEventListener("resize",setVH);if(window.visualViewport){visualViewport.addEventListener("resize",setVH);visualViewport.addEventListener("scroll",setVH)}

/* ===== Sidebar ===== */
const isM=()=>matchMedia("(max-width:820px)").matches;
$("menu").onclick=()=>isM()?app.classList.toggle("m-open"):app.classList.toggle("collapsed");
$("back").onclick=()=>app.classList.remove("m-open");
const rs=$("rs");
rs.addEventListener("pointerdown",e=>{app.classList.add("drag");rs.setPointerCapture(e.pointerId)});
rs.addEventListener("pointermove",e=>{if(app.classList.contains("drag"))document.documentElement.style.setProperty("--sw",Math.min(420,Math.max(240,e.clientX))+"px")});
rs.addEventListener("pointerup",()=>app.classList.remove("drag"));

/* ===== Markdown ===== */
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const inl=s=>esc(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g,"$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g,"<br>");
const md=t=>t.split("```").map((p,i)=>{
if(i%2){const n=p.indexOf("\n"),lang=n>-1?p.slice(0,n).trim():"",code=n>-1?p.slice(n+1):p;
return `<pre><div class="ph"><span>${esc(lang||"code")}</span><button class="cc" type="button">Copy</button></div><code>${esc(code.replace(/\n$/,""))}</code></pre>`}
return p.split(/\n{2,}/).filter(b=>b.trim()).map(b=>{const L=b.trim().split("\n"),m=L[0].match(/^(#{1,3}) (.+)/);
if(m&&L.length===1)return `<h${m[1].length+2}>${inl(m[2])}</h${m[1].length+2}>`;
if(L.every(l=>/^[-*] /.test(l)))return "<ul>"+L.map(l=>`<li>${inl(l.slice(2))}</li>`).join("")+"</ul>";
if(L.every(l=>/^\d+[.)] /.test(l)))return "<ol>"+L.map(l=>`<li>${inl(l.replace(/^\d+[.)] /,""))}</li>`).join("")+"</ol>";
if(L.every(l=>/^>/.test(l)))return "<blockquote>"+inl(L.map(l=>l.replace(/^> ?/,"")).join("\n"))+"</blockquote>";
if(/^---+$/.test(b.trim()))return "<hr>";
return `<p>${inl(b.trim())}</p>`}).join("")}).join("");

/* ===== State (chats stored per account) ===== */
const UK="rockgpt_user";
let user=null;try{user=JSON.parse(localStorage.getItem(UK)||sessionStorage.getItem(UK)||"null")}catch(e){}
const ck=()=>"rockgpt"+(user?":"+user.email:"");
const loadChats=()=>{try{return JSON.parse(localStorage.getItem(ck())||"[]")}catch(e){return[]}};
let chats=loadChats(),cur=null,busy=false,pending=[];
const save=()=>{try{chats.sort((a,b)=>(b.t||b.id)-(a.t||a.id));localStorage.setItem(ck(),JSON.stringify(chats.slice(0,40)))}catch(e){}};
const emptyOn=()=>app.classList.add("is-empty"),emptyOff=()=>app.classList.remove("is-empty");
const nearB=()=>sc.scrollHeight-sc.scrollTop-sc.clientHeight<150;
const toB=()=>sc.scrollTo({top:sc.scrollHeight,behavior:"smooth"});

let q="";
const PIN='<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/></svg>',BIN='<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',REN='<svg viewBox="0 0 24 24"><path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z"/></svg>';
function renderHist(){
$("ctitle").textContent=cur?cur.title:"";$("exp").hidden=!(cur&&cur.msgs.length);
hist.innerHTML="";
const f=chats.filter(c=>!q||c.title.toLowerCase().includes(q)||c.msgs.some(m=>(m.content||"").toLowerCase().includes(q))).sort((a,b)=>(b.t||b.id)-(a.t||a.id));
const s0=new Date().setHours(0,0,0,0),D=864e5,bk=c=>{const t=c.t||c.id;return t>=s0?"Today":t>=s0-D?"Yesterday":t>=s0-7*D?"Previous 7 days":"Older"};
const grp=(label,arr)=>{if(!arr.length)return;const h=document.createElement("div");h.className="hl";h.textContent=label;hist.appendChild(h);
arr.forEach(c=>{const d=document.createElement("div");d.className="it"+(cur===c?" on":"")+(c.pinned?" pinned":"");
d.innerHTML='<span></span><button class="ia" data-a="pin" aria-label="Pin chat">'+PIN+'</button><button class="ia" data-a="ren" aria-label="Rename chat">'+REN+'</button><button class="ia" data-a="del" aria-label="Delete chat">'+BIN+'</button>';d.firstChild.textContent=c.title;
d.onclick=e=>{if(e.target.closest("input"))return;const x=e.target.closest("[data-a]");
if(x){e.stopPropagation();const a=x.dataset.a;if(a==="pin"){c.pinned=!c.pinned;save();renderHist();toast(c.pinned?"Chat pinned":"Chat unpinned")}else if(a==="ren")rename(c,d);else delChat(c);return}
openChat(c)};hist.appendChild(d)})};
grp("Pinned",f.filter(c=>c.pinned));
const rest=f.filter(c=>!c.pinned);["Today","Yesterday","Previous 7 days","Older"].forEach(k=>grp(k,rest.filter(c=>bk(c)===k)));
if(q&&!f.length){const n=document.createElement("div");n.className="nores";n.textContent="No chats found";hist.appendChild(n)}}
function rename(c,d){const sp=d.firstChild,i=document.createElement("input");i.className="rn";i.value=c.title;i.maxLength=60;sp.replaceWith(i);i.focus();i.select();
let done=false;const fin=ok=>{if(done)return;done=true;if(ok&&i.value.trim()){c.title=i.value.trim();save()}renderHist()};
i.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")fin(true);if(e.key==="Escape")fin(false)};i.onblur=()=>fin(true)}
function delChat(c){if(busy&&cur===c){toast("Wait for the reply to finish");return}
const idx=chats.indexOf(c),was=cur===c;chats=chats.filter(z=>z!==c);if(was)newChat();save();renderHist();
toast("Chat deleted",{label:"Undo",fn:()=>{chats.splice(Math.min(idx,chats.length),0,c);save();renderHist();if(was)openChat(c)}})}
$("sqb").onclick=()=>{const sd=$("side");sd.classList.toggle("sq");if(sd.classList.contains("sq"))$("sq").focus();else{q="";$("sq").value="";renderHist()}};
$("sq").oninput=e=>{q=e.target.value.trim().toLowerCase();renderHist()};
function newChat(){if(busy){toast("Stop the current reply first");return}cur=null;list.innerHTML="";emptyOn();pending=[];tray.innerHTML="";fit();renderHist();app.classList.remove("m-open")}
function openChat(c){if(busy){toast("Stop the current reply first");return}cur=c;list.innerHTML="";emptyOff();
c.msgs.forEach(m=>m.role==="user"?userRow(m.content,m.files||[],true):histAi(m));markLast();
renderHist();app.classList.remove("m-open");sc.style.scrollBehavior="auto";sc.scrollTop=sc.scrollHeight;sc.style.scrollBehavior=""}
$("new").onclick=newChat;
$("new2").onclick=()=>{const b=$("new2");b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop");newChat()};

/* ===== Account ===== */
function renderAcct(){const a=$("acct");
if(user){a.innerHTML='<div class="me"><span class="av"></span><div><span></span><small></small></div><button>Log out</button></div>';
a.querySelector(".av").textContent=(user.name||"?")[0].toUpperCase();
a.querySelector("div span").textContent=user.name;a.querySelector("small").textContent=user.email}
else a.innerHTML='<div class="auth"><button data-m="in">Log in</button><button class="fill" data-m="up">Sign up</button></div>';
$("hello").textContent=user?"What should we work on, "+user.name.split(" ")[0]+"?":"What should we work on?"}
$("acct").onclick=e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.m)openM(b.dataset.m);else logout()};
function afterAuth(){closeM();chats=loadChats();cur=null;list.innerHTML="";emptyOn();pending=[];tray.innerHTML="";renderAcct();renderHist();fit()}
function setUser(u,rem=true){user=u;(rem?localStorage:sessionStorage).setItem(UK,JSON.stringify(u));afterAuth()}
function logout(){user=null;localStorage.removeItem(UK);sessionStorage.removeItem(UK);afterAuth()}

/* ===== Account modal ===== */
let mode="in",pend={};
const fld=(ic,t,ph,id,eye)=>`<label class="fld">${sv(ic,17)}<input id="${id}" type="${t}" placeholder="${ph}">${eye?`<button type="button" class="eye" data-for="${id}" aria-label="Show or hide">${sv("eye")}</button>`:""}</label>`;
const hero=(h,p)=>`<div class="hero"><div class="shield">${sv("shield",24)}</div><h3>${h}</h3><p>${p}</p></div>`;
const soc=`<div class="or">OR CONTINUE WITH</div><button class="pbtn g" id="goog">${GG}Continue with Google</button>`;
const E='<div class="err" id="err"></div>';
function view(m){mode=m;
$("tabs").dataset.m=m==="up"?"up":"in";
document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.m===m||(m==="code"&&b.dataset.m==="up")));
$("mbody").innerHTML={
in:hero("Welcome Back","Sign in with your email and password to access your chats.")+fld("mail","email","Email Address","em")+fld("key","password","Password","pw",1)+
`<div class="chk"><label><input type="checkbox" id="rem" checked>Remember session</label><button class="lk" data-go="forgot">Forgot password?</button></div>${E}<button class="pbtn" id="go">Sign In →</button>`+soc+
`<div class="sw">Don't have an account? <button class="lk" data-go="up">Sign Up</button></div><div class="sw"><button class="lk quiet" id="guest">Continue as guest</button></div>`,
up:hero("Create Your Account","Create an account to unlock cloud sync, personal memory & higher limits.")+fld("user","text","Full Name","nm")+fld("mail","email","Email Address","em")+fld("key","password","Create a strong password (min 8 chars)","pw",1)+fld("key","password","Confirm your password","pw2",1)+
`<div class="chk"><label><input type="checkbox" id="tos">I agree to the&nbsp;<a class="lk" href="#" onclick="return false">Terms of Service</a>&nbsp;and&nbsp;<a class="lk" href="#" onclick="return false">Privacy Policy</a>.</label></div>${E}<button class="pbtn" id="go">Send Verification Code →</button>`+soc+
`<div class="sw">Already have an account? <button class="lk" data-go="in">Sign In</button></div>`,
code:hero("Check your email",`Enter the 6-digit code we sent to ${esc(pend.email||"")}.${CONFIG.AUTH_URL?"":" Demo mode: any 6 digits work."}`)+
`<label class="fld">${sv("shield",17)}<input id="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code"></label>${E}<button class="pbtn" id="go">Verify &amp; Create Account</button><div class="sw">Wrong email? <button class="lk" data-go="up">Go back</button></div>`
}[m]}
function openM(m){view(m);modal.classList.add("on");app.classList.remove("m-open")}
function closeM(){modal.classList.remove("on")}
$("mx").onclick=closeM;modal.onclick=e=>{if(e.target===modal)closeM()};
addEventListener("keydown",e=>{if(e.key==="Escape")closeM()});
$("tabs").onclick=e=>{const b=e.target.closest("button");if(b)view(b.dataset.m)};
$("mbody").onclick=e=>{const t=e.target.closest("button");if(!t)return;
if(t.classList.contains("eye")){const i=$(t.dataset.for);i.type=i.type==="password"?"text":"password"}
else if(t.id==="go")submit();else if(t.id==="goog")google();else if(t.id==="guest")closeM();
else if(t.dataset.go==="forgot")forgot();else if(t.dataset.go)view(t.dataset.go)};
$("mbody").onkeydown=e=>{if(e.key==="Enter"&&e.target.tagName==="INPUT"&&e.target.type!=="checkbox"){e.preventDefault();submit()}};
const msg=(t,ok)=>{const x=$("err");if(x){x.textContent=t;x.className="err"+(ok?" ok":"")}};
const val=id=>($(id)?.value||"").trim();
const okMail=s=>/^\S+@\S+\.\S+$/.test(s);
async function submit(){const b=$("go"),lab=b.innerHTML;msg("");
try{
if(mode==="in"){if(!okMail(val("em")))throw Error("Enter a valid email address.");if(!$("pw").value)throw Error("Enter your password.");
b.disabled=true;b.textContent="Signing in…";const rem=$("rem").checked;
const r=await auth("signin",{email:val("em"),password:$("pw").value,remember:rem});setUser(r.user,rem)}
else if(mode==="up"){if(!val("nm"))throw Error("Enter your full name.");if(!okMail(val("em")))throw Error("Enter a valid email address.");
if($("pw").value.length<8)throw Error("Password needs at least 8 characters.");if($("pw").value!==$("pw2").value)throw Error("Passwords don't match.");
if(!$("tos").checked)throw Error("Accept the Terms of Service and Privacy Policy to continue.");
b.disabled=true;b.textContent="Sending code…";await auth("signup",{name:val("nm"),email:val("em"),password:$("pw").value});pend={name:val("nm"),email:val("em")};view("code")}
else{if(!/^\d{6}$/.test(val("code")))throw Error("Enter the 6-digit code.");
b.disabled=true;b.textContent="Verifying…";const r=await auth("verify",{...pend,code:val("code")});setUser(r.user)}
}catch(e){msg(e.message);b.disabled=false;b.innerHTML=lab}}
async function forgot(){if(!okMail(val("em")))return msg("Enter your email above, then tap Forgot password.");
try{await auth("forgot",{email:val("em")});msg(CONFIG.AUTH_URL?"Reset link sent. Check your inbox.":"Demo mode: no email is sent.",1)}catch(e){msg(e.message)}}
function google(){if(CONFIG.GOOGLE_URL)location.href=CONFIG.GOOGLE_URL;else setUser({name:"Google User",email:"google.user@local"})}

/* ===== Attachments ===== */
const ico='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5"/></svg>';
function thumb(f,big){
if(f.url&&f.type.startsWith("image/")){const i=document.createElement("img");i.src=f.url;return i}
if(f.url&&f.type.startsWith("video/")){const v=document.createElement("video");v.src=f.url;v.muted=true;v.playsInline=true;if(big)v.controls=true;return v}
const d=document.createElement("div");d.className="fc";d.innerHTML=ico+"<span></span>";d.lastChild.textContent=f.name;return d}
function addFiles(fl){[...fl].forEach(f=>{const o={name:f.name,type:f.type||"",file:f,url:/^(image|video)\//.test(f.type)?URL.createObjectURL(f):""};pending.push(o);
const p=document.createElement("div");p.className="pv";p.appendChild(thumb(o));const x=document.createElement("i");x.textContent="×";
x.onclick=()=>{pending=pending.filter(q=>q!==o);p.remove();fit()};p.appendChild(x);tray.appendChild(p)});fit()}
$("clip").onclick=()=>$("file").click();$("file").onchange=e=>{addFiles(e.target.files);e.target.value=""};
comp.addEventListener("dragover",e=>{e.preventDefault();comp.classList.add("over")});
comp.addEventListener("dragleave",()=>comp.classList.remove("over"));
comp.addEventListener("drop",e=>{e.preventDefault();comp.classList.remove("over");addFiles(e.dataTransfer.files)});
input.addEventListener("paste",e=>{const f=[...e.clipboardData.files];if(f.length){e.preventDefault();addFiles(f)}});
const readF=(f,m)=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(x.result);x.onerror=()=>r(null);m==="t"?x.readAsText(f):x.readAsDataURL(f)});
const pack=fs=>Promise.all(fs.map(async o=>{const a={name:o.name,type:o.type};
if(o.file.size<5e6){if(o.type.startsWith("image/"))a.dataUrl=await readF(o.file);else if(/^text|json|javascript/.test(o.type)||/\.(md|csv|py|js|html|css|txt)$/.test(o.name))a.text=await readF(o.file,"t")}return a}));

/* ===== Voice input ===== */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null;
if(!SR)$("mic").hidden=true;
$("mic").onclick=()=>{if(rec){rec.stop();return}
rec=new SR();rec.interimResults=true;rec.lang=navigator.language||"en-US";const base=input.value;
rec.onresult=e=>{input.value=(base+" "+[...e.results].map(r=>r[0].transcript).join("")).trim();fit()};
rec.onend=rec.onerror=()=>{rec=null;$("mic").classList.remove("rec")};
rec.start();$("mic").classList.add("rec")};

/* ===== Rows + send ===== */
const EDIT='<svg viewBox="0 0 24 24"><path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z"/></svg>';
function userRow(t,files,quiet){const d=document.createElement("div");d.className="msg user";if(quiet)d.style.animation="none";
if(files.length){const a=document.createElement("div");a.className="att";files.forEach(f=>a.appendChild(thumb(f,true)));d.appendChild(a)}
if(t){const b=document.createElement("div");b.className="bub";b.textContent=t;d.appendChild(b);const e=document.createElement("button");e.className="ued";e.setAttribute("aria-label","Edit message");e.title="Edit message";e.innerHTML=EDIT;e.onclick=editLast;d.appendChild(e)}
list.appendChild(d)}
function markLast(){list.querySelectorAll(".msg.user.canedit").forEach(x=>x.classList.remove("canedit"));if(busy)return;const u=list.querySelectorAll(".msg.user");if(u.length)u[u.length-1].classList.add("canedit")}
const THINK='<span class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="tlabel">Thinking</span></span>';
const CPY='<svg class="cp" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 017.5 4H15"/></svg><svg class="ck" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const TUP='<svg viewBox="0 0 24 24"><path d="M7 10v10M7 10l4-7a2 2 0 012 2v3h5.3a2 2 0 012 2.3l-1.2 6A2 2 0 0116.1 20H7"/></svg>';
const SPK='<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/></svg>';
const SHR='<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"/></svg>';
const FIC='<svg viewBox="0 0 24 24"><path d="M5 5v6a3 3 0 003 3h11M15 9l4 5-4 5"/></svg>',FUP=["Explain more","Give an example","Make it shorter","Translate to Hindi"];
const RGN='<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4"/></svg>';
function histAi(m){const r=aiRow(true);r.body.innerHTML=md(m.content);addActions(r.col,m.content,m)}
let spkBtn=null;
function speak(t,btn){const sy=window.speechSynthesis;if(spkBtn===btn&&sy.speaking){sy.cancel();return}
sy.cancel();const plain=t.replace(/```[\s\S]*?```/g," code block ").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/[`*#>_]/g,"");
const u=new SpeechSynthesisUtterance(plain);u.lang=navigator.language||"en-US";
u.onend=u.onerror=()=>{btn.classList.remove("sel");if(spkBtn===btn)spkBtn=null};
if(spkBtn)spkBtn.classList.remove("sel");spkBtn=btn;btn.classList.add("sel");sy.speak(u)}
function addActions(col,text,m){const a=document.createElement("div");a.className="acts";
const bt=(k,l,svg)=>`<button class="ab" data-k="${k}" aria-label="${l}" title="${l}">${svg}</button>`;
a.innerHTML=bt("copy","Copy",CPY)+bt("up","Good response",TUP)+bt("dn","Bad response",TUP)+("speechSynthesis" in window?bt("sp","Read aloud",SPK):"")+(navigator.share?bt("share","Share",SHR):"")+bt("rg","Regenerate",RGN);
if(m&&m.fb)a.querySelector(`[data-k=${m.fb}]`).classList.add("sel");
a.onclick=async e=>{const x=e.target.closest(".ab");if(!x)return;const k=x.dataset.k;
if(k==="copy"){try{await navigator.clipboard.writeText(text)}catch(_){}x.classList.add("ok");setTimeout(()=>x.classList.remove("ok"),1400)}
else if(k==="up"||k==="dn"){const on=!x.classList.contains("sel");a.querySelectorAll("[data-k=up],[data-k=dn]").forEach(y=>y.classList.remove("sel"));if(on)x.classList.add("sel");if(m){m.fb=on?k:null;save()}toast(on?"Thanks for the feedback":"Feedback removed")}
else if(k==="share"){try{await navigator.share({text})}catch(_){}}
else if(k==="sp")speak(text,x);else if(k==="rg")regen()};
col.appendChild(a);
if(!/^Couldn't reach|^\*Stopped/.test(text)&&text!=="(No response)"){const f=document.createElement("div");f.className="fups";
f.innerHTML=FUP.map(x=>`<button class="fup" data-t="${x}">${FIC}${x}</button>`).join("");
f.onclick=e=>{const b=e.target.closest(".fup");if(b&&!busy){input.value=b.dataset.t;send()}};col.appendChild(f)}}
function spinDown(mark){const el=mark.querySelector(".logo");if(!el)return;
const mx=new DOMMatrix(getComputedStyle(el).transform),a=(Math.atan2(mx.b,mx.a)*180/Math.PI+360)%360;
mark.classList.remove("live");el.style.animation="none";
let to=360;if(360-a<110)to=720;
el.style.transform=`rotate(${to}deg)`;
if(el.animate)el.animate([{transform:`rotate(${a}deg)`},{transform:`rotate(${to}deg)`}],{duration:1200,easing:"cubic-bezier(.16,1,.3,1)"})}
function aiRow(quiet){
const d=document.createElement("div");d.className="msg ai-msg";if(quiet)d.style.animation="none";
d.innerHTML=`<div class="ai-mark${quiet?"":" live"}" aria-hidden="true">${logo("ai-logo")}</div><div class="ai-content"><div class="body">${quiet?"":THINK}</div></div>`;
list.appendChild(d);
return{body:d.querySelector(".body"),mark:d.querySelector(".ai-mark"),col:d.querySelector(".ai-content")}}

let ctl=null,lastPacked=[];
async function reply(){
const{body,mark,col}=aiRow();toB();
let target="",shown=0,fin=false,go=false,stopped=false;
const tick=()=>{
if(shown<target.length){shown+=Math.max(1,Math.ceil((target.length-shown)/24));
body.innerHTML=md(target.slice(0,shown))+(fin&&shown>=target.length?"":'<span class="caret"></span>');
if(SET.scroll&&nearB())sc.scrollTop=sc.scrollHeight}
if(fin&&shown>=target.length){body.innerHTML=md(target);return}
requestAnimationFrame(tick)};
const api=cur.msgs.map((m,i,a)=>i===a.length-1&&m.role==="user"?{role:m.role,content:m.content,attachments:lastPacked}:{role:m.role,content:m.content});
ctl=new AbortController();
try{await askRock(api,t=>{target=t;if(!go){go=true;requestAnimationFrame(tick)}},ctl.signal);if(!go){target="(No response)";go=true;requestAnimationFrame(tick)}}
catch(e){if(e&&e.name==="AbortError"){stopped=true;if(!target)target="*Stopped.*"}else target="Couldn't reach ROCKGPT. Check your connection and try again.";if(!go){go=true;requestAnimationFrame(tick)}}
fin=true;if(stopped)shown=target.length;
await new Promise(r=>{const w=()=>shown>=target.length?r():setTimeout(w,40);w()});
const m={role:"assistant",content:target};cur.msgs.push(m);cur.t=Date.now();save();
spinDown(mark);addActions(col,target,m);ctl=null;busy=false;fit();markLast();renderHist();
}
function stopGen(){if(ctl)ctl.abort()}
async function send(){
const text=input.value.trim();if((!text&&!pending.length)||busy)return;
if(rec)rec.stop();
busy=true;const files=pending;pending=[];tray.innerHTML="";input.value="";fit();
emptyOff();
if(!cur){cur={id:Date.now(),t:Date.now(),title:(text||files[0].name).slice(0,42),msgs:[]};chats.unshift(cur)}
userRow(text,files);markLast();toB();
lastPacked=await pack(files);
cur.msgs.push({role:"user",content:text,files:files.map(f=>({name:f.name,type:f.type}))});save();renderHist();
await reply();
}
async function regen(){if(busy||!cur)return;const last=cur.msgs[cur.msgs.length-1];if(!last||last.role!=="assistant")return;
cur.msgs.pop();const rows=list.querySelectorAll(".ai-msg");rows[rows.length-1].remove();busy=true;fit();save();await reply()}
function editLast(){if(busy||!cur)return;let i=cur.msgs.length-1;while(i>=0&&cur.msgs[i].role!=="user")i--;if(i<0)return;
const t=cur.msgs[i].content;cur.msgs.splice(i);
let el=[...list.querySelectorAll(".msg.user")].pop();while(el){const n=el.nextElementSibling;el.remove();el=n}
if(!cur.msgs.length){chats=chats.filter(x=>x!==cur);cur=null;emptyOn()}
save();renderHist();input.value=t;fit();input.focus();markLast()}
function fit(){input.style.height="auto";input.style.height=Math.min(input.scrollHeight,140)+"px";sendBtn.classList.toggle("on",!busy&&!!(input.value.trim()||pending.length));sendBtn.classList.toggle("stop",busy);sendBtn.setAttribute("aria-label",busy?"Stop generating":"Send message");app.classList.toggle("busy",busy)}
input.oninput=fit;input.onfocus=()=>setTimeout(toB,300);
input.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){const ok=SET.enter?matchMedia("(pointer:fine)").matches:(e.ctrlKey||e.metaKey);if(ok){e.preventDefault();if(!busy)send()}}};
sendBtn.onclick=()=>busy?stopGen():send();
const fastBtn=$("fast"),setFast=()=>{fastBtn.classList.toggle("on",FAST);fastBtn.setAttribute("aria-pressed",FAST)};setFast();
fastBtn.onclick=()=>{FAST=!FAST;setFast();try{localStorage.setItem("rockgpt_fast",FAST?"1":"0")}catch(e){}};
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{input.value=c.dataset.t;send()});

/* ===== Toasts, export, settings, shortcuts, extras ===== */
function toast(msg,act){const box=$("toasts"),t=document.createElement("div");t.className="toast";t.textContent=msg;
if(act){const b=document.createElement("button");b.textContent=act.label;b.onclick=()=>{act.fn();t.remove()};t.appendChild(b)}
box.appendChild(t);setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.remove(),320)},act?6000:2200);while(box.children.length>3)box.firstChild.remove()}
function dl(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
const chatMd=c=>"# "+c.title+"\n\n"+c.msgs.map(m=>(m.role==="user"?"**You**":"**ROCKGPT**")+"\n\n"+m.content).join("\n\n---\n\n")+"\n";
$("exp").onclick=()=>{if(!cur)return;dl((cur.title.replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"chat")+".md",chatMd(cur),"text/markdown");toast("Chat exported")};
list.addEventListener("click",e=>{const b=e.target.closest(".cc");if(!b)return;const code=b.closest("pre").querySelector("code");
navigator.clipboard.writeText(code.textContent).then(()=>{b.textContent="Copied";setTimeout(()=>b.textContent="Copy",1400)},()=>toast("Couldn't copy"))});
sc.addEventListener("scroll",()=>$("tobot").classList.toggle("show",!app.classList.contains("is-empty")&&sc.scrollHeight-sc.scrollTop-sc.clientHeight>260));
$("tobot").onclick=toB;
let dcnt=0;
addEventListener("dragenter",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){dcnt++;$("drop").classList.add("on")}});
addEventListener("dragleave",()=>{dcnt=Math.max(0,dcnt-1);if(!dcnt)$("drop").classList.remove("on")});
addEventListener("dragover",e=>e.preventDefault());
addEventListener("drop",e=>{e.preventDefault();dcnt=0;$("drop").classList.remove("on");if(e.dataTransfer&&e.dataTransfer.files.length&&!e.target.closest("#comp"))addFiles(e.dataTransfer.files)});
addEventListener("offline",()=>toast("You're offline"));addEventListener("online",()=>toast("Back online"));
let dip=null;addEventListener("beforeinstallprompt",e=>{e.preventDefault();dip=e});

const sm=$("smodal");
const KEYS=[["New chat","Ctrl Shift O"],["Search chats","Ctrl K"],["Toggle sidebar","Ctrl B"],["Settings","Ctrl ,"],["Focus message box","/"],["Stop generating","Esc"],["New line","Shift Enter"]];
function openS(){
sm.innerHTML=`<div class="card" role="dialog" aria-modal="true" aria-label="Settings"><div class="mh"><span class="lg">${logo()}</span>SETTINGS<button class="ib" id="sx" aria-label="Close">×</button></div>
<div class="sg" style="margin-top:4px">Preferences</div>
<label class="tgr"><span>Enter to send<small>Off: Ctrl+Enter sends. Shift+Enter is always a new line. On phones Enter adds a new line.</small></span><input type="checkbox" class="tg" data-k="enter"></label>
<label class="tgr"><span>Auto-scroll while replying</span><input type="checkbox" class="tg" data-k="scroll"></label>
<label class="tgr"><span>Show intro animation</span><input type="checkbox" class="tg" data-k="intro"></label>
<div class="tgr" style="cursor:default"><span>Text size</span><div class="seg" id="szs"><button data-z="s">Small</button><button data-z="m">Normal</button><button data-z="l">Large</button></div></div>
<div class="sg">Custom instructions</div>
<textarea id="instr" maxlength="600" placeholder="Tell ROCKGPT how to answer. e.g. Use simple English and keep replies short."></textarea>
<div class="sg">Data</div>
<div class="btnrow"><button class="sbt" data-x="exp">Export all chats</button><button class="sbt" data-x="replay">Replay intro</button>${dip?'<button class="sbt" data-x="install">Install app</button>':""}<button class="sbt dg" data-x="clr">Clear all chats</button></div>
<div class="sg">Shortcuts</div>
<div class="keys">${KEYS.map(k=>`<div><span>${k[0]}</span><span>${k[1].split(" ").map(x=>`<kbd>${x}</kbd>`).join("")}</span></div>`).join("")}</div>
<div class="ver">ROCKGPT · settings are saved on this device</div></div>`;
sm.querySelectorAll(".tg").forEach(c=>c.checked=!!SET[c.dataset.k]);
sm.querySelectorAll("#szs button").forEach(b=>b.classList.toggle("on",b.dataset.z===SET.size));
$("instr").value=SET.instr;
sm.classList.add("on");app.classList.remove("m-open")}
function closeS(){sm.classList.remove("on");if(sm.contains(document.activeElement))document.activeElement.blur()}
sm.addEventListener("click",e=>{
if(e.target===sm||e.target.closest("#sx"))return closeS();
const z=e.target.closest("#szs button");if(z){SET.size=z.dataset.z;root.dataset.size=SET.size;saveSet();sm.querySelectorAll("#szs button").forEach(b=>b.classList.toggle("on",b===z));return}
const x=e.target.closest("[data-x]");if(!x)return;const a=x.dataset.x;
if(a==="exp"){if(!chats.length)return toast("No chats to export");dl("rockgpt-chats.json",JSON.stringify(chats,null,2),"application/json");toast("Chats exported")}
else if(a==="replay"){try{sessionStorage.setItem("rg_force","1")}catch(_){}location.reload()}
else if(a==="install"&&dip){dip.prompt();dip=null;x.remove()}
else if(a==="clr"){if(busy)return toast("Wait for the reply to finish");if(confirm("Delete all chats on this device? This can't be undone.")){chats=[];cur=null;save();list.innerHTML="";emptyOn();renderHist();closeS();toast("All chats deleted")}}});
sm.addEventListener("change",e=>{const c=e.target.closest(".tg");if(c){SET[c.dataset.k]=c.checked;saveSet()}});
sm.addEventListener("input",e=>{if(e.target.id==="instr"){SET.instr=e.target.value;saveSet()}});
$("setb").onclick=openS;
addEventListener("keydown",e=>{
const mod=e.ctrlKey||e.metaKey,k=(e.key||"").toLowerCase(),typing=/^(input|textarea)$/i.test(e.target.tagName)||e.target.isContentEditable;
if(mod&&e.shiftKey&&k==="o"){e.preventDefault();newChat()}
else if(mod&&k==="k"){e.preventDefault();if(isM())app.classList.add("m-open");else app.classList.remove("collapsed");$("side").classList.add("sq");$("sq").focus()}
else if(mod&&k==="b"){e.preventDefault();$("menu").click()}
else if(mod&&k===","){e.preventDefault();openS()}
else if(k==="/"&&!typing&&!mod){e.preventDefault();input.focus()}
else if(k==="escape"){if(sm.classList.contains("on"))closeS();else if(busy&&!modal.classList.contains("on"))stopGen()}});
if(isM())app.classList.add("collapsed");
renderAcct();renderHist();
