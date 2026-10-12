ALTER TABLE `project_collaboration_requests`
  DROP CHECK `chk_collaboration_status`,
  MODIFY COLUMN `status` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ADD CONSTRAINT `chk_collaboration_status` CHECK (
    (`status` = 'pending' AND `decided_at` IS NULL) OR
    (`status` IN ('accepted', 'rejected', 'withdrawn') AND `decided_at` IS NOT NULL)
  );
