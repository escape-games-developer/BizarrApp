export interface DesignerScreenDefinition {
  id: string;
  name: string;
  target: "client" | "admin" | "giant";
  route: string;
  component: string;
  viewport: { width: number; height: number };
  rootSelector?: string;
  nativeDocument?: string;
}

// Registro derivado de los switches reales de App.jsx, AdminPanel y PantallaGigante.
export const designerScreens: DesignerScreenDefinition[] = [
  { id:"client-home-native", name:"Inicio", target:"client", route:"/designer-preview/client/home", component:"ClientHomeDocument", nativeDocument:"clientHome", viewport:{width:390,height:844} },
  { id:"client-novedades", name:"Bienvenidos", target:"client", route:"/?designerView=novedades&designerPreview=1", component:"NovedadesView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  { id:"client-menu", name:"Menú", target:"client", route:"/?designerView=menu&designerPreview=1", component:"CartaView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  { id:"client-pantalla", name:"Directo a pantalla", target:"client", route:"/?designerView=pantalla&designerPreview=1", component:"PantallaView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  { id:"client-games", name:"Juegos", target:"client", route:"/?designerView=games&designerPreview=1", component:"JuegosView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  { id:"client-escenario", name:"Escenario", target:"client", route:"/?designerView=escenario&designerPreview=1", component:"EscenarioView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  { id:"client-profile", name:"Perfil / acceso", target:"client", route:"/?designerView=profile&designerPreview=1", component:"ProfileView", viewport:{width:1440,height:900}, rootSelector:".phone-shell" },
  ...[
    ["launch","Lanzar"],["placas","Placas"],["mensajes","Mensajes"],["videos","Videos"],["duelo","Duelo de Talentos"],["ftl","Follow the Leader"],["pt","Personal Trainer"],["karaoke","Si lo sabe cante"],["rey","Rey del Orto"],["suma","Sumate que sumamos"],["palabra","Arma la palabra"],["trivia","Desafío Demente"],["menu","Menú del Bar"],["novedades","Novedades"],["playlists","Playlists YouTube"],["dashboard","Dashboard"],
  ].map(([id,name]) => ({ id:`admin-${id}`, name, target:"admin" as const, route:`/admin?designerSection=${id}&designerPreview=1`, component:`AdminPanel:${id}`, viewport:{width:1440,height:900}, rootSelector:".root" })),
  { id:"giant-idle", name:"Espera / logo", target:"giant", route:"/pantalla?designerState=idle&designerPreview=1", component:"IdleScreen", viewport:{width:1920,height:1080}, rootSelector:".screen" },
  { id:"giant-raffle", name:"Rey del Orto — sorteo", target:"giant", route:"/pantalla?designerState=raffle&designerPreview=1", component:"RaffleScreen", viewport:{width:1920,height:1080}, rootSelector:".screen" },
  { id:"giant-winner", name:"Rey del Orto — ganador", target:"giant", route:"/pantalla?designerState=winner&designerPreview=1", component:"RaffleScreen:winner", viewport:{width:1920,height:1080}, rootSelector:".screen" },
  { id:"giant-trivia", name:"Desafío Demente", target:"giant", route:"/pantalla?designerState=trivia&designerPreview=1", component:"TriviaScreen", viewport:{width:1920,height:1080}, rootSelector:".screen" },
  ...[["duelo","Duelo de Talentos"],["ftl","Follow the Leader"],["pt","Personal Trainer"],["karaoke","Si lo sabe cante"]].map(([id,name])=>({ id:`giant-${id}`, name, target:"giant" as const, route:`/pantalla?designerState=${id}&designerPreview=1`, component:`EscenarioScreen:${id}`, viewport:{width:1920,height:1080}, rootSelector:".screen" })),
  ...[["logo_animado","Logo animado"],["mensaje_app","Mensaje de la app"],["promo","Promoción"],["game_rey","Placa Rey del Orto"],["game_trivia","Placa Desafío Demente"],["game_suma","Placa Sumate"],["game_palabra","Placa Arma la palabra"],["escenario","Placa Escenario"],["break","Pausa"],["cierre","Cierre"],["duelo","Placa Duelo"],["escenario_ftl","Placa Follow the Leader"],["escenario_pt","Placa Personal Trainer"],["escenario_karaoke","Placa Karaoke"]].map(([id,name])=>({ id:`giant-placa-${id}`, name, target:"giant" as const, route:`/pantalla?designerState=placa:${id}&designerPreview=1`, component:`PlacaScreen:${id}`, viewport:{width:1920,height:1080}, rootSelector:".screen" })),
];

export const screensForTarget = (target: DesignerScreenDefinition["target"]) => designerScreens.filter(screen => screen.target === target);
export const screenById = (id: string) => designerScreens.find(screen => screen.id === id);
