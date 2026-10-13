CREATE TABLE IF NOT EXISTS `project_bookmarks` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`member_id`, `project_id`),
  KEY `idx_project_bookmark_content` (`project_id`),
  CONSTRAINT `fk_project_bookmark_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_bookmark_content` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;