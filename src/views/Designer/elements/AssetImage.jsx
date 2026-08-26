import {useEffect,useState} from "react";
import {loadDesignerAsset} from "../assets/assetStore";
export default function AssetImage({assetId,src,...props}){const external=src||(/^https?:|^\//.test(assetId||"")?assetId:"");const [url,setUrl]=useState(external);useEffect(()=>{let objectUrl;if(external){setUrl(external);return}setUrl("");loadDesignerAsset(assetId).then(record=>{if(record){objectUrl=URL.createObjectURL(record.blob);setUrl(objectUrl)}});return()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)}},[assetId,external]);return url?<img src={url} {...props}/>:null}
