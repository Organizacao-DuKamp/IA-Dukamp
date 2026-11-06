import { pedigreeLabel, type AnimalProfile, type PedigreeNode } from "./animal-profile.ts";

export interface PedigreeTreeNode {
  path: string;
  parentPath: string | null;
  generation: number;
  index: number;
  label: string;
  code?: string;
  name?: string;
}

export const pedigreeTreeLabel = pedigreeLabel;

/** A path identifies a position, not a unique animal: the same ancestor may
 * occur in different branches. Missing slots stay explicitly unknown. */
export function pedigreeTreeNodes(animal: Partial<AnimalProfile>, generations: number) {
  const ancestors = new Map<string, PedigreeNode>();
  for (const node of animal.pedigree ?? []) ancestors.set(node.relation, node);
  const nodes: PedigreeTreeNode[] = [];
  const visit = (path: string, generation: number, index: number) => {
    const ancestor = ancestors.get(path);
    const parent = path === "sire" ? animal.sire : path === "dam" ? animal.dam : undefined;
    // A changed parent must not display the imported ancestry of the former parent.
    const root = path.split(".")[0];
    const rootNode = ancestors.get(root);
    const rootValue = root === "sire" ? animal.sire : animal.dam;
    const stale =
      rootNode &&
      rootValue !== undefined &&
      ![rootNode.code, rootNode.name, `${rootNode.code} · ${rootNode.name}`].includes(rootValue);
    const known = stale ? undefined : ancestor;
    nodes.push({
      path,
      parentPath: generation ? path.split(".").slice(0, -1).join(".") : null,
      generation,
      index,
      label: pedigreeTreeLabel(path),
      code: generation === 0 ? animal.code : (parent ?? known?.code),
      name: generation === 0 ? animal.name : known?.name,
    });
    if (generation < Math.max(1, Math.min(4, generations))) {
      visit(path ? `${path}.sire` : "sire", generation + 1, index * 2);
      visit(path ? `${path}.dam` : "dam", generation + 1, index * 2 + 1);
    }
  };
  visit("", 0, 0);
  return nodes;
}
