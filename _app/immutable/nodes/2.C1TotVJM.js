import{s as A,n as y,o as j}from"../chunks/scheduler.Cx9Dz3y6.js";import{S as L,i as U,e as h,c as x,k as C,g as l,q as N,d as a,s as _,l as I,f as v,m as O,n as S,p as T,r as z,u as B,v as H}from"../chunks/index.CaLiHKVj.js";import{b as G}from"../chunks/paths.Cn39ycAc.js";import{g as J,s as M,G as W}from"../chunks/index-bea2a320.BxOKR79w.js";import{a as D}from"../chunks/firebase.4_HkC9tC.js";function E(g){let e,c="Sign in with Google",n,s;return{c(){e=h("button"),e.textContent=c},l(r){e=x(r,"BUTTON",{"data-svelte-h":!0}),C(e)!=="svelte-gpctgk"&&(e.textContent=c)},m(r,f){l(r,e,f),n||(s=N(e,"click",g[0]),n=!0)},p:y,i:y,o:y,d(r){r&&a(e),n=!1,s()}}}function F(g){const e=J(D),c=async()=>{try{const s=(await M(e,new W)).user,i=`@${s.email.split("@")[0]}`;console.log(i),sessionStorage.setItem("currentUser",JSON.stringify(s)),window.location.href="/links",console.log("Navigated to /menu")}catch(n){console.error("Login error:",n)}};return j(()=>{}),[c]}class K extends L{constructor(e){super(),U(this,e,F,E,A,{})}}function Q(g){let e,c="Shortcuts",n,s,r="Custom shortlinks based on your Google username",f,i,P="Plus other shortcut tools to make life easier",d,p,$,u,b="Links",k,m,q="Snips",w;return p=new K({}),{c(){e=h("h1"),e.textContent=c,n=_(),s=h("p"),s.textContent=r,f=_(),i=h("p"),i.textContent=P,d=_(),I(p.$$.fragment),$=_(),u=h("a"),u.textContent=b,k=_(),m=h("a"),m.textContent=q,this.h()},l(t){e=x(t,"H1",{"data-svelte-h":!0}),C(e)!=="svelte-9zwj0j"&&(e.textContent=c),n=v(t),s=x(t,"P",{"data-svelte-h":!0}),C(s)!=="svelte-qj64m4"&&(s.textContent=r),f=v(t),i=x(t,"P",{"data-svelte-h":!0}),C(i)!=="svelte-1mq7tdd"&&(i.textContent=P),d=v(t),O(p.$$.fragment,t),$=v(t),u=x(t,"A",{href:!0,class:!0,"data-svelte-h":!0}),C(u)!=="svelte-16qhs0m"&&(u.textContent=b),k=v(t),m=x(t,"A",{href:!0,class:!0,"data-svelte-h":!0}),C(m)!=="svelte-60pchi"&&(m.textContent=q),this.h()},h(){S(u,"href",G+"/links"),S(u,"class","menu"),S(m,"href",G+"/snips"),S(m,"class","menu")},m(t,o){l(t,e,o),l(t,n,o),l(t,s,o),l(t,f,o),l(t,i,o),l(t,d,o),T(p,t,o),l(t,$,o),l(t,u,o),l(t,k,o),l(t,m,o),w=!0},p:y,i(t){w||(z(p.$$.fragment,t),w=!0)},o(t){B(p.$$.fragment,t),w=!1},d(t){t&&(a(e),a(n),a(s),a(f),a(i),a(d),a($),a(u),a(k),a(m)),H(p,t)}}}class tt extends L{constructor(e){super(),U(this,e,null,Q,A,{})}}export{tt as component};
