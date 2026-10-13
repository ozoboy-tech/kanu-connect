CREATE TABLE `content_moderation_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `post_id` BIGINT UNSIGNED NULL,
  `comment_id` BIGINT UNSIGNED NULL,
  `project_id` BIGINT UNSIGNED NULL,
  `actor_id` BIGINT UNSIGNED NULL,
  `decision` VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `final_by_admin` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_content_audit_post` (`post_id`, `id`),
  KEY `idx_content_audit_comment` (`comment_id`, `id`),
  KEY `idx_content_audit_project` (`project_id`, `id`),
  CONSTRAINT `fk_content_audit_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_audit_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_audit_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_content_audit_actor` FOREIGN KEY (`actor_id`)
    REFERENCES `members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_content_audit_target` CHECK
    ((`post_id` IS NOT NULL) + (`comment_id` IS NOT NULL) +
     (`project_id` IS NOT NULL) = 1),
  CONSTRAINT `chk_content_audit_decision` CHECK
    (`decision` IN ('hide', 'restore')),
  CONSTRAINT `chk_content_audit_reason` CHECK
    (CHAR_LENGTH(TRIM(`reason`)) > 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
