import { randomBytes, randomUUID } from "node:crypto";
import { createPool, type ResultSetHeader } from "mysql2/promise";
import { expect, it } from "vitest";
import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { searchExplore } from "@/server/explore/explore-repository";
import { runMigrations } from "../../../scripts/migrate.mjs";

it("recherche les données publiques, cumule les filtres et respecte le masquage", async () => {
  const password = process.env.KANU_TEST_DB_PASSWORD;
  const migrationPassword = process.env.KANU_MIGRATE_TEST_DB_PASSWORD;
  if (!password || !migrationPassword) throw new Error("Mots de passe MySQL de test absents.");
  await runMigrations("test", migrationPassword);
  const pool = createPool({
    host: "127.0.0.1", port: 3306, user: "kanu_app_test", password,
    database: "kanuconnecttest", charset: "utf8mb4", timezone: "Z", multipleStatements: false,
  });
  const connection = await pool.getConnection();
  const suffix = randomBytes(6).toString("hex");
  const members: number[] = [];
  const projects: { internalId: number; id: string }[] = [];
  const search = (params: Record<string, string>) =>
    searchExplore(connection, parseExploreQuery(new URLSearchParams(params)));

  // Ce test ne fait que des lectures métier : toutes les fixtures restent
  // dans cette transaction, annulée même lorsqu’une assertion échoue.
  try {
    await connection.beginTransaction();
    for (let index = 0; index < 23; index++) {
      const [member] = await connection.execute<ResultSetHeader>(
        `INSERT INTO members (public_id, created_at, updated_at)
         VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [randomUUID()],
      );
      members.push(member.insertId);
      await connection.execute(
        "INSERT INTO member_private_identities (member_id, legal_name) VALUES (?, ?)",
        [member.insertId, `${suffix}private`],
      );
      await connection.execute(
        `INSERT INTO member_profiles
         (member_id, handle, bio, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [member.insertId, `ex_${suffix}_${String(index).padStart(2, "0")}`,
          index < 21 ? `Communauté ${suffix}` : index === 21 ? `${suffix}%_!` : `${suffix}ABC`,
          index === 0 ? "Bamako, Mali" : "Dakar"],
      );
    }
    await connection.execute(
      `INSERT INTO member_email_credentials (member_id, email, password_hash)
       VALUES (?, ?, ?)`, [members[0], `${suffix}secret@example.test`, "fixture-no-login"],
    );
    for (const [id, label] of [[members[0], "React"], [members[0], "TypeScript"],
      [members[1], "React Native"]] as const) {
      await connection.execute("INSERT INTO member_profile_skills (member_id, label) VALUES (?, ?)", [id, label]);
    }
    // Un compte OAuth sans profil ne doit pas apparaître.
    await connection.execute(
      `INSERT INTO members (public_id, created_at, updated_at)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`, [randomUUID()],
    );

    for (let index = 0; index < 21; index++) {
      const id = randomUUID();
      const [project] = await connection.execute<ResultSetHeader>(
        `INSERT INTO member_projects
         (public_id, member_id, title, summary, description, status, technologies, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '2026-01-01 00:00:00.000', UTC_TIMESTAMP(3))`,
        [id, members[0], `Projet ${suffix} ${index}`, `Résumé ${suffix}summary`,
          index === 0 ? `${suffix}description` : "Présentation publique",
          index === 1 ? "live" : "building",
        JSON.stringify(index === 0
                    ? ["React", "TypeScript", "Élan", "C++", "A_B", "50%", "Dart", "MySQL"]
                    : index === 1 ? ["React", "TypeScript"] : ["React Native"])],
            );
      projects.push({ internalId: project.insertId, id });
    }

    const page1 = await search({ q: `Communauté ${suffix}` });
    const page2 = await search({ q: `Communauté ${suffix}`, page: "2" });
    expect(page1.items).toHaveLength(20);
    expect(page1.hasNext).toBe(true);
    expect(page2.items).toHaveLength(1);
    expect(page2.hasNext).toBe(false);
    expect(new Set([...page1.items, ...page2.items].map((item) => JSON.stringify(item))).size).toBe(21);
    expect((await search({ q: `Communauté ${suffix}`, page: "3" })).items).toEqual([]);
    expect((await search({ q: `COMMUNAUTE ${suffix}` })).items).toHaveLength(20);

    const filtered = await search({ q: suffix, skill: "rEaCt", location: "BAMAKO" });
    expect(filtered.kind).toBe("members");
    if (filtered.kind !== "members") throw new Error("Onglet inattendu.");
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].skills).toEqual(["React", "TypeScript"]);
    expect(Object.keys(filtered.items[0]).sort()).toEqual(["bio", "handle", "location", "publicId", "skills"]);
    expect((await search({ q: suffix, skill: "React", location: "Dakar" })).items).toEqual([]);
    expect((await search({ q: `${suffix}%_!` })).items).toHaveLength(1);
    expect((await search({ q: `EX_${suffix}_00` })).items).toHaveLength(1);
    expect((await search({ q: `${suffix}private` })).items).toEqual([]);
    expect((await search({ q: `${suffix}secret` })).items).toEqual([]);
    expect((await search({ q: "' OR 1=1 --" })).items).toEqual([]);

    const projectPage1 = await search({ kind: "projects", q: suffix });
    const projectPage2 = await search({ kind: "projects", q: suffix, page: "2" });
    expect(projectPage1.items).toHaveLength(20);
    expect(projectPage1.hasNext).toBe(true);
    expect(projectPage2.items).toHaveLength(1);
    expect(projectPage2.hasNext).toBe(false);
    expect(new Set([...projectPage1.items, ...projectPage2.items].map((item) => JSON.stringify(item))).size).toBe(21);
        for (const technology of ["React", "react", "rEaCt"]) {
      expect((await search({ kind: "projects", q: suffix, technology })).items)
        .toHaveLength(2);
    }

    for (const technology of ["elan", "C++", "a_b", "50%", "mysql"]) {
      const result = await search({ kind: "projects", q: suffix, technology });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: projects[0].id });
    }

    expect((await search({
      kind: "projects",
      q: suffix,
      technology: "React Native",
    })).items).toHaveLength(19);

    expect((await search({
      kind: "projects",
      q: suffix,
      technology: "C%",
    })).items).toEqual([]);

    expect((await search({
      kind: "projects",
      q: suffix,
      status: "building",
    })).items).toHaveLength(20);

