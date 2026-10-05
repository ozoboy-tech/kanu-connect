CREATE TABLE `posts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `kind` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `space` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `body` TEXT NOT NULL,
  `code` TEXT NULL,
  `code_language` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_posts_public_id` (`public_id`),
  KEY `idx_posts_feed` (`deleted_at`, `created_at`, `id`),
  KEY `idx_posts_member` (`member_id`),
  CONSTRAINT `fk_post_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `chk_post_kind` CHECK (`kind` IN
    ('question', 'tip', 'project', 'opportunity', 'tutorial', 'announcement')),
  CONSTRAINT `chk_post_space` CHECK (`space` IN
    ('questions', 'sharing', 'projects', 'opportunities')),
  CONSTRAINT `chk_post_title` CHECK (CHAR_LENGTH(TRIM(`title`)) > 0),
  CONSTRAINT `chk_post_body` CHECK (CHAR_LENGTH(TRIM(`body`)) > 0),
  CONSTRAINT `chk_post_code` CHECK (
    (`code` IS NULL AND `code_language` IS NULL) OR
    (`code` IS NOT NULL AND `code_language` IS NOT NULL)
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;