import{s as j,n as M,o as J,a as R}from"../chunks/scheduler.Cx9Dz3y6.js";import{S as P,i as V,e as g,c as p,k as F,g as h,q as K,d as m,a as L,r as q,u as A,x as Q,s as y,t as U,l as W,f as I,b as C,m as X,n as f,h as v,p as Y,j as O,v as Z,y as x}from"../chunks/index.CaLiHKVj.js";import"../chunks/paths.Cn39ycAc.js";import{g as $,a as ee}from"../chunks/index-bea2a320.BxOKR79w.js";import{a as te}from"../chunks/firebase.4_HkC9tC.js";function se(i){let e,s="Logout",t,o;return{c(){e=g("button"),e.textContent=s},l(l){e=p(l,"BUTTON",{"data-svelte-h":!0}),F(e)!=="svelte-18t49m"&&(e.textContent=s)},m(l,c){h(l,e,c),t||(o=K(e,"click",i[0]),t=!0)},p:M,i:M,o:M,d(l){l&&m(e),t=!1,o()}}}function ae(i){const e=$(te),s=async()=>{try{await ee(e),sessionStorage.removeItem("currentUser"),window.location.href="/"}catch(t){console.error("Logout error:",t)}};return J(()=>{}),[s]}class le extends P{constructor(e){super(),V(this,e,ae,se,j,{})}}function T(i){let e,s,t,o,l,c,u,n,D,b,w,d,k,z,E,S,N,_;return N=new le({}),{c(){e=g("div"),s=g("img"),o=y(),l=g("h5"),c=U(i[0]),u=y(),n=g("h5"),D=U("@"),b=U(i[3]),w=y(),d=g("h5"),k=U(i[2]),z=y(),E=g("br"),S=y(),W(N.$$.fragment),this.h()},l(a){e=p(a,"DIV",{class:!0});var r=L(e);s=p(r,"IMG",{src:!0,alt:!0,width:!0,height:!0,class:!0}),o=I(r),l=p(r,"H5",{class:!0});var B=L(l);c=C(B,i[0]),B.forEach(m),r.forEach(m),u=I(a),n=p(a,"H5",{class:!0});var H=L(n);D=C(H,"@"),b=C(H,i[3]),H.forEach(m),w=I(a),d=p(a,"H5",{class:!0});var G=L(d);k=C(G,i[2]),G.forEach(m),z=I(a),E=p(a,"BR",{}),S=I(a),X(N.$$.fragment,a),this.h()},h(){R(s.src,t=i[1])||f(s,"src",t),f(s,"alt","profile pic"),f(s,"width","50rem"),f(s,"height","50rem"),f(s,"class","svelte-1c5uz75"),f(l,"class","svelte-1c5uz75"),f(e,"class","imageName svelte-1c5uz75"),f(n,"class","svelte-1c5uz75"),f(d,"class","svelte-1c5uz75")},m(a,r){h(a,e,r),v(e,s),v(e,o),v(e,l),v(l,c),h(a,u,r),h(a,n,r),v(n,D),v(n,b),h(a,w,r),h(a,d,r),v(d,k),h(a,z,r),h(a,E,r),h(a,S,r),Y(N,a,r),_=!0},p(a,r){(!_||r&2&&!R(s.src,t=a[1]))&&f(s,"src",t),(!_||r&1)&&O(c,a[0]),(!_||r&8)&&O(b,a[3]),(!_||r&4)&&O(k,a[2])},i(a){_||(q(N.$$.fragment,a),_=!0)},o(a){A(N.$$.fragment,a),_=!1},d(a){a&&(m(e),m(u),m(n),m(w),m(d),m(z),m(E),m(S)),Z(N,a)}}}function oe(i){let e,s,t=i[0]&&T(i);return{c(){e=g("main"),t&&t.c()},l(o){e=p(o,"MAIN",{});var l=L(e);t&&t.l(l),l.forEach(m)},m(o,l){h(o,e,l),t&&t.m(e,null),s=!0},p(o,[l]){o[0]?t?(t.p(o,l),l&1&&q(t,1)):(t=T(o),t.c(),q(t,1),t.m(e,null)):t&&(x(),A(t,1,1,()=>{t=null}),Q())},i(o){s||(q(t),s=!0)},o(o){A(t),s=!1},d(o){o&&m(e),t&&t.d()}}}function re(i,e,s){let{displayName:t}=e,{photo:o}=e,{email:l}=e,{username:c}=e;return J(()=>{const u=sessionStorage.getItem("currentUser"),n=u?JSON.parse(u):null;console.log(n),s(0,t=n?n.displayName||"No Display Name":"Not Logged In"),s(1,o=n?n.photoURL||"No photo":"Not Logged In"),s(2,l=n?n.email||"No email":"Not Logged In"),s(3,c=n.email?n.email.split("@")[0]:"No username"),s(3,c=c.replace(/\./g,""))}),i.$$set=u=>{"displayName"in u&&s(0,t=u.displayName),"photo"in u&&s(1,o=u.photo),"email"in u&&s(2,l=u.email),"username"in u&&s(3,c=u.username)},[t,o,l,c]}class fe extends P{constructor(e){super(),V(this,e,re,oe,j,{displayName:0,photo:1,email:2,username:3})}}export{fe as component};
