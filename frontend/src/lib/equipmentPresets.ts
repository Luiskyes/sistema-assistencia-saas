export const MARCAS_EQUIPAMENTO = [
  "Samsung", "Apple", "Motorola", "Xiaomi", "LG", "Dell", "Lenovo",
  "Acer", "Asus", "HP", "Positivo", "Epson", "Canon", "Brother",
] as const;

export const CORES_EQUIPAMENTO = [
  "Preto", "Branco", "Prata", "Cinza", "Azul", "Vermelho", "Verde",
  "Dourado", "Rosa", "Roxo",
] as const;

const MODELOS_GERAIS = [
  "Notebook", "Desktop", "Smartphone", "Tablet", "Impressora", "Monitor",
] as const;

const MODELOS_POR_MARCA: Record<string, readonly string[]> = {
  Samsung: ["Galaxy A15", "Galaxy A25", "Galaxy A55", "Galaxy S23", "Galaxy S24", "Galaxy Book"],
  Apple: ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone 14", "iPhone 15", "MacBook Air", "MacBook Pro", "iPad"],
  Motorola: ["Moto G24", "Moto G54", "Moto G84", "Edge 40", "Edge 50"],
  Xiaomi: ["Redmi Note 12", "Redmi Note 13", "Poco X6", "Poco M6"],
  Dell: ["Inspiron", "Vostro", "Latitude", "XPS"],
  Lenovo: ["IdeaPad", "ThinkPad", "Legion"],
  Acer: ["Aspire", "Nitro", "Predator"],
  Asus: ["VivoBook", "ZenBook", "TUF Gaming"],
  HP: ["HP 250", "Pavilion", "ProBook"],
  Epson: ["EcoTank L3250", "EcoTank L4260", "EcoTank L6270"],
  Canon: ["Mega Tank G3110", "Mega Tank G4110", "Pixma"],
  Brother: ["DCP-L2540DW", "DCP-T420W", "HL-L2360DW"],
};

export function modelosParaMarca(marca: string): readonly string[] {
  return MODELOS_POR_MARCA[marca] ?? MODELOS_GERAIS;
}
