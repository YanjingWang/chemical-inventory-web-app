/**
 * Rule-based storage assignment for demo.
 * In production this would use hazard classes, SDS metadata, and capacity.
 */
export function determineLocationForChemical(chemicalName: string): string {
  const n = chemicalName.toLowerCase();

  if (
    /\bacid\b|sulfuric|hydrochloric|nitric|phosphoric/.test(n) ||
    n.includes("acid")
  ) {
    return "ACID-CABINET-B1";
  }
  if (
    /acetone|methanol|ethanol|hexane|ethyl ether|diethyl ether|toluene|xylene/.test(
      n,
    ) ||
    /\bflammable\b/.test(n)
  ) {
    return "FLAMMABLE-CABINET-A3";
  }
  if (/cold|refrigerat|−|°c|-20|-80|cryo/.test(n)) {
    return "COLD-ROOM-C2";
  }
  return "GENERAL-SHELF-D4";
}

export function explainStorageChoice(
  chemicalName: string,
  location: string,
): string {
  const n = chemicalName.toLowerCase();
  if (location.startsWith("ACID-")) {
    return `${location} was chosen because "${chemicalName}" is treated as corrosive/acid storage.`;
  }
  if (location.startsWith("FLAMMABLE-")) {
    return `${location} was chosen because "${chemicalName}" matches flammable solvent rules in this demo.`;
  }
  if (location.startsWith("COLD-")) {
    return `${location} was chosen because the chemical name suggests cold storage.`;
  }
  return `${location} is the default general storage for chemicals that do not match specialized rules.`;
}
