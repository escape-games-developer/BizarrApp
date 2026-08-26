const base={rotation:0,opacity:1,visible:true,locked:false,zIndex:1,styles:{},props:{},responsive:{mobile:{},tablet:{}}};
const el=(id,name,type,parentId,layout,props={},styles={})=>({...base,id,name,type,parentId,layout,props,styles});

export function createClientHomeDocument(){return {
  version:1,id:"client-home",screenId:"client-home-native",target:"client",layoutMode:"responsive",
  viewport:{width:390,height:844,baseWidth:390,breakpoint:"mobile"},
  pages:[{id:"client-home-page",name:"Inicio",background:{type:"color",value:"#000000"},elements:[
    {...el("home-root","Página","page",null,{direction:"column",gap:0,padding:"18px 14px 0",minHeight:"100dvh"},{},{background:"#000000",color:"#ffffff"}),systemElement:true},
    el("home-header","Header","section","home-root",{direction:"row",alignItems:"center",justifyContent:"center",padding:"8px 0 14px"}),
    el("home-logo","Logo BizarrApp","image","home-header",{width:"58%",maxWidth:"250px"},{src:"/logo.png",alt:"BizarrApp"},{objectFit:"contain"}),
    el("news-section","Novedades","section","home-root",{direction:"column",gap:10,margin:"0 0 42px"}),
    el("news-carousel","Carrusel de novedades","newsCarousel","news-section",{width:"100%"},{binding:{source:"news"},emptyTitle:"NADA POR AHORA",emptyBody:"El staff cargará las novedades de la noche"},{borderRadius:20,border:"1.5px solid #ff2d78",boxShadow:"0 0 16px rgba(255,45,120,.38)",overflow:"hidden"}),
    el("news-prev","Flecha izquierda","carouselControl","news-section",{}, {direction:"prev",targetId:"news-carousel"}),
    el("news-next","Flecha derecha","carouselControl","news-section",{}, {direction:"next",targetId:"news-carousel"}),
    el("news-dots","Indicadores","carouselIndicators","news-section",{}, {targetId:"news-carousel"},{activeColor:"#ff2d78",color:"#666"}),
    el("events-section","Próximos eventos","eventsSection","home-root",{direction:"column",gap:14,margin:"0 0 38px"},{binding:{source:"events"}}),
    el("events-heading","Encabezado de eventos","row","events-section",{direction:"row",alignItems:"center",justifyContent:"space-between"}),
    el("events-title","Título Próximos eventos","text","events-heading",{}, {text:"⚡ PRÓXIMOS EVENTOS"},{fontFamily:"Bangers, sans-serif",fontSize:23,fontWeight:700,color:"#ffffff",letterSpacing:1}),
    el("events-all","Ver todos","button","events-heading",{}, {text:"Ver todos  ›",route:"/eventos"},{fontSize:15,color:"#ff2d78",background:"transparent",fontWeight:700}),
    el("events-list","Carrusel de eventos","stack","events-section",{direction:"column",gap:10}),
    el("event-card","Card de evento","eventCard","events-list",{direction:"row",minHeight:"124px",padding:"14px",gap:14},{binding:{source:"events",index:0}},{background:"linear-gradient(110deg,#070407,#13051c)",border:"1px solid rgba(255,45,120,.42)",borderRadius:14,overflow:"hidden"}),
    el("bottom-nav","Navegación inferior","navigationBar","home-root",{direction:"row",alignItems:"center",justifyContent:"space-around",gap:2,padding:"9px 8px calc(9px + env(safe-area-inset-bottom))",margin:"auto -14px 0"},{fixed:true},{background:"rgba(0,0,0,.97)",borderTop:"1px solid rgba(255,45,120,.22)"}),
    ...[
      ["nav-noti","NOTI","/botones/boton_noti.png","novedades",true],["nav-menu","MENÚ","/botones/boton_menu.png","menu"],["nav-screen","PANTALLA","/botones/boton_pantalla.png","pantalla"],["nav-games","JUEGOS","/botones/boton_juegos.png","games"],["nav-stage","ESCENARIO","/botones/boton_escenario.png","escenario"],["nav-profile","PERFIL","/botones/botones_perfil.png","profile"],
    ].map(([id,label,iconAsset,route,active=false],i)=>({...el(id,label,"navigationItem","bottom-nav",{flexGrow:1},{label,iconAsset,route,active},{color:"#ffd600"}),zIndex:i+1})),
  ]}]
}}
