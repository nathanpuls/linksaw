import{s as $,n as g,o as E}from"../chunks/scheduler.Cx9Dz3y6.js";import{S as j,i as D,e as _,s as I,c as m,a as k,k as C,f as L,d as f,g as h,h as u,w as M,t as p,b as d,j as v}from"../chunks/index.CaLiHKVj.js";import{e as b}from"../chunks/each.D6YF6ztN.js";import{a as N}from"../chunks/firebase.4_HkC9tC.js";import{g as P,r as S,o as V}from"../chunks/index.esm2017.CPFognq0.js";function x(i,e,n){const t=i.slice();return t[1]=e[n][0],t[2]=e[n][1],t}function q(i){let e,n="No data available";return{c(){e=_("p"),e.textContent=n},l(t){e=m(t,"P",{"data-svelte-h":!0}),C(e)!=="svelte-kyi4lu"&&(e.textContent=n)},m(t,a){h(t,e,a)},p:g,d(t){t&&f(e)}}}function w(i){let e,n=b(i[0]),t=[];for(let a=0;a<n.length;a+=1)t[a]=y(x(i,n,a));return{c(){e=_("ul");for(let a=0;a<t.length;a+=1)t[a].c()},l(a){e=m(a,"UL",{});var r=k(e);for(let l=0;l<t.length;l+=1)t[l].l(r);r.forEach(f)},m(a,r){h(a,e,r);for(let l=0;l<t.length;l+=1)t[l]&&t[l].m(e,null)},p(a,r){if(r&1){n=b(a[0]);let l;for(l=0;l<n.length;l+=1){const o=x(a,n,l);t[l]?t[l].p(o,r):(t[l]=y(o),t[l].c(),t[l].m(e,null))}for(;l<t.length;l+=1)t[l].d(1);t.length=n.length}},d(a){a&&f(e),M(t,a)}}}function y(i){let e,n=i[1]+"",t,a,r=i[2]+"",l;return{c(){e=_("li"),t=p(n),a=p(": "),l=p(r)},l(o){e=m(o,"LI",{});var s=k(e);t=d(s,n),a=d(s,": "),l=d(s,r),s.forEach(f)},m(o,s){h(o,e,s),u(e,t),u(e,a),u(e,l)},p(o,s){s&1&&n!==(n=o[1]+"")&&v(t,n),s&1&&r!==(r=o[2]+"")&&v(l,r)},d(o){o&&f(e)}}}function A(i){let e,n,t='Value of "links" from Firebase',a;function r(s,c){return s[0].length>0?w:q}let l=r(i),o=l(i);return{c(){e=_("main"),n=_("h1"),n.textContent=t,a=I(),o.c()},l(s){e=m(s,"MAIN",{});var c=k(e);n=m(c,"H1",{"data-svelte-h":!0}),C(n)!=="svelte-yr0odg"&&(n.textContent=t),a=L(c),o.l(c),c.forEach(f)},m(s,c){h(s,e,c),u(e,n),u(e,a),o.m(e,null)},p(s,[c]){l===(l=r(s))&&o?o.p(s,c):(o.d(1),o=l(s),o&&(o.c(),o.m(e,null)))},i:g,o:g,d(s){s&&f(e),o.d()}}}function F(i,e,n){let t=[];return E(()=>{const a=P(N),r=S(a,"links");V(r,l=>{const o=l.val();n(0,t=o?Object.entries(o):[])})}),[t]}class B extends j{constructor(e){super(),D(this,e,F,A,$,{})}}export{B as component};
