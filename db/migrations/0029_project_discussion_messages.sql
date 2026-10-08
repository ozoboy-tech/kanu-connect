CREATE TABLE `project_discussion_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `author_id` BIGINT UNSIGNED NOT NULL,
  `body` VARCHAR(2000) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_discussion_page` (`project_id`, `id`),
  KEY `idx_discussion_author` (`author_id`),
  CONSTRAINT `fk_discussion_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_discussion_author` FOREIGN KEY (`author_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_discussion_body` CHECK (CHAR_LENGTH(TRIM(`body`)) > 0)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
