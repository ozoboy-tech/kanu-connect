CREATE TABLE `project_collaboration_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `status` VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `decided_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collaboration_member` (`project_id`, `member_id`),
  KEY `idx_collaboration_page` (`project_id`, `id`),
  KEY `idx_collaboration_member` (`member_id`),
  CONSTRAINT `fk_collaboration_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collaboration_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_collaboration_message` CHECK (CHAR_LENGTH(TRIM(`message`)) > 0),
  CONSTRAINT `chk_collaboration_status` CHECK (
    (`status` = 'pending' AND `decided_at` IS NULL) OR
    (`status` IN ('accepted', 'rejected') AND `decided_at` IS NOT NULL)
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
