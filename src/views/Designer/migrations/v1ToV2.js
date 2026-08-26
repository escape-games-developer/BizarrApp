const backgroundId=pageId=>`background-${pageId}`;

export function migrateDocument(input){
 const doc=structuredClone(input);
 const complete=(doc.pages||[]).every(page=>page.elements?.some(element=>element.type==="background"));
 if((doc.version||1)>=2&&complete)return doc;
 doc.version=2;
 doc.layoutMode=doc.layoutMode||(doc.target==="giant"?"free":"responsive");
 doc.pages=(doc.pages||[]).map(page=>{
  const elements=page.elements||[];
  if(elements.some(element=>element.type==="background"))return page;
  const background={
   id:backgroundId(page.id),name:"Fondo",type:"background",parentId:null,positionMode:"free",
   x:0,y:0,width:doc.viewport.width,height:doc.viewport.height,rotation:0,opacity:1,
   visible:true,locked:true,systemElement:true,zIndex:0,styles:{},
   props:{background:{type:page.background?.type||"color",color:page.background?.value||"#08040f",gradient:page.background?.type==="gradient"?page.background.value:"",asset:"",fit:"cover",position:"center",opacity:1,blur:0,overlay:"transparent"}}
  };
  const migrated=elements.map(element=>({...element,positionMode:element.positionMode||(doc.layoutMode==="responsive"?"auto":"free"),action:element.action||{type:"none"}}));
  return {...page,elements:[background,...migrated]};
 });
 return doc;
}