for (const technology of ["React", "react", "rEaCt"]) {
      expect((await search({ kind: "projects", q: suffix, technology })).items)
        .toHaveLength(2);
    }

    for (const technology of ["elan", "C++", "a_b", "50%", "mysql"]) {
      const result = await search({ kind: "projects", q: suffix, technology });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: projects[0].id });
    }

    expect((await search({
      kind: "projects",
      q: suffix,
      technology: "React Native",
    })).items).toHaveLength(19);

    expect((await search({
      kind: "projects",
      q: suffix,
      technology: "C%",
    })).items).toEqual([]);

    expect((await search({
      kind: "projects",
      q: suffix,
      status: "building",
    })).items).toHaveLength(20);

    const projectFilter = { kind: "projects", q: suffix, technology: "rEaCt", status: "building" };

    const exact = await search(projectFilter);
    expect(exact.items).toHaveLength(1);
    expect(exact.items[0]).toMatchObject({ id: projects[0].id, status: "building" });
    expect(Object.keys(exact.items[0]).sort()).toEqual(["authorHandle", "id", "status", "summary", "technologies", "title"]);
    expect((await search({ kind: "projects", q: `${suffix}description` })).items).toHaveLength(1);
    expect((await search({ kind: "projects", q: `${suffix}summary` })).items).toHaveLength(20);
    expect((await search({ ...projectFilter, status: "live" })).items[0]).toMatchObject({ id: projects[1].id });

    for (const reporter of members.slice(1, 4)) {
      await connection.execute(
        `INSERT INTO content_reports (reporter_id, project_id, reason, created_at)
         VALUES (?, ?, 'spam', UTC_TIMESTAMP(3))`, [reporter, projects[0].internalId],
      );
    }
    expect((await search(projectFilter)).items).toEqual([]);
    await connection.execute(
      `INSERT INTO content_moderation_decisions
       (project_id, moderator_id, decision, note, reviewed_at)
       VALUES (?, ?, 'restore', 'Fixture', UTC_TIMESTAMP(3))`,
      [projects[0].internalId, members[1]],
    );
    expect((await search(projectFilter)).items).toHaveLength(1);
    await connection.execute("UPDATE content_moderation_decisions SET decision = 'hide' WHERE project_id = ?", [projects[0].internalId]);
    expect((await search(projectFilter)).items).toEqual([]);
    await connection.execute("UPDATE content_moderation_decisions SET decision = 'restore' WHERE project_id = ?", [projects[0].internalId]);
    await connection.execute("UPDATE member_projects SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?", [projects[0].internalId]);
    expect((await search(projectFilter)).items).toEqual([]);
  } finally {
    try { await connection.rollback(); }
    finally { connection.release(); await pool.end(); }
  }
}, 90_000);
