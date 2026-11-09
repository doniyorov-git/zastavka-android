const REGIONS = [
  "Toshkent",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qarshi",
  "Nukus",
  "Urganch",
  "Termiz",
  "Jizzax",
  "Navoiy",
  "Guliston",
  "Qo'qon",
  "Chirchiq",
  "Angren",
  "Nurafshon",
];

const TOSHKENT_DISTRICTS = [
  "Yunusobod",
  "Chilonzor",
  "Mirzo Ulug'bek",
  "Shayxontohur",
  "Yakkasaroy",
  "Sergeli",
  "Uchtepa",
  "Olmazor",
  "Yashnobod",
  "Mirobod",
  "Bektemir",
];

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ʻ’‘`]/g, "'")
    .replace(/o'/g, "o")
    .replace(/g'/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeBranches(bankId, { districts = false } = {}) {
  const branches = [{ id: `${bankId}-toshkent-bosh-ofis`, name: "Bosh ofis — Toshkent" }];
  if (districts) {
    for (const district of TOSHKENT_DISTRICTS) {
      branches.push({
        id: `${bankId}-toshkent-${slug(district)}`,
        name: `Toshkent, ${district} filiali`,
      });
    }
  }
  for (const city of REGIONS) {
    if (city === "Toshkent") continue;
    branches.push({
      id: `${bankId}-${slug(city)}`,
      name: `${city} filiali`,
    });
  }
  return branches;
}

const BANK_DEFS = [
  { id: "nbu", name: "Milliy bank (NBU)", districts: true },
  { id: "xalq", name: "Xalq banki", districts: true },
  { id: "agrobank", name: "Agrobank", districts: true },
  { id: "asaka", name: "Asakabank", districts: true },
  { id: "ipoteka", name: "Ipoteka-bank", districts: true },
  { id: "qqb", name: "Qishloq qurilish bank", districts: true },
  { id: "sqb", name: "O'zsanoatqurilishbank", districts: true },
  { id: "aloqa", name: "Aloqabank", districts: true },
  { id: "turon", name: "Turonbank", districts: true },
  { id: "mkb", name: "Mikrokreditbank", districts: true },
  { id: "hamkor", name: "Hamkorbank", districts: true },
  { id: "kapital", name: "Kapitalbank", districts: true },
  { id: "ipakyoli", name: "Ipak Yo'li banki", districts: true },
  { id: "infin", name: "InfinBANK", districts: true },
  { id: "ofb", name: "Orient Finans Bank", districts: false },
  { id: "aab", name: "Asia Alliance Bank", districts: false },
  { id: "universal", name: "Universalbank", districts: false },
  { id: "trust", name: "Trustbank", districts: false },
  { id: "davr", name: "Davr Bank", districts: false },
  { id: "anor", name: "Anorbank", districts: true },
  { id: "tenge", name: "Tenge Bank", districts: false },
  { id: "tbc", name: "TBC Bank", districts: true },
  { id: "uzum", name: "Uzum Bank", districts: true },
  { id: "poytaxt", name: "Poytaxt Bank", districts: false },
  { id: "ziraat", name: "Ziraat Bank O'zbekiston", districts: false },
  { id: "hayot", name: "Hayot Bank", districts: false },
  { id: "garant", name: "Garant bank", districts: false },
  { id: "octo", name: "Octobank", districts: false },
];

export const UZ_BANKS = BANK_DEFS.map((bank) => ({
  id: bank.id,
  name: bank.name,
  branches: makeBranches(bank.id, { districts: bank.districts }),
}));

export function listUzBanks() {
  return UZ_BANKS.map((bank) => ({
    id: bank.id,
    name: bank.name,
    branches: bank.branches.map((branch) => ({ id: branch.id, name: branch.name })),
  }));
}

export function resolveUzBankBranch(bankId, branchId) {
  const bank = UZ_BANKS.find((item) => item.id === String(bankId || ""));
  if (!bank) return null;
  const branch = bank.branches.find((item) => item.id === String(branchId || ""));
  if (!branch) return null;
  return { bank, branch };
}
