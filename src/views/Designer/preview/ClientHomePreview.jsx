import {useMemo} from "react";
import ScreenRenderer from "../renderer/ScreenRenderer";
import {createClientHomeDocument} from "../documents/clientHomeDocument";
import {getClientHomeRuntimeData} from "../data/clientHomeData";
export default function ClientHomePreview(){const fallback=useMemo(()=>createClientHomeDocument(),[]),data=useMemo(()=>getClientHomeRuntimeData(),[]);let document=fallback;try{document=JSON.parse(localStorage.getItem("bizarren-designer-published-client-home-native-390x844-v2"))||fallback}catch{/* Un documento local inválido vuelve de forma segura al diseño base. */}return <div style={{minHeight:"100vh",background:"#111",display:"flex",justifyContent:"center"}}><ScreenRenderer document={document} data={data} style={{width:"min(100vw,480px)"}}/></div>}
