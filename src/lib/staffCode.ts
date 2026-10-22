/** Stable 8-digit staff number from the existing user id.
 *  Nothing is stored. The same account always gets the same number, and the
 *  database schema stays as it is. */
export function staffCodeFromId(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash >>> 0).padStart(8, "0").slice(-8);
}

export type StaffColleague = {
  code: string;
  nickname: string;
  name: string;
};

function matchColleague(stored: string, people: StaffColleague[]): StaffColleague | undefined {
  const named = stored.trim().toLowerCase();
  return people.find(
    (person) =>
      person.code === stored.trim() ||
      (person.nickname && person.nickname.toLowerCase() === named) ||
      (person.name && person.name.toLowerCase() === named)
  );
}

export function colleagueLabel(stored: string, people: StaffColleague[]): string {
  const hit = matchColleague(stored, people);
  return hit?.nickname || hit?.name || stored;
}

export function colleagueCode(stored: string, people: StaffColleague[]): string {
  return matchColleague(stored, people)?.code || stored;
}
