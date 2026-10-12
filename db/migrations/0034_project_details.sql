ALTER TABLE `member_projects`
  DROP CHECK `chk_member_project_status`,
  ADD COLUMN `recruitment_roles` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  ADD CONSTRAINT `chk_member_project_status` CHECK (`status` IN ('idea', 'building', 'paused', 'live')),
  ADD CONSTRAINT `chk_member_project_roles` CHECK (
    JSON_TYPE(`recruitment_roles`) = 'ARRAY' AND JSON_LENGTH(`recruitment_roles`) <= 8
  );
