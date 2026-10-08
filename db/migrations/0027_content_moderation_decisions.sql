CREATE TABLE `content_moderation_decisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `post_id` BIGINT UNSIGNED NULL,
  `comment_id` BIGINT UNSIGNED NULL,
  `project_id` BIGINT UNSIGNED NULL,
  `moderator_id` BIGINT UNSIGNED NULL,
  `decision` VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `note` VARCHAR(500) NOT NULL,
  `reviewed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_moderation_post` (`post_id`),
  UNIQUE KEY `uq_moderation_comment` (`comment_id`),
  UNIQUE KEY `uq_moderation_project` (`project_id`),
  KEY `idx_moderation_moderator` (`moderator_id`),
  CONSTRAINT `fk_moderation_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_moderation_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_moderation_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_moderation_member` FOREIGN KEY (`moderator_id`)
    REFERENCES `members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_moderation_target` CHECK (
    (`post_id` IS NOT NULL) + (`comment_id` IS NOT NULL) +
    (`project_id` IS NOT NULL) = 1
  ),
  CONSTRAINT `chk_moderation_decision` CHECK (
    `decision` IN ('hide', 'restore')
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
