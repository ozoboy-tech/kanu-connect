CREATE TABLE `content_reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporter_id` BIGINT UNSIGNED NOT NULL,
  `post_id` BIGINT UNSIGNED NULL,
  `comment_id` BIGINT UNSIGNED NULL,
  `project_id` BIGINT UNSIGNED NULL,
  `reason` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_report_post` (`reporter_id`, `post_id`),
  UNIQUE KEY `uq_report_comment` (`reporter_id`, `comment_id`),
  UNIQUE KEY `uq_report_project` (`reporter_id`, `project_id`),
  KEY `idx_report_post` (`post_id`),
  KEY `idx_report_comment` (`comment_id`),
  KEY `idx_report_project` (`project_id`),
  CONSTRAINT `fk_report_member` FOREIGN KEY (`reporter_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_report_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_report_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_report_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_report_target` CHECK (
    (`post_id` IS NOT NULL) + (`comment_id` IS NOT NULL) +
    (`project_id` IS NOT NULL) = 1
  ),
  CONSTRAINT `chk_report_reason` CHECK (
    `reason` IN ('spam', 'harassment', 'inappropriate')
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
