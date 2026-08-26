// Excepción deliberada: el menú permanece local hasta contar con una fuente real.
// Datos recuperados sin cambios desde el commit 4d2c809.
export const MENU_SECTIONS = [
  { id: "feca", label: "FECA", image: "/botones/feca.png", groups: [] },
  {
    id: "morfi", label: "MORFI", image: "/botones/Morfi.png",
    groups: [{
      id: "picadas", label: "Para Comer", icon: "🧀",
      items: [
        { name: "Picada Bizarren", desc: "Fiambres, quesos, aceitunas, tostadas", price: 5500 },
        { name: "Papas Rústicas", desc: "Con cheddar y crispy bacon", price: 2800 },
        { name: "Alitas BBQ", desc: "8 unidades con salsa ranch", price: 3600 },
        { name: "Nachos", desc: "Con guacamole, salsa y queso fundido", price: 3200 },
        { name: "Mini Burgers x3", desc: "Carne, cheddar, pepinillos, mostaza", price: 4200 },
      ],
    }],
  },
  {
    id: "chupi", label: "CHUPI", image: "/botones/Chupi.png",
    groups: [
      {
        id: "tragos", label: "Tragos", icon: "🍹",
        items: [
          { name: "Bizarren Signature", desc: "Vodka, maracuyá, jengibre, espuma de limón", price: 3200 },
          { name: "Dark Horse Sour", desc: "Bourbon, lima, clara de huevo, angostura", price: 2900 },
          { name: "Negroni Bizarro", desc: "Gin, Campari, vermut rosso, naranja", price: 2800 },
          { name: "Tropical Storm", desc: "Ron blanco, coco, piña, menta fresca", price: 2700 },
          { name: "Espresso Martini", desc: "Vodka, Kahlúa, espresso, espuma de café", price: 3100 },
          { name: "Aperol Spritz", desc: "Aperol, prosecco, soda, rodaja de naranja", price: 2500 },
        ],
      },
      {
        id: "cervezas", label: "Cervezas", icon: "🍺",
        items: [
          { name: "IPA Bizarren", desc: "Artesanal de la casa · 500cc", price: 2200 },
          { name: "Rubia Clásica", desc: "Lager artesanal suave · 500cc", price: 1900 },
          { name: "Negra Humo", desc: "Porter ahumada con chocolate · 500cc", price: 2400 },
          { name: "Quilmes", desc: "Botella 330cc", price: 1400 },
          { name: "Heineken", desc: "330cc", price: 1600 },
        ],
      },
      {
        id: "shots", label: "Shots", icon: "🥃",
        items: [
          { name: "Tequila Herradura", desc: "Shot 40ml", price: 1800 },
          { name: "Fernet con Cola", desc: "Porción", price: 1500 },
          { name: "Jägermeister", desc: "Shot frío 40ml", price: 1700 },
          { name: "Triple Sec Ignite", desc: "Shot flameado", price: 2000 },
        ],
      },
      {
        id: "sinAlcohol", label: "Sin Alcohol", icon: "🧃",
        items: [
          { name: "Limonada Bizarren", desc: "Limón, hierbas frescas, soda", price: 1600 },
          { name: "Agua con Gas", desc: "500cc", price: 800 },
          { name: "Agua sin Gas", desc: "500cc", price: 700 },
          { name: "Jugo de Naranja", desc: "Natural exprimido · 300cc", price: 1400 },
          { name: "Ginger Beer", desc: "Importada · 330cc", price: 1500 },
        ],
      },
    ],
  },
];
