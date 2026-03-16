// Subject / Waiver conflict detection
// Convention: SF_SUB_01 (subject) + SF_SUB_01W (waiver) share a base ID

export interface Conflict {
  subjectId: string;
  waiverId: string;
  subjectTitle: string;
  waiverTitle: string;
}

/**
 * Given a set of selected clause IDs and a lookup for titles,
 * find pairs where both a subject and its waiver are selected.
 */
export function findConflicts(
  selectedIds: string[],
  titleMap: Record<string, string>
): Conflict[] {
  const idSet = new Set(selectedIds);
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (const id of selectedIds) {
    // Check if this is a waiver (ends with W) and its subject is also selected
    if (id.endsWith('W')) {
      const baseId = id.slice(0, -1);
      if (idSet.has(baseId) && !seen.has(baseId)) {
        seen.add(baseId);
        conflicts.push({
          subjectId: baseId,
          waiverId: id,
          subjectTitle: titleMap[baseId] || baseId,
          waiverTitle: titleMap[id] || id,
        });
      }
    } else {
      // Check if waiver variant exists in selection
      const waiverId = id + 'W';
      if (idSet.has(waiverId) && !seen.has(id)) {
        seen.add(id);
        conflicts.push({
          subjectId: id,
          waiverId: waiverId,
          subjectTitle: titleMap[id] || id,
          waiverTitle: titleMap[waiverId] || waiverId,
        });
      }
    }
  }

  return conflicts;
}
