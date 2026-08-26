import { useState } from "react";
import { MENU_SECTIONS } from "../../constants/menuData";

function ProductList({ items }) {
  return (
    <div className="card">
      {items.map((item, index) => (
        <div key={item.name} style={{
          display:"flex", alignItems:"center", gap:10, padding:"11px 0",
          borderBottom:index < items.length - 1 ? "1px solid rgba(255,215,0,.07)" : "none",
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#F5E6C0",marginBottom:3}}>{item.name}</div>
            <div style={{fontSize:11,color:"rgba(245,230,192,.42)",lineHeight:1.4}}>{item.desc}</div>
          </div>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,color:"#FFD700",flexShrink:0}}>
            ${item.price.toLocaleString("es-AR")}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CartaView() {
  const [sectionId, setSectionId] = useState(null);
  const section = MENU_SECTIONS.find((item) => item.id === sectionId) || null;

  return (
    <div>
      <div className="sec-hdr"><span style={{fontSize:20}}>🍹</span><h3>Carta del Bar</h3></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,marginBottom:18}}>
        {MENU_SECTIONS.map((item) => {
          const active = sectionId === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setSectionId(item.id)}
              aria-pressed={active} aria-label={item.label}
              style={{
                minWidth:0,width:"100%",maxWidth:104,aspectRatio:"1 / 1",padding:10,
                justifySelf:"center",borderRadius:"50%",cursor:"pointer",
                border:`1px solid ${active ? "rgba(255,215,0,.45)" : "rgba(255,215,0,.12)"}`,
                background:"transparent",
                transition:"all .18s",WebkitTapHighlightColor:"transparent",
              }}>
              <img src={item.image} alt="" aria-hidden="true" style={{
                display:"block",width:"100%",height:"100%",objectFit:"contain",
              }}/>
            </button>
          );
        })}
      </div>

      {!section && (
        <div style={{textAlign:"center",padding:"34px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
          Elegí FECA, MORFI o CHUPI para ver la carta.
        </div>
      )}

      {section && section.groups.length === 0 && (
        <div style={{textAlign:"center",padding:"34px 20px",fontSize:12,color:"rgba(245,230,192,.3)"}}>
          No hay productos cargados en {section.label} todavía.
        </div>
      )}

      {section?.groups.map((group) => (
        <section key={group.id} style={{marginBottom:16}}>
          <div className="sec-hdr" style={{marginBottom:8}}>
            <span style={{fontSize:18}}>{group.icon}</span><h3 style={{fontSize:15}}>{group.label}</h3>
          </div>
          <ProductList items={group.items}/>
        </section>
      ))}

      {section && section.groups.length > 0 && (
        <p style={{fontSize:10,color:"rgba(245,230,192,.25)",textAlign:"center",marginTop:4}}>
          Precios en pesos argentinos · Pueden cambiar · Consultá al staff
        </p>
      )}
    </div>
  );
}
