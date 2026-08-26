const BASE_THRESHOLD=7;
export function calculateSnap(element,next,elements,viewport,snap=true,zoom=1){
 if(!snap)return {position:next,guides:[]};
 const near=(a,b)=>Math.abs(a-b)<=BASE_THRESHOLD/Math.max(.1,zoom),xs=[0,viewport.width/2,viewport.width],ys=[0,viewport.height/2,viewport.height];
 elements.filter(item=>item.id!==element.id&&item.visible&&item.type!=="background"&&typeof item.x==="number").forEach(item=>{xs.push(item.x,item.x+item.width/2,item.x+item.width);ys.push(item.y,item.y+item.height/2,item.y+item.height)});
 let x=next.x,y=next.y;const guides=[];
 for(const target of xs){if(near(x,target)){x=target;guides.push({axis:"x",value:target});break}if(near(x+element.width/2,target)){x=target-element.width/2;guides.push({axis:"x",value:target});break}if(near(x+element.width,target)){x=target-element.width;guides.push({axis:"x",value:target});break}}
 for(const target of ys){if(near(y,target)){y=target;guides.push({axis:"y",value:target});break}if(near(y+element.height/2,target)){y=target-element.height/2;guides.push({axis:"y",value:target});break}if(near(y+element.height,target)){y=target-element.height;guides.push({axis:"y",value:target});break}}
 return {position:{x:Math.round(x),y:Math.round(y)},guides};
}
