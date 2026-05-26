// ─── Carta del bar ────────────────────────────────────────────────────────────
// En producción: fetch desde API. Por ahora, datos estáticos.

export const MENU = [
  {
    id: "tragos", label: "Tragos", icon: "🍹",
    items: [
      { name: "Bizarren Signature", desc: "Vodka, maracuyá, jengibre, espuma de limón",  price: 3200 },
      { name: "Dark Horse Sour",    desc: "Bourbon, lima, clara de huevo, angostura",     price: 2900 },
      { name: "Negroni Bizarro",    desc: "Gin, Campari, vermut rosso, naranja",          price: 2800 },
      { name: "Tropical Storm",     desc: "Ron blanco, coco, piña, menta fresca",         price: 2700 },
      { name: "Espresso Martini",   desc: "Vodka, Kahlúa, espresso, espuma de café",      price: 3100 },
      { name: "Aperol Spritz",      desc: "Aperol, prosecco, soda, rodaja de naranja",    price: 2500 },
    ],
  },
  {
    id: "cervezas", label: "Cervezas", icon: "🍺",
    items: [
      { name: "IPA Bizarren",   desc: "Artesanal de la casa · 500cc",         price: 2200 },
      { name: "Rubia Clásica",  desc: "Lager artesanal suave · 500cc",        price: 1900 },
      { name: "Negra Humo",     desc: "Porter ahumada con chocolate · 500cc", price: 2400 },
      { name: "Quilmes",        desc: "Botella 330cc",                         price: 1400 },
      { name: "Heineken",       desc: "330cc",                                 price: 1600 },
    ],
  },
  {
    id: "shots", label: "Shots", icon: "🥃",
    items: [
      { name: "Tequila Herradura", desc: "Shot 40ml",      price: 1800 },
      { name: "Fernet con Cola",   desc: "Porción",        price: 1500 },
      { name: "Jägermeister",      desc: "Shot frío 40ml", price: 1700 },
      { name: "Triple Sec Ignite", desc: "Shot flameado",  price: 2000 },
    ],
  },
  {
    id: "sinAlcohol", label: "Sin Alcohol", icon: "🧃",
    items: [
      { name: "Limonada Bizarren", desc: "Limón, hierbas frescas, soda", price: 1600 },
      { name: "Agua con Gas",      desc: "500cc",                         price: 800  },
      { name: "Agua sin Gas",      desc: "500cc",                         price: 700  },
      { name: "Jugo de Naranja",   desc: "Natural exprimido · 300cc",     price: 1400 },
      { name: "Ginger Beer",       desc: "Importada · 330cc",             price: 1500 },
    ],
  },
  {
    id: "picadas", label: "Para Comer", icon: "🧀",
    items: [
      { name: "Picada Bizarren",  desc: "Fiambres, quesos, aceitunas, tostadas", price: 5500 },
      { name: "Papas Rústicas",   desc: "Con cheddar y crispy bacon",            price: 2800 },
      { name: "Alitas BBQ",       desc: "8 unidades con salsa ranch",            price: 3600 },
      { name: "Nachos",           desc: "Con guacamole, salsa y queso fundido",  price: 3200 },
      { name: "Mini Burgers x3",  desc: "Carne, cheddar, pepinillos, mostaza",   price: 4200 },
    ],
  },
];

// ─── Playlists ────────────────────────────────────────────────────────────────
export const VIDEOS_GENERAL = [
  { id: "v1", ytId: "OPf0YbXqDm0", title: "Blinding Lights",  artist: "The Weeknd"   },
  { id: "v2", ytId: "JGwWNGJdvx8", title: "Shape of You",     artist: "Ed Sheeran"   },
  { id: "v3", ytId: "ktvTqknDobU", title: "Uptown Funk",      artist: "Bruno Mars"   },
  { id: "v4", ytId: "09R8_2nJtjg", title: "Shake It Off",     artist: "Taylor Swift" },
  { id: "v5", ytId: "hT_nvWreIhg", title: "Counting Stars",   artist: "OneRepublic"  },
];

export const VIDEOS_FTL = [
  { id: "f1", ytId: "ktvTqknDobU", title: "Uptown Funk",      artist: "Bruno Mars"   },
  { id: "f2", ytId: "OPf0YbXqDm0", title: "Blinding Lights",  artist: "The Weeknd"   },
  { id: "f3", ytId: "JGwWNGJdvx8", title: "Shape of You",     artist: "Ed Sheeran"   },
];

export const VIDEOS_PT = [
  { id: "p1", ytId: "hT_nvWreIhg", title: "Counting Stars",      artist: "OneRepublic" },
  { id: "p2", ytId: "fJ9rUzIMcZQ", title: "Don't Stop Me Now",   artist: "Queen"       },
  { id: "p3", ytId: "OPf0YbXqDm0", title: "Blinding Lights",     artist: "The Weeknd"  },
];

export const VIDEOS_KARAOKE = [
  { id: "k1", ytId: "kXYiU_JCYtU", title: "Bohemian Rhapsody", artist: "Queen"        },
  { id: "k2", ytId: "09R8_2nJtjg", title: "Shake It Off",      artist: "Taylor Swift" },
  { id: "k3", ytId: "dQw4w9WgXcQ", title: "Never Gonna Give",  artist: "Rick Astley"  },
];

// ─── Preguntas Desafío Demente (demo) ─────────────────────────────────────────
export const TRIVIA_QUESTIONS = [
  { id:"q1",  text:"¿En qué año se inauguró el Teatro Colón de Buenos Aires?",     opts:["1908","1922","1895","1934"],   correct:0 },
  { id:"q2",  text:"¿Cuántas cuerdas tiene una guitarra estándar?",                opts:["4","5","6","7"],               correct:2 },
  { id:"q3",  text:"¿Cuál es la capital de Japón?",                                opts:["Osaka","Kioto","Hiroshima","Tokio"], correct:3 },
  { id:"q4",  text:"¿En qué país se inventó el dulce de leche?",                   opts:["Uruguay","Brasil","Argentina","Chile"], correct:2 },
  { id:"q5",  text:"¿Cuántos jugadores tiene un equipo de fútbol?",                opts:["9","10","11","12"],            correct:2 },
  { id:"q6",  text:"¿Quién pintó La Mona Lisa?",                                   opts:["Miguel Ángel","Rafael","Da Vinci","Botticelli"], correct:2 },
  { id:"q7",  text:"¿Cuántos segundos tiene un minuto?",                           opts:["30","60","100","120"],         correct:1 },
  { id:"q8",  text:"¿Cuál es el río más largo de Sudamérica?",                     opts:["Paraná","Amazonas","Orinoco","Río de la Plata"], correct:1 },
  { id:"q9",  text:"¿Cómo se llama la cerveza artesanal de Bizarren?",             opts:["Bizarro IPA","IPA Bizarren","La Bicha","La Dorada"], correct:1 },
  { id:"q10", text:"¿Cuántas provincias tiene Argentina?",                         opts:["22","23","24","25"],           correct:2 },
];

// ─── Strobe colors (Rey del Orto / Trivia) ────────────────────────────────────
export const STROBE_COLORS = [
  "#EF4444","#F59E0B","#8B5CF6","#EC4899",
  "#3B82F6","#10B981","#F97316","#FFD700","#A855F7",
];

// ─── Raffle names (simulados) ─────────────────────────────────────────────────
export const RAFFLE_NAMES = [
  "Claudia V.","Martín R.","Sofía D.","Pablo S.","Ana L.","Tomás A.",
];
